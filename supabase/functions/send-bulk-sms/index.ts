import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 5;
const DELAY_MS = 500;
const MAX_RETRIES = 3;
const MESSAGING_SERVICE_SID = "MG3c95c22cb05574f545cc1b32d9db4600";

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeUkMobile(raw: string): string | null {
  if (!raw) return null;
  let phone = raw.trim().replace(/\s+/g, "").replace(/-/g, "");
  if (phone.startsWith("07")) phone = "+44" + phone.slice(1);
  else if (phone.startsWith("447")) phone = "+" + phone;
  else if (phone.startsWith("+447")) { /* ok */ }
  else return null;
  if (!/^\+44\d{10}$/.test(phone)) return null;
  if (!phone.startsWith("+447")) return null;
  return phone;
}

// Simple hash for phone privacy in link tracking
async function hashPhone(phone: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(phone + "fluffscruff_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Replace URLs in message body with trackable redirects
async function makeTrackableMessage(
  body: string,
  campaignName: string,
  phone: string,
): Promise<string> {
  const phoneHash = await hashPhone(phone);
  // Match http/https URLs
  return body.replace(
    /(https?:\/\/[^\s]+)/g,
    (url: string) => {
      const trackUrl = `https://fluffandscruff.co.uk/track?c=${encodeURIComponent(campaignName)}&p=${phoneHash}&url=${encodeURIComponent(url)}`;
      return trackUrl;
    }
  );
}

async function sendOneSms(
  phone: string,
  body: string,
  twilioUrl: string,
  authHeader: string,
  statusCallbackUrl: string,
): Promise<{ ok: boolean; error?: string; sid?: string }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const params = new URLSearchParams();
      params.append("To", phone);
      params.append("MessagingServiceSid", MESSAGING_SERVICE_SID);
      params.append("Body", body);
      params.append("StatusCallback", statusCallbackUrl);

      const res = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${authHeader}`,
        },
        body: params.toString(),
      });

      if (res.ok) {
        const data = await res.json();
        return { ok: true, sid: data.sid };
      }

      if (res.status === 429) {
        console.warn(`429 for ${phone}, attempt ${attempt + 1}/${MAX_RETRIES}`);
        await delay(1000);
        continue;
      }

      const errText = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errText.substring(0, 300)}` };
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) {
        return { ok: false, error: String(err).substring(0, 300) };
      }
      await delay(1000);
    }
  }
  return { ok: false, error: `rate_limit_exceeded after ${MAX_RETRIES} retries` };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error("Twilio credentials not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authReqHeader = req.headers.get("Authorization");
    if (!authReqHeader) throw new Error("Not authenticated");
    const token = authReqHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Not authenticated");

    const { message, campaignName, filter, retryFailed, existingCampaignName } = await req.json();
    if (!message) throw new Error("message is required");

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-sms-status`;

    // Retry failed mode
    if (retryFailed && existingCampaignName) {
      const { data: failedLogs } = await supabase
        .from("bulk_sms_log")
        .select("phone, customer_name")
        .eq("campaign_name", existingCampaignName)
        .eq("status", "failed");

      if (!failedLogs?.length) {
        return new Response(JSON.stringify({ success: true, sent: 0, failed: 0, skipped: 0, noFailedToRetry: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("bulk_sms_log").delete()
        .eq("campaign_name", existingCampaignName)
        .eq("status", "failed");

      let sent = 0, failed = 0;
      for (let i = 0; i < failedLogs.length; i += BATCH_SIZE) {
        const batch = failedLogs.slice(i, i + BATCH_SIZE);
        for (const entry of batch) {
          const trackableMsg = await makeTrackableMessage(message, existingCampaignName, entry.phone);
          const result = await sendOneSms(entry.phone, trackableMsg, twilioUrl, twilioAuth, statusCallbackUrl);
          const status = result.ok ? "sent" : "failed";
          await supabase.from("bulk_sms_log").insert({
            campaign_name: existingCampaignName, message, phone: entry.phone,
            customer_name: entry.customer_name, status, error_message: result.error || null,
            twilio_message_sid: result.sid || null,
          });
          if (result.ok) sent++; else failed++;
        }
        if (i + BATCH_SIZE < failedLogs.length) await delay(DELAY_MS);
      }

      return new Response(JSON.stringify({ success: true, sent, failed, skipped: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build recipient list from migrated_customers + bookings
    const phoneMap = new Map<string, { phone: string; name: string }>();

    // Exclude sms_unreachable customers
    const { data: migratedCustomers } = await supabase
      .from("migrated_customers")
      .select("phone, full_name, sms_unreachable")
      .not("phone", "is", null);

    for (const mc of (migratedCustomers || [])) {
      if (!mc.phone || mc.sms_unreachable) continue;
      const normalized = normalizeUkMobile(mc.phone);
      if (normalized && !phoneMap.has(normalized)) {
        phoneMap.set(normalized, { phone: normalized, name: mc.full_name || "Customer" });
      }
    }

    const { data: bookings } = await supabase
      .from("bookings")
      .select("customer_phone, customer_name, booking_date, status")
      .not("customer_phone", "is", null);

    const today = new Date().toISOString().slice(0, 10);
    const hasUpcoming = new Set<string>();

    for (const b of (bookings || [])) {
      if (!b.customer_phone) continue;
      const normalized = normalizeUkMobile(b.customer_phone);
      if (!normalized) continue;
      if (!phoneMap.has(normalized)) {
        phoneMap.set(normalized, { phone: normalized, name: b.customer_name || "Customer" });
      }
      if (b.booking_date >= today && (b.status === "Pending" || b.status === "Confirmed")) {
        hasUpcoming.add(normalized);
      }
    }

    let recipients = Array.from(phoneMap.values());

    if (filter === "has_upcoming") {
      recipients = recipients.filter(r => hasUpcoming.has(r.phone));
    } else if (filter === "no_upcoming") {
      recipients = recipients.filter(r => !hasUpcoming.has(r.phone));
    }

    // Resume logic
    const cName = campaignName || `Bulk SMS ${new Date().toISOString().slice(0, 16)}`;
    const { data: alreadyProcessed } = await supabase
      .from("bulk_sms_log")
      .select("phone")
      .eq("campaign_name", cName)
      .in("status", ["sent", "skipped"]);

    if (alreadyProcessed?.length) {
      const processedSet = new Set(alreadyProcessed.map((r: any) => r.phone));
      recipients = recipients.filter(r => !processedSet.has(r.phone));
      console.log(`Resume: ${alreadyProcessed.length} already processed, ${recipients.length} remaining`);
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, failed: 0, skipped: 0, total: phoneMap.size, campaignName: cName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0, failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      for (const recipient of batch) {
        const trackableMsg = await makeTrackableMessage(message, cName, recipient.phone);
        const result = await sendOneSms(recipient.phone, trackableMsg, twilioUrl, twilioAuth, statusCallbackUrl);
        const status = result.ok ? "sent" : "failed";
        await supabase.from("bulk_sms_log").insert({
          campaign_name: cName, message, phone: recipient.phone,
          customer_name: recipient.name, status, error_message: result.error || null,
          twilio_message_sid: result.sid || null,
        });
        if (result.ok) sent++; else failed++;
      }
      if (i + BATCH_SIZE < recipients.length) await delay(DELAY_MS);
    }

    return new Response(JSON.stringify({
      success: true, sent, failed, skipped: 0,
      total: phoneMap.size, campaignName: cName,
      remaining: recipients.length - (sent + failed),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
