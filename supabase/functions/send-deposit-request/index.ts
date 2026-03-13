import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { booking_id } = await req.json();
    if (!booking_id) {
      return new Response(JSON.stringify({ error: "booking_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch booking with service and breed
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("*, services(name), breeds(name)")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) throw new Error("Booking not found");
    if (!booking.customer_email) {
      return new Response(JSON.stringify({ error: "No customer email on this booking" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const totalPrice = Number(booking.total_price);
    const depositAmount = Math.round(totalPrice * 0.6 * 100); // 60% in pence

    if (depositAmount < 30) {
      throw new Error("Deposit amount too small for Stripe (minimum 30p)");
    }

    const serviceName = booking.services?.name || "Dog Grooming";
    const breedName = booking.breeds?.name || "";
    const dogName = booking.dog_name || "your pup";

    // Check if customer already exists in Stripe
    let customerId: string | undefined;
    const customers = await stripe.customers.list({
      email: booking.customer_email,
      limit: 1,
    });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = "https://fluff-scruff-studio.lovable.app";

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : booking.customer_email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Deposit — ${serviceName}`,
              description: `60% deposit for ${dogName}'s appointment`,
            },
            unit_amount: depositAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/booking-success?booking_id=${booking_id}&payment_type=deposit`,
      cancel_url: `${origin}/book?deposit_cancelled=true&booking_id=${booking_id}`,
      metadata: {
        booking_id,
        customer_name: booking.customer_name,
        dog_name: dogName,
        total_price: String(totalPrice),
        payment_type: "deposit",
        payment_amount: String(depositAmount / 100),
      },
    });

    const checkoutUrl = session.url;

    // Format date and time for email
    const dateFormatted = new Date(booking.booking_date + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeFormatted = booking.booking_time.slice(0, 5);
    const depositDisplay = (depositAmount / 100).toFixed(2);

    // Send email via Resend
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Your Appointment is Pre-Booked! 🐾</h2>
        <p>Hi ${booking.customer_name},</p>
        <p>Great news — we've pre-booked an appointment for <strong>${dogName}</strong>. To secure your slot, please pay the deposit using the link below.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #666;">Dog</td><td style="padding: 8px 0; font-weight: bold;">${dogName}${breedName ? ` (${breedName})` : ""}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Service</td><td style="padding: 8px 0; font-weight: bold;">${serviceName}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0; font-weight: bold;">${dateFormatted}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Time</td><td style="padding: 8px 0; font-weight: bold;">${timeFormatted}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Total Price</td><td style="padding: 8px 0; font-weight: bold;">£${totalPrice.toFixed(2)}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Deposit Due</td><td style="padding: 8px 0; font-weight: bold; color: #b91c1c;">£${depositDisplay}</td></tr>
        </table>

        <div style="text-align: center; margin: 24px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
            <tr>
              <td align="center" valign="middle" style="background-color: #1a1a1a; border-radius: 8px;">
                <a href="${checkoutUrl}" target="_blank" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; mso-padding-alt: 0; text-underline-color: #1a1a1a;">
                  <!--[if mso]><i style="mso-font-width:150%;mso-text-raise:22pt">&nbsp;</i><![endif]-->
                  <span style="mso-text-raise:11pt;">Pay Deposit &mdash; &pound;${depositDisplay}</span>
                  <!--[if mso]><i style="mso-font-width:150%">&nbsp;</i><![endif]-->
                </a>
              </td>
            </tr>
          </table>
          <p style="color: #666; font-size: 12px; margin-top: 8px;">If the button above doesn't work, <a href="${checkoutUrl}" style="color: #1a1a1a; text-decoration: underline;">click here to pay your deposit</a>.</p>
        </div>

        <p style="color: #666; font-size: 13px;">This booking will only be confirmed once the deposit is received. The remaining balance of £${(totalPrice - depositAmount / 100).toFixed(2)} is due on the day of the appointment.</p>

        <p style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 16px 0;">
          📍 <strong>Fluff & Scruff Studio</strong><br/>
          138 Hillview Avenue, Hornchurch RM11 2DL<br/>
          📞 <a href="tel:01708606655" style="color: #1a1a1a;">01708 606655</a> · WhatsApp: <a href="https://wa.me/447476452782" style="color: #1a1a1a;">+44 7476 452782</a>
        </p>
        <p style="color: #666;">Questions? Reply to this email and we'll help.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
      </div>
    `;

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
        subject: `Pay Your Deposit — ${dogName}'s Appointment on ${dateFormatted}`,
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
      email_type: "deposit_request",
      resend_id: null,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
