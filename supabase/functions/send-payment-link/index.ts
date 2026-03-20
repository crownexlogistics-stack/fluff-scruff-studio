import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { booking_id, send_via, payment_type } = await req.json();
    if (!booking_id) throw new Error("booking_id required");

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*, services(name), breeds(name), staff(name)")
      .eq("id", booking_id)
      .single();
    if (bErr || !booking) throw new Error("Booking not found");

    const total = Number(booking.total_price);
    const deposit = Number(booking.deposit_paid);

    // When payment_type is "deposit", charge exactly 50% of total
    const amountDue = payment_type === "deposit"
      ? total * 0.5
      : total - deposit;
    if (amountDue <= 0) throw new Error("No amount due on this booking");

    const amountInPence = Math.round(amountDue * 100);
    if (amountInPence < 30) throw new Error("Amount too small for Stripe");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Create a Stripe Payment Link
    const isDeposit = payment_type === "deposit";
    const labelPrefix = isDeposit ? "Deposit" : "Payment";

    const product = await stripe.products.create({
      name: `${labelPrefix} — ${booking.services?.name || "Dog Grooming"} for ${booking.dog_name}`,
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amountInPence,
      currency: "gbp",
    });
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { booking_id },
      after_completion: {
        type: "redirect",
        redirect: { url: "https://fluffandscruff.co.uk/booking-success?booking_id=" + booking_id + "&payment_type=" + (isDeposit ? "deposit" : "balance") },
      },
    });

    const linkUrl = paymentLink.url;
    const firstName = booking.customer_name?.split(" ")[0] || "there";
    const dateFormatted = new Date(booking.booking_date + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    // Send via Email
    if ((send_via === "email" || send_via === "both") && booking.customer_email && RESEND_API_KEY) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a;">Your Payment Link 🐾</h2>
          <p>Hi ${firstName},</p>
          <p>Here's your secure payment link for <strong>${booking.dog_name}</strong>'s appointment on <strong>${dateFormatted}</strong>.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px 0; color: #666;">Service</td><td style="padding: 8px 0; font-weight: bold;">${booking.services?.name || "Dog Grooming"}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Total</td><td style="padding: 8px 0; font-weight: bold;">£${total.toFixed(2)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Already Paid</td><td style="padding: 8px 0; font-weight: bold;">£${deposit.toFixed(2)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">Amount Due</td><td style="padding: 8px 0; font-weight: bold; color: #b91c1c;">£${amountDue.toFixed(2)}</td></tr>
          </table>

          <div style="text-align: center; margin: 24px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
              <tr>
                <td align="center" valign="middle" style="background-color: #1a1a1a; border-radius: 8px;">
                  <a href="${linkUrl}" target="_blank" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                    Pay Now — £${amountDue.toFixed(2)}
                  </a>
                </td>
              </tr>
            </table>
          </div>

          <p style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 16px 0;">
            📍 <strong>Fluff & Scruff Studio</strong><br/>
            138 Hillview Avenue, Hornchurch RM11 2DL<br/>
            📞 <a href="tel:01708606655" style="color: #1a1a1a;">01708 606655</a> · WhatsApp: <a href="https://wa.me/447476452782" style="color: #1a1a1a;">+44 7476 452782</a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL</p>
        </div>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
          to: [booking.customer_email],
          reply_to: "info@fluffandscruff.co.uk",
          subject: "Your payment link from Fluff & Scruff 🐾",
          html,
        }),
      });
    }

    // Send via SMS
    if ((send_via === "sms" || send_via === "both") && booking.customer_phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
      // Format UK phone numbers to E.164
      let formattedPhone = booking.customer_phone.replace(/\s+/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "+44" + formattedPhone.slice(1);
      } else if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+44" + formattedPhone;
      }

      const smsBody = `Hi ${firstName}, here is your payment link for your appointment at Fluff & Scruff: ${linkUrl}`;
      
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const formData = new URLSearchParams();
      formData.append("To", formattedPhone);
      formData.append("From", TWILIO_PHONE_NUMBER);
      formData.append("Body", smsBody);
      formData.append("MessagingServiceSid", "MG3c95c22cb05574f545cc1b32d9db4600");

      await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        },
        body: formData.toString(),
      });
    }

    // Audit log
    const authHeader = req.headers.get("Authorization");
    let userId = "system";
    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "");
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseAuth.auth.getUser(token);
      if (userData?.user) userId = userData.user.id;
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      staff_id: booking.staff_id,
      action: "PAYMENT_LINK_SENT",
      details: `Payment link of £${amountDue.toFixed(2)} sent via ${send_via} for ${booking.customer_name} (${booking.dog_name}). Booking date: ${booking.booking_date}.`,
    });

    return new Response(JSON.stringify({ success: true, url: linkUrl }), {
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
