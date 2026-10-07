import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkVoucher, notifyPurchaserRedeemed, REASON_TEXT } from "../_shared/giftVouchers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const {
      customer_name,
      customer_email,
      dog_name,
      service_name,
      total_price,
      booking_id,
      payment_type, // "deposit" or "full"
      voucher_code,
    } = await req.json();

    if (!total_price || !booking_id) {
      throw new Error("Missing required fields: total_price and booking_id");
    }

    const isFullPayment = payment_type === "full";
    const origin = req.headers.get("origin") || "https://fluffandscruff.co.uk";

    // ───────── Gift voucher path: everything is decided server-side ─────────
    if (voucher_code) {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: booking } = await sb
        .from("bookings")
        .select("id, total_price, status, booking_source, created_at, stripe_payment_id, voucher_code")
        .eq("id", booking_id)
        .maybeSingle();
      // Only a brand-new, unpaid online booking can take a voucher here
      const fresh = booking && Date.now() - new Date(booking.created_at).getTime() < 30 * 60_000;
      if (!booking || !fresh || booking.status !== "Pending" || booking.stripe_payment_id || booking.voucher_code || booking.booking_source !== "online") {
        return json({ error: "This booking can't take a voucher. Please start again." }, 400);
      }
      const r = await checkVoucher(sb, req, String(voucher_code));
      if (!r.ok) return json({ error: REASON_TEXT[r.reason], voucher_error: true }, 400);
      const v = r.voucher;

      const total = Number(booking.total_price || 0);
      if (!(total > 0)) return json({ error: "Invalid booking price" }, 400);
      const applied = Math.round(Math.min(Number(v.amount), total) * 100) / 100;
      const target = isFullPayment ? total : Math.round(total * 0.6 * 100) / 100;
      let charge = Math.round(Math.max(0, target - applied) * 100) / 100;
      if (charge > 0 && charge < 0.3) charge = 0; // too small for card; left as balance at salon

      if (charge === 0) {
        // Voucher covers the online payment → redeem atomically, then confirm
        const { data: red, error: redErr } = await sb.rpc("redeem_gift_voucher", {
          _code: v.code, _booking_id: booking.id, _amount_applied: applied, _channel: "online", _by: "Customer (online)", _from_reserved: false,
        });
        if (redErr || !red?.id) return json({ error: REASON_TEXT.used, voucher_error: true }, 409);
        await sb.from("bookings").update({
          status: "Confirmed", voucher_code: v.code, voucher_amount: applied, deposit_paid: applied,
        }).eq("id", booking.id);
        await sb.from("booking_audit_log").insert({
          booking_id: booking.id, event_type: "voucher_applied", performed_by: "Customer (online)",
          note: `Paid with gift voucher ${v.code}: £${applied.toFixed(2)} applied (voucher value £${Number(v.amount).toFixed(2)}). No card payment needed. Balance at salon: £${(total - applied).toFixed(2)}.`,
        });
        try { await sb.functions.invoke("send-booking-email", { body: { booking_id: booking.id, email_type: "confirmation" } }); } catch (e) { console.error(e); }
        try { await sb.functions.invoke("notify-groomer", { body: { booking_id: booking.id, notification_type: "new_booking" } }); } catch (e) { console.error(e); }
        await notifyPurchaserRedeemed(sb, red);
        return json({ url: `${origin}/booking-success?booking_id=${booking.id}&payment_type=voucher`, voucher_only: true });
      }

      // Partial: card pays the rest. Create session first, then hold the voucher.
      const session = await stripe.checkout.sessions.create({
        customer_email: customer_email || undefined,
        line_items: [{
          price_data: {
            currency: "gbp",
            product_data: {
              name: `${isFullPayment ? "Remaining payment" : "Remaining deposit"} — ${service_name || "Dog Grooming"}`,
              description: `After gift voucher ${v.code} (£${applied.toFixed(2)})`,
            },
            unit_amount: Math.round(charge * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${origin}/booking-success?booking_id=${booking_id}&payment_type=${payment_type || "deposit"}`,
        cancel_url: `${origin}/book?deposit_cancelled=true&booking_id=${booking_id}`,
        metadata: {
          booking_id, customer_name: customer_name || "", dog_name: dog_name || "",
          total_price: String(total), payment_type: payment_type || "deposit",
          payment_amount: String(charge), voucher_code: v.code, voucher_amount: String(applied),
        },
      });
      const { data: held } = await sb.rpc("reserve_gift_voucher", { _code: v.code, _booking_id: booking.id });
      if (!held?.id) {
        try { await stripe.checkout.sessions.expire(session.id); } catch (_) { /* ignore */ }
        return json({ error: REASON_TEXT.used, voucher_error: true }, 409);
      }
      await sb.from("bookings").update({ voucher_code: v.code, voucher_amount: applied }).eq("id", booking.id);
      await sb.from("booking_audit_log").insert({
        booking_id: booking.id, event_type: "voucher_held", performed_by: "Customer (online)",
        note: `Gift voucher ${v.code} held (£${applied.toFixed(2)}). Waiting for card payment of £${charge.toFixed(2)}.`,
      });
      return json({ url: session.url, charge });
    }

    // ───────── Normal path (unchanged) ─────────
    const paymentAmount = isFullPayment
      ? Math.round(total_price * 100)
      : Math.round(total_price * 0.6 * 100);

    if (paymentAmount < 30) {
      throw new Error("Payment amount too small for Stripe (minimum 30p)");
    }

    let customerId: string | undefined;
    if (customer_email) {
      const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const label = isFullPayment
      ? `Full Payment — ${service_name || "Dog Grooming"}`
      : `Deposit — ${service_name || "Dog Grooming"}`;

    const description = isFullPayment
      ? `Full payment for ${dog_name || "your pup"}'s appointment`
      : `60% deposit for ${dog_name || "your pup"}'s appointment`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customer_email || undefined,
      line_items: [{
        price_data: { currency: "gbp", product_data: { name: label, description }, unit_amount: paymentAmount },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/booking-success?booking_id=${booking_id}&payment_type=${payment_type || "deposit"}`,
      cancel_url: `${origin}/book?deposit_cancelled=true&booking_id=${booking_id}`,
      metadata: {
        booking_id,
        customer_name: customer_name || "",
        dog_name: dog_name || "",
        total_price: String(total_price),
        payment_type: payment_type || "deposit",
        payment_amount: String(paymentAmount / 100),
      },
    });

    return json({ url: session.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating checkout:", errorMessage);
    return json({ error: errorMessage }, 500);
  }
});
