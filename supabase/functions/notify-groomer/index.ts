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

    const { booking_id, notification_type, extra } = await req.json();

    if (!booking_id || !notification_type) {
      return new Response(JSON.stringify({ error: "booking_id and notification_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch booking with service, breed, and staff
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("*, services(name), breeds(name), staff(name, email)")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groomerEmail = booking.staff?.email;
    const groomerName = booking.staff?.name || "Groomer";

    if (!groomerEmail) {
      return new Response(JSON.stringify({ success: false, message: "No groomer email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceName = booking.services?.name || "Grooming";
    const breedName = booking.breeds?.name || "";
    const dateFormatted = new Date(booking.booking_date + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const timeFormatted = booking.booking_time.slice(0, 5);

    const bookingDetailsHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0; color: #666;">Customer</td><td style="padding: 8px 0; font-weight: bold;">${booking.customer_name}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Dog</td><td style="padding: 8px 0; font-weight: bold;">${booking.dog_name}${breedName ? ` (${breedName})` : ""}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Service</td><td style="padding: 8px 0; font-weight: bold;">${serviceName}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0; font-weight: bold;">${dateFormatted}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Time</td><td style="padding: 8px 0; font-weight: bold;">${timeFormatted}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Price</td><td style="padding: 8px 0; font-weight: bold;">£${Number(booking.total_price).toFixed(2)}</td></tr>
        ${booking.notes ? `<tr><td style="padding: 8px 0; color: #666;">Notes</td><td style="padding: 8px 0;">${booking.notes}</td></tr>` : ""}
      </table>
    `;

    let subject = "";
    let bodyHtml = "";

    if (notification_type === "new_booking") {
      subject = `New Booking — ${booking.customer_name} on ${dateFormatted}`;
      bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a;">New Booking Assigned to You 📋</h2>
          <p>Hi ${groomerName},</p>
          <p>A new appointment has been booked and assigned to you:</p>
          ${bookingDetailsHtml}
          <p style="color: #666;">Log in to your portal for full details.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `;
    } else if (notification_type === "booking_edited") {
      subject = `Booking Updated — ${booking.customer_name} on ${dateFormatted}`;
      bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a;">Booking Updated 📝</h2>
          <p>Hi ${groomerName},</p>
          <p>An appointment assigned to you has been updated. Here are the current details:</p>
          ${bookingDetailsHtml}
          <p style="color: #666;">Log in to your portal to review the changes.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `;
    } else if (notification_type === "booking_cancelled") {
      subject = `Booking Cancelled — ${booking.customer_name} on ${dateFormatted}`;
      bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #b91c1c;">Booking Cancelled ❌</h2>
          <p>Hi ${groomerName},</p>
          <p>The following appointment has been cancelled:</p>
          ${bookingDetailsHtml}
          <p style="color: #666;">This time slot is now free. Log in to your portal for your updated schedule.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `;
    } else if (notification_type === "customer_message") {
      const messagePreview = extra?.message_preview || "(no content)";
      const messageSubject = extra?.message_subject || "(no subject)";
      subject = `New Message from ${booking.customer_name}`;
      bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a;">New Customer Message 💬</h2>
          <p>Hi ${groomerName},</p>
          <p><strong>${booking.customer_name}</strong> has sent a message regarding their appointment:</p>
          <div style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="font-weight: bold; margin: 0 0 8px 0;">${messageSubject}</p>
            <p style="margin: 0; white-space: pre-wrap;">${messagePreview}</p>
          </div>
          <p style="font-size: 13px; color: #666;">Appointment details:</p>
          ${bookingDetailsHtml}
          <p style="color: #666;">Log in to your portal to read the full message and reply.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `;
    } else {
      return new Response(JSON.stringify({ error: "Invalid notification_type" }), {
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
        to: [groomerEmail],
        reply_to: "info@fluffandscruff.co.uk",
        subject,
        html: bodyHtml,
      }),
    });

    if (!res.ok) {
      const errData = await res.text();
      throw new Error(`Resend error: ${errData}`);
    }

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
