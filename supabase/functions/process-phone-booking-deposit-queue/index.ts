import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MESSAGING_SERVICE_SID = "MG3c95c22cb05574f545cc1b32d9db4600";
const ORIGIN = "https://fluffandscruff.co.uk";

async function sendSms(phone: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) throw new Error("Twilio credentials missing");
  const params = new URLSearchParams();
  params.append("To", phone);
  params.append("MessagingServiceSid", MESSAGING_SERVICE_SID);
  params.append("Body", body);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      },
      body: params.toString(),
    },
  );
  if (!res.ok) throw new Error(`Twilio: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY missing" }, 500);
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  // Fetch pending entries that are at least 3 minutes old.
  const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data: queue, error } = await supabase
    .from("phone_booking_deposit_queue")
    .select("id, booking_id, customer_phone, customer_name, created_at")
    .eq("status", "pending")
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) return json({ error: error.message }, 500);

  const results: any[] = [];

  for (const row of queue || []) {
    try {
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, total_price, dog_name, customer_name, customer_email, services(name)")
        .eq("id", row.booking_id)
        .maybeSingle();

      if (!booking) {
        await supabase.from("phone_booking_deposit_queue")
          .update({ status: "error", last_error: "Booking not found" })
          .eq("id", row.id);
        continue;
      }

      const total = Number((booking as any).total_price || 0);
      const depositAmount = Math.round(total * 0.6 * 100);
      if (depositAmount < 30) {
        await supabase.from("phone_booking_deposit_queue")
          .update({ status: "error", last_error: "Deposit below Stripe minimum" })
          .eq("id", row.id);
        continue;
      }

      const serviceName = (booking as any).services?.name || "Dog Grooming";
      const dogName = (booking as any).dog_name || "your pup";

      const session = await stripe.checkout.sessions.create({
        customer_email: (booking as any).customer_email || undefined,
        line_items: [{
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Deposit — ${serviceName}`,
              description: `60% deposit for ${dogName}'s appointment`,
            },
            unit_amount: depositAmount,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${ORIGIN}/booking-success?booking_id=${booking.id}&payment_type=deposit`,
        cancel_url: `${ORIGIN}/?deposit_cancelled=true&booking_id=${booking.id}`,
        metadata: {
          booking_id: booking.id,
          customer_name: (booking as any).customer_name || "",
          dog_name: dogName,
          total_price: String(total),
          payment_type: "deposit",
          payment_amount: String(depositAmount / 100),
          source: "phone_ai",
        },
      });

      const first =
        (row.customer_name || (booking as any).customer_name || "there")
          .split(" ")[0];
      const smsBody =
        `Hi ${first}, to confirm ${dogName}'s grooming appointment at ` +
        `Fluff & Scruff Studio please pay your 60% deposit of £${(depositAmount / 100).toFixed(2)} ` +
        `here: ${session.url} — questions? Call 01708 606655.`;

      await sendSms(row.customer_phone, smsBody);

      await supabase.from("phone_booking_deposit_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);

      results.push({ id: row.id, status: "sent" });
    } catch (e: any) {
      console.error("[deposit-queue] failed", row.id, e);
      await supabase.from("phone_booking_deposit_queue")
        .update({ status: "failed", last_error: String(e?.message || e) })
        .eq("id", row.id);
      results.push({ id: row.id, status: "failed", error: String(e?.message || e) });
    }
  }

  return json({ processed: results.length, results });
});