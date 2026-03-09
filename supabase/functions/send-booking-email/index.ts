import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { booking_id, email_type } = await req.json();
    if (!booking_id || !email_type) {
      return new Response(JSON.stringify({ error: "booking_id and email_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already sent (skip dedup for appointment_updated since it can be sent multiple times)
    if (email_type !== "appointment_updated") {
      const { data: existing } = await supabase
        .from("booking_emails")
        .select("id")
        .eq("booking_id", booking_id)
        .eq("email_type", email_type)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: true, message: "Already sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch booking with service and breed
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("*, services(name), breeds(name)")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) throw new Error("Booking not found");
    if (!booking.customer_email) {
      return new Response(JSON.stringify({ success: false, message: "No customer email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceName = booking.services?.name || "Grooming";
    const breedName = booking.breeds?.name || "";
    const dateFormatted = new Date(booking.booking_date + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const timeFormatted = booking.booking_time.slice(0, 5);

    let subject = "";
    let bodyHtml = "";

    if (email_type === "confirmation") {
      subject = `Booking Confirmed — ${booking.dog_name} on ${dateFormatted}`;
      bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a;">Booking Confirmed ✓</h2>
          <p>Hi ${booking.customer_name},</p>
          <p>Your appointment has been booked! Here are the details:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px 0; color: #666;">Dog</td><td style="padding: 8px 0; font-weight: bold;">${booking.dog_name}${breedName ? ` (${breedName})` : ""}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Service</td><td style="padding: 8px 0; font-weight: bold;">${serviceName}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0; font-weight: bold;">${dateFormatted}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Time</td><td style="padding: 8px 0; font-weight: bold;">${timeFormatted}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Price</td><td style="padding: 8px 0; font-weight: bold;">£${Number(booking.total_price).toFixed(2)}</td></tr>
          </table>
          <p style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 16px 0;">
            📍 <strong>Fluff & Scruff Studio</strong><br/>
            138 Hillview Avenue, Hornchurch RM11 2DL<br/>
            📞 <a href="tel:01708606655" style="color: #1a1a1a;">01708 606655</a> · WhatsApp: <a href="https://wa.me/447476452782" style="color: #1a1a1a;">+44 7476 452782</a>
          </p>
          <p style="color: #666;">Need to make changes or cancel? You can do this from your profile up to 48 hours before your appointment. If your appointment is less than 48 hours away, please call or email us directly at <a href="mailto:info@fluffandscruff.co.uk" style="color: #1a1a1a;">info@fluffandscruff.co.uk</a>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `;
    } else if (email_type === "reminder_24h") {
      subject = `Reminder: ${booking.dog_name}'s appointment tomorrow`;
      bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a;">Appointment Tomorrow 🐾</h2>
          <p>Hi ${booking.customer_name},</p>
          <p>Just a friendly reminder that <strong>${booking.dog_name}</strong> has an appointment tomorrow:</p>
          <p style="background: #f8f8f8; padding: 16px; border-radius: 8px; font-size: 18px; text-align: center;">
            <strong>${dateFormatted}</strong> at <strong>${timeFormatted}</strong>
          </p>
          <p><strong>Service:</strong> ${serviceName}</p>
          <p style="background: #f8f8f8; padding: 16px; border-radius: 8px;">
            📍 <strong>Fluff & Scruff Studio</strong><br/>
            138 Hillview Avenue, Hornchurch RM11 2DL<br/>
            📞 <a href="tel:01708606655" style="color: #1a1a1a;">01708 606655</a> · WhatsApp: <a href="https://wa.me/447476452782" style="color: #1a1a1a;">+44 7476 452782</a>
          </p>
          <p style="color: #666;">Need to reschedule? Reply to this email and we'll help.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `;
    } else if (email_type === "reminder_2h") {
      subject = `${booking.dog_name}'s appointment is in 2 hours!`;
      bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a;">See You Soon! 🐶</h2>
          <p>Hi ${booking.customer_name},</p>
          <p><strong>${booking.dog_name}</strong> is due at the studio at <strong>${timeFormatted}</strong> today.</p>
          <p style="background: #f8f8f8; padding: 16px; border-radius: 8px;">
            📍 <strong>Fluff & Scruff Studio</strong><br/>
            138 Hillview Avenue, Hornchurch RM11 2DL<br/>
            📞 <a href="tel:01708606655" style="color: #1a1a1a;">01708 606655</a> · WhatsApp: <a href="https://wa.me/447476452782" style="color: #1a1a1a;">+44 7476 452782</a>
          </p>
          <p style="color: #666;">Running late? Reply to this email to let us know.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `;
    } else if (email_type === "appointment_updated") {
      subject = `Appointment Updated — ${booking.dog_name} on ${dateFormatted}`;
      bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a;">Your Appointment Has Been Updated 📝</h2>
          <p>Hi ${booking.customer_name},</p>
          <p>We've made a change to <strong>${booking.dog_name}</strong>'s appointment. Here are the updated details:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px 0; color: #666;">Dog</td><td style="padding: 8px 0; font-weight: bold;">${booking.dog_name}${breedName ? ` (${breedName})` : ""}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Service</td><td style="padding: 8px 0; font-weight: bold;">${serviceName}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0; font-weight: bold;">${dateFormatted}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Time</td><td style="padding: 8px 0; font-weight: bold;">${timeFormatted}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Price</td><td style="padding: 8px 0; font-weight: bold;">£${Number(booking.total_price).toFixed(2)}</td></tr>
          </table>
          <p style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 16px 0;">
            📍 <strong>Fluff & Scruff Studio</strong><br/>
            138 Hillview Avenue, Hornchurch RM11 2DL<br/>
            📞 <a href="tel:01708606655" style="color: #1a1a1a;">01708 606655</a> · WhatsApp: <a href="https://wa.me/447476452782" style="color: #1a1a1a;">+44 7476 452782</a>
          </p>
          <p style="color: #666;">Questions? Simply reply to this email and we'll help.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `;
    } else {
      return new Response(JSON.stringify({ error: "Invalid email_type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
        to: [booking.customer_email],
        reply_to: "info@fluffandscruff.co.uk",
        subject,
        html: bodyHtml,
      }),
    });

    if (!res.ok) {
      const errData = await res.text();
      throw new Error(`Resend error: ${errData}`);
    }

    // Record in booking_emails
    await supabase.from("booking_emails").insert({
      booking_id,
      email_type,
      resend_id: null,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
