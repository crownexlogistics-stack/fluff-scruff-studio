import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Not authenticated");

    const userId = claimsData.claims.sub as string;

    // Check director role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "director")
      .maybeSingle();

    if (!roleData) throw new Error("Only directors can process refunds");

    const { booking_id, partial_amount } = await req.json();
    if (!booking_id) throw new Error("Missing booking_id");

    // Get the booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id, stripe_payment_id, deposit_paid, total_price, customer_name, customer_email, dog_name, booking_date, booking_time, status")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) throw new Error("Booking not found");
    if (!booking.stripe_payment_id) throw new Error("No Stripe payment found for this booking");

    const normalizedStatus = (booking.status || "").trim().toLowerCase();
    if (normalizedStatus.includes("refund")) {
      throw new Error("Booking is already refunded");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let refund: Stripe.Refund;

    // Process refund via Stripe (idempotent fallback for already-refunded intents)
    try {
      refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_id,
      });
    } catch (stripeError: any) {
      const message = String(stripeError?.message || "").toLowerCase();
      const alreadyRefunded =
        message.includes("already been refunded") ||
        message.includes("already refunded") ||
        message.includes("charge has already been refunded");

      if (!alreadyRefunded) throw stripeError;

      const existingRefunds = await stripe.refunds.list({
        payment_intent: booking.stripe_payment_id,
        limit: 1,
      });

      if (!existingRefunds.data.length) {
        throw new Error("Payment appears refunded in Stripe but no refund record was returned");
      }

      refund = existingRefunds.data[0];
    }

    const refundAmount = refund.amount / 100;

    // Update booking status (must succeed)
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({ status: "Refunded" })
      .eq("id", booking_id);

    if (updateError) {
      throw new Error(`Refunded in Stripe but failed to update booking status: ${updateError.message}`);
    }

    // Log audit trail
    await supabaseAdmin
      .from("audit_logs")
      .insert({
        user_id: userId,
        action: "REFUND_PROCESSED",
        details: `Refunded £${refundAmount.toFixed(2)} for ${booking.customer_name}. Stripe Refund ID: ${refund.id}. Original Payment: ${booking.stripe_payment_id}`,
      });

    // Send refund confirmation email to customer
    if (booking.customer_email) {
      const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
      if (SENDGRID_API_KEY) {
        const bookingDateFormatted = new Date(booking.booking_date).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const bookingTimeFormatted = booking.booking_time?.slice(0, 5) || "";

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #333; font-size: 22px; margin: 0;">Refund Confirmation</h1>
            </div>
            
            <p style="color: #333; font-size: 15px; line-height: 1.6;">Hi ${booking.customer_name.split(" ")[0]},</p>
            
            <p style="color: #333; font-size: 15px; line-height: 1.6;">
              We're writing to confirm that your refund of <strong>£${refundAmount.toFixed(2)}</strong> has been processed for your appointment:
            </p>
            
            <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #e74c3c;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #333;">${booking.dog_name}'s Appointment — Cancelled</p>
              <p style="margin: 0; color: #666; font-size: 14px;">${bookingDateFormatted} at ${bookingTimeFormatted}</p>
            </div>

            <div style="background: #e8f5e9; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #2e7d32;">💳 Refund Details</p>
              <p style="margin: 0 0 4px 0; color: #333; font-size: 14px;"><strong>Amount:</strong> £${refundAmount.toFixed(2)}</p>
              <p style="margin: 0 0 4px 0; color: #333; font-size: 14px;"><strong>Refund ID:</strong> ${refund.id}</p>
              <p style="margin: 0; color: #333; font-size: 14px;"><strong>Estimated arrival:</strong> 5–10 business days</p>
            </div>

            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              The refund will be returned to your original payment method. Please allow <strong>5–10 business days</strong> for the funds to appear in your account, depending on your bank or card provider.
            </p>

            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              If you have any questions, feel free to call us on <strong>01708 606655</strong> or reply to this email.
            </p>

            <p style="color: #333; font-size: 15px; line-height: 1.6; margin-top: 24px;">
              Warm regards,<br/>
              <strong>Fluff & Scruff Studio</strong>
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
          </div>
        `;

        try {
          const emailRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SENDGRID_API_KEY}`,
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: booking.customer_email }] }],
              from: { email: "info@fluffandscruff.co.uk", name: "Fluff & Scruff Studio" },
              reply_to: { email: "info@fluffandscruff.co.uk" },
              subject: `Refund Confirmed — £${refundAmount.toFixed(2)} for ${booking.dog_name}'s Appointment`,
              content: [{ type: "text/html", value: htmlBody }],
            }),
          });

          if (!emailRes.ok) {
            const errText = await emailRes.text();
            console.error("SendGrid refund email error:", errText);
          } else {
            // Log the communication
            await supabaseAdmin.from("customer_communications").insert({
              customer_email: booking.customer_email,
              type: "email",
              subject: `Refund Confirmed — £${refundAmount.toFixed(2)}`,
              body: `Refund of £${refundAmount.toFixed(2)} processed. Stripe Refund ID: ${refund.id}. Estimated arrival: 5–10 business days.`,
              direction: "outbound",
              sent_by: userId,
            });
          }
        } catch (emailErr) {
          console.error("Failed to send refund email:", emailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refund.id,
        amount: refundAmount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Refund error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
