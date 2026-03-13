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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate the caller
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { booking_id, cancelled_by } = await req.json();
    if (!booking_id) throw new Error("Missing booking_id");

    // Get the booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id, stripe_payment_id, deposit_paid, total_price, customer_name, customer_email, dog_name, booking_date, booking_time, status, staff_id")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) throw new Error("Booking not found");
    if (booking.status === "Cancelled" || booking.status === "Refunded") {
      throw new Error("Booking is already cancelled");
    }

    // Check if 48+ hours before appointment
    const appointmentDateTime = new Date(`${booking.booking_date}T${booking.booking_time || "09:00"}`);
    const now = new Date();
    const hoursUntil = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isRefundEligible = hoursUntil >= 48;

    let refundId: string | null = null;
    let refundAmount = 0;

    // Process Stripe refund if eligible and has payment
    if (isRefundEligible && booking.stripe_payment_id && Number(booking.deposit_paid) > 0) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        try {
          const refund = await stripe.refunds.create({
            payment_intent: booking.stripe_payment_id,
          });
          refundId = refund.id;
          refundAmount = refund.amount / 100;
        } catch (stripeErr: any) {
          console.error("Stripe refund error:", stripeErr.message);
          // Still cancel the booking even if refund fails
        }
      }
    }

    // Update booking status
    const newStatus = refundId ? "Refunded" : "Cancelled";
    await supabaseAdmin
      .from("bookings")
      .update({ status: newStatus })
      .eq("id", booking_id);

    // Audit log
    const cancelledByLabel = cancelled_by === "customer" ? "Customer" : "Staff";
    const refundNote = refundId
      ? `Stripe refund of £${refundAmount.toFixed(2)} processed (${refundId}).`
      : isRefundEligible
        ? "No Stripe payment to refund."
        : "Within 48 hours — deposit retained per policy.";

    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "BOOKING_CANCELLED_WITH_REFUND",
      details: `${cancelledByLabel} cancelled booking for ${booking.customer_name} (${booking.dog_name}) on ${booking.booking_date}. ${refundNote}`,
    });

    // Send cancellation emails
    const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
    if (sendgridKey && booking.customer_email) {
      const refundMessage = refundId
        ? `Your deposit of £${refundAmount.toFixed(2)} has been refunded and will appear in your account within 5-10 business days.`
        : isRefundEligible
          ? "Your booking has been cancelled."
          : "Your deposit is non-refundable as this cancellation is within 48 hours of your appointment, as per our Terms & Conditions.";

      // Email to customer
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${sendgridKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: booking.customer_email }] }],
          from: { email: "info@fluffandscruff.co.uk", name: "Fluff & Scruff Studio" },
          subject: "Booking Cancelled — Fluff & Scruff Studio",
          content: [{
            type: "text/html",
            value: `<p>Hi ${booking.customer_name},</p><p>Your appointment for <strong>${booking.dog_name}</strong> on <strong>${booking.booking_date}</strong> has been cancelled.</p><p>${refundMessage}</p><p>If you have any questions, please don't hesitate to contact us.</p><p>Best wishes,<br/>Fluff & Scruff Studio</p>`,
          }],
        }),
      }).catch(() => {});

      // Notify groomer
      if (booking.staff_id) {
        try {
          await supabaseAdmin.functions.invoke("notify-groomer", {
            body: { booking_id, notification_type: "booking_cancelled" },
          });
        } catch {}
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        refunded: !!refundId,
        refund_id: refundId,
        refund_amount: refundAmount,
        hours_until_appointment: Math.round(hoursUntil),
        status: newStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Cancel error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
