import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function isValidE164(phone: string): boolean {
  return E164_REGEX.test(phone.replace(/\s/g, ""));
}

function normalizePhone(phone: string): string | null {
  let clean = phone.replace(/\s/g, "");
  if (clean.startsWith("0")) {
    clean = "+44" + clean.slice(1);
  }
  return isValidE164(clean) ? clean : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Twilio credentials are not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const results: string[] = [];
    const errors: string[] = [];
    const skipped: string[] = [];

    // 24h window: 23h to 24.5h from now
    const h24From = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const h24To = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

    // 2h window: 1.5h to 2.5h from now
    const h2From = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
    const h2To = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

    // ─── 1. Standard bookings ───
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, booking_date, booking_time, customer_name, customer_phone, sms_24h_sent, sms_2h_sent")
      .not("customer_phone", "is", null)
      .in("status", ["Confirmed", "Pending", "Completed"]);

    if (error) throw error;

    for (const b of bookings || []) {
      if (!b.customer_phone) continue;

      const cleanPhone = normalizePhone(b.customer_phone);
      if (!cleanPhone) {
        skipped.push(`Skipped ${b.customer_name}: invalid phone "${b.customer_phone}"`);
        continue;
      }

      const bookingDateTime = new Date(`${b.booking_date}T${b.booking_time}`);
      const timeFormatted = b.booking_time.substring(0, 5);

      // 24h reminder
      if (!b.sms_24h_sent && bookingDateTime >= h24From && bookingDateTime <= h24To) {
        const message = `Hi ${b.customer_name}, reminder of your appt at Fluff and Scruff tomorrow at ${timeFormatted}. Address: 138 Hillview Avenue, Hornchurch RM11 2DL. See you then!`;
        try {
          await sendTwilioSms(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, cleanPhone, message);
          await supabase.from("bookings").update({ sms_24h_sent: true }).eq("id", b.id);
          await supabase.from("sms_messages").insert({
            phone_number: cleanPhone, body: message, direction: "outbound", status: "sent", booking_id: b.id,
          });
          results.push(`24h reminder sent to ${b.customer_name}`);
        } catch (err) {
          errors.push(`24h reminder failed for ${b.customer_name}: ${err.message}`);
        }
      }

      // 2h reminder
      if (!b.sms_2h_sent && bookingDateTime >= h2From && bookingDateTime <= h2To) {
        const message = `Hi ${b.customer_name}, just a quick reminder of your appointment at Fluff and Scruff Studio in 2 hours (${timeFormatted}). Address: 138 Hillview Avenue, Hornchurch RM11 2DL. See you soon!`;
        try {
          await sendTwilioSms(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, cleanPhone, message);
          await supabase.from("bookings").update({ sms_2h_sent: true }).eq("id", b.id);
          await supabase.from("sms_messages").insert({
            phone_number: cleanPhone, body: message, direction: "outbound", status: "sent", booking_id: b.id,
          });
          results.push(`2h reminder sent to ${b.customer_name}`);
        } catch (err) {
          errors.push(`2h reminder failed for ${b.customer_name}: ${err.message}`);
        }
      }
    }

    // ─── 2. Migrated bookings ───
    const { data: migratedBookings, error: mbError } = await supabase
      .from("migrated_bookings")
      .select("id, booking_date, booking_time, migrated_customer_id, dog_name, staff_name, sms_24h_sent, sms_2h_sent, payment_status, migrated_customers(phone, full_name)")
      .eq("is_future_booking", true)
      .not("payment_status", "eq", "Cancelled");

    if (mbError) {
      console.error("Error fetching migrated bookings:", mbError);
    }

    for (const mb of migratedBookings || []) {
      const customer = mb.migrated_customers as any;
      if (!customer?.phone) {
        skipped.push(`Skipped migrated ${customer?.full_name || mb.id}: no phone`);
        continue;
      }

      const cleanPhone = normalizePhone(customer.phone);
      if (!cleanPhone) {
        skipped.push(`Skipped migrated ${customer.full_name}: invalid phone "${customer.phone}"`);
        continue;
      }

      const bookingTime = mb.booking_time || "09:00:00";
      const bookingDateTime = new Date(`${mb.booking_date}T${bookingTime}`);
      const timeFormatted = bookingTime.substring(0, 5);
      const customerName = customer.full_name || "Customer";

      // 24h reminder
      if (!mb.sms_24h_sent && bookingDateTime >= h24From && bookingDateTime <= h24To) {
        const message = `Hi ${customerName}, reminder of your appt at Fluff and Scruff tomorrow at ${timeFormatted}. Address: 138 Hillview Avenue, Hornchurch RM11 2DL. See you then!`;
        try {
          await sendTwilioSms(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, cleanPhone, message);
          await supabase.from("migrated_bookings").update({ sms_24h_sent: true }).eq("id", mb.id);
          await supabase.from("sms_messages").insert({
            phone_number: cleanPhone, body: message, direction: "outbound", status: "sent",
          });
          results.push(`24h reminder sent to migrated ${customerName}`);
        } catch (err) {
          errors.push(`24h reminder failed for migrated ${customerName}: ${err.message}`);
        }
      }

      // 2h reminder
      if (!mb.sms_2h_sent && bookingDateTime >= h2From && bookingDateTime <= h2To) {
        const message = `Hi ${customerName}, just a quick reminder of your appointment at Fluff and Scruff Studio in 2 hours (${timeFormatted}). Address: 138 Hillview Avenue, Hornchurch RM11 2DL. See you soon!`;
        try {
          await sendTwilioSms(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, cleanPhone, message);
          await supabase.from("migrated_bookings").update({ sms_2h_sent: true }).eq("id", mb.id);
          await supabase.from("sms_messages").insert({
            phone_number: cleanPhone, body: message, direction: "outbound", status: "sent",
          });
          results.push(`2h reminder sent to migrated ${customerName}`);
        } catch (err) {
          errors.push(`2h reminder failed for migrated ${customerName}: ${err.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: results.length, results, errors, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendTwilioSms(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string
): Promise<void> {
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const authHeader = btoa(`${accountSid}:${authToken}`);

  const params = new URLSearchParams();
  params.append("To", to);
  params.append("From", from);
  params.append("Body", body);

  const res = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${authHeader}`,
    },
    body: params.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Twilio error: ${res.status}`);
  }
}
