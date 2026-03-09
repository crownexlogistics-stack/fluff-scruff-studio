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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { customer_email, customer_name, amount, notes, delivery = "email", customer_phone } = await req.json();
    if (!customer_email) throw new Error("customer_email required");
    if (!amount || Number(amount) <= 0) throw new Error("Valid amount required");

    const amountNum = Number(amount);
    const amountInPence = Math.round(amountNum * 100);
    if (amountInPence < 30) throw new Error("Amount too small for Stripe (minimum £0.30)");

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "");
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseAuth.auth.getUser(token);
      if (userData?.user) userId = userData.user.id;
    }
    if (!userId) throw new Error("Authentication required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Create Stripe product + price + payment link
    const product = await stripe.products.create({
      name: `Payment Request — ${customer_name || customer_email}${notes ? ` (${notes})` : ""}`,
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amountInPence,
      currency: "gbp",
    });

    // Insert DB record first to get ID for redirect
    const { data: payLinkRecord, error: insertErr } = await supabase
      .from("customer_pay_links")
      .insert({
        customer_email,
        customer_name: customer_name || null,
        amount: amountNum,
        notes: notes || null,
        created_by: userId,
        status: "pending",
      })
      .select("id")
      .single();
    if (insertErr) throw new Error("Failed to create pay link record: " + insertErr.message);

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { pay_link_id: payLinkRecord.id },
      after_completion: {
        type: "redirect",
        redirect: {
          url: "https://fluff-scruff-studio.lovable.app/booking-success?pay_link_id=" + payLinkRecord.id + "&payment_type=ad_hoc",
        },
      },
    });

    // Update record with Stripe details
    await supabase
      .from("customer_pay_links")
      .update({
        stripe_payment_link_id: paymentLink.id,
        stripe_url: paymentLink.url,
      })
      .eq("id", payLinkRecord.id);

    const firstName = customer_name?.split(" ")[0] || "there";
    const sendEmail = delivery === "email" || delivery === "both";
    const sendSms = (delivery === "sms" || delivery === "both") && customer_phone;

    // Send email
    if (sendEmail && RESEND_API_KEY && customer_email) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a;">Payment Request 🐾</h2>
          <p>Hi ${firstName},</p>
          <p>We've sent you a payment link for <strong>£${amountNum.toFixed(2)}</strong>.</p>
          ${notes ? `<p style="color: #666;">Note: ${notes}</p>` : ""}

          <div style="text-align: center; margin: 24px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
              <tr>
                <td align="center" valign="middle" style="background-color: #1a1a1a; border-radius: 8px;">
                  <a href="${paymentLink.url}" target="_blank" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                    Pay Now — £${amountNum.toFixed(2)}
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
          from: "Fluff & Scruff Studio <onboarding@resend.dev>",
          to: [customer_email],
          reply_to: "info@fluffandscruff.co.uk",
          subject: "Payment request from Fluff & Scruff 🐾",
          html,
        }),
      });
    }

    // Send SMS via Twilio
    if (sendSms) {
      const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const MESSAGING_SERVICE_SID = "MG3c95c22cb05574f545cc1b32d9db4600";

      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
        const smsBody = `Hi ${firstName}, Fluff & Scruff Studio has sent you a payment request for £${amountNum.toFixed(2)}.${notes ? ` Note: ${notes}` : ""}\n\nPay here: ${paymentLink.url}\n\nQuestions? Call 01708 606655 or WhatsApp +44 7476 452782`;

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const formData = new URLSearchParams();
        formData.append("To", customer_phone);
        formData.append("MessagingServiceSid", MESSAGING_SERVICE_SID);
        formData.append("Body", smsBody);

        const twilioRes = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          },
          body: formData.toString(),
        });

        if (!twilioRes.ok) {
          const err = await twilioRes.text();
          console.error("Twilio SMS failed:", err);
        } else {
          // Log SMS in sms_messages table
          const twilioData = await twilioRes.json();
          await supabase.from("sms_messages").insert({
            phone_number: customer_phone,
            body: smsBody,
            direction: "outbound",
            status: "sent",
            twilio_sid: twilioData.sid || null,
            sent_by_name: "System",
          });
        }
      }
    }

    // Determine delivery method for audit
    const deliveryMethod = sendEmail && sendSms ? "email & SMS" : sendSms ? "SMS" : "email";

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "PAY_LINK_CREATED",
      details: `Ad-hoc pay link of £${amountNum.toFixed(2)} sent via ${deliveryMethod} to ${customer_email}${notes ? ` — ${notes}` : ""}`,
    });

    return new Response(JSON.stringify({ success: true, id: payLinkRecord.id, url: paymentLink.url }), {
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
