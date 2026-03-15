import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 5;
const DELAY_MS = 1000;
const MAX_RETRIES = 3;
const MESSAGING_SERVICE_SID = "MG3c95c22cb05574f545cc1b32d9db4600";

type TwilioConfig = {
  accountSid: string;
  twilioUrl: string;
  authHeader: string;
};

function getTwilioConfig(): TwilioConfig {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured");
  }

  if (!accountSid.startsWith("AC")) {
    throw new Error("Twilio Account SID is invalid (must start with AC)");
  }

  return {
    accountSid,
    twilioUrl: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    authHeader: btoa(`${accountSid}:${authToken}`),
  };
}

async function verifyTwilioCredentials(accountSid: string, authHeader: string): Promise<void> {
  const verifyUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;

  const res = await fetch(verifyUrl, {
    method: "GET",
    headers: {
      Authorization: `Basic ${authHeader}`,
    },
  });

  if (res.ok) {
    await res.text();
    return;
  }

  const raw = await res.text();

  if (res.status === 401) {
    throw new Error("Twilio authentication failed (20003). Update TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN.");
  }

  let details = raw.slice(0, 300);
  try {
    const parsed = JSON.parse(raw);
    details = parsed?.message || parsed?.detail || details;
  } catch {
    // keep raw details
  }

  throw new Error(`Twilio auth precheck failed (HTTP ${res.status}): ${details}`);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeUkMobile(raw: string): string | null {
  if (!raw) return null;
  let phone = raw.trim().replace(/\s+/g, "").replace(/-/g, "").replace(/\(/g, "").replace(/\)/g, "");
  if (phone.startsWith("+440")) phone = "+44" + phone.slice(4);
  if (phone.startsWith("07")) phone = "+44" + phone.slice(1);
  else if (phone.startsWith("7") && phone.length === 10) phone = "+44" + phone;
  else if (phone.startsWith("447") && !phone.startsWith("+")) phone = "+" + phone;
  else if (phone.startsWith("+447")) { /* already correct */ }
  else return null;
  if (!/^\+447\d{9}$/.test(phone)) return null;
  return phone;
}

async function hashPhone(phone: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(phone + "fluffscruff_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function makeTrackableMessage(
  body: string,
  campaignName: string,
  phone: string,
): Promise<string> {
  const phoneHash = await hashPhone(phone);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return body.replace(
    /(?:https?:\/\/[^\s]+|(?<![\/\w@])(?:[a-zA-Z0-9-]+\.)+(?:co\.uk|com|org|net|io|app|dev|uk|me|info|biz|shop|store)(?:\/[^\s]*)?)/g,
    (url: string) => {
      const fullUrl = url.startsWith("http") ? url : `https://${url}`;
      return `${supabaseUrl}/functions/v1/sms-track?c=${encodeURIComponent(campaignName)}&p=${phoneHash}&url=${encodeURIComponent(fullUrl)}`;
    }
  );
}

async function sendOneSms(
  phone: string,
  body: string,
  twilioUrl: string,
  authHeader: string,
  statusCallbackUrl: string,
): Promise<{ ok: boolean; error?: string; sid?: string; errorCode?: string }> {
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
      // Try to extract error code from Twilio response
      let errorCode: string | undefined;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.code) errorCode = String(errJson.code);
      } catch { /* not JSON */ }
      return { ok: false, error: `HTTP ${res.status}: ${errText.substring(0, 300)}`, errorCode };
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) {
        return { ok: false, error: String(err).substring(0, 300) };
      }
      await delay(1000);
    }
  }
  return { ok: false, error: `rate_limit_exceeded after ${MAX_RETRIES} retries` };
}

// Auto-flag 30005 (unknown destination) numbers as sms_unreachable
async function flagUnreachableNumbers(supabase: any, campaignName: string) {
  try {
    const { data: unreachable } = await supabase
      .from("bulk_sms_log")
      .select("phone, customer_name")
      .eq("campaign_name", campaignName)
      .eq("status", "failed")
      .like("error_message", "%30005%");

    if (!unreachable?.length) return;

    console.log(`Flagging ${unreachable.length} numbers as sms_unreachable`);

    for (const entry of unreachable) {
      // Flag in migrated_customers
      await supabase
        .from("migrated_customers")
        .update({ sms_unreachable: true })
        .eq("phone", entry.phone);

      // Also try matching by normalized phone variants
      const rawPhone = entry.phone.replace("+44", "0");
      await supabase
        .from("migrated_customers")
        .update({ sms_unreachable: true })
        .eq("phone", rawPhone);

      // Find customer email to add a note
      const { data: customers } = await supabase
        .from("migrated_customers")
        .select("email")
        .or(`phone.eq.${entry.phone},phone.eq.${rawPhone}`)
        .limit(1);

      if (customers?.[0]?.email) {
        await supabase.from("customer_notes").insert({
          customer_email: customers[0].email,
          note: `⚠️ Check number — SMS to ${entry.phone} failed (invalid/disconnected number, error 30005). Please verify phone number at next visit.`,
          created_by: "00000000-0000-0000-0000-000000000000",
        });
      }

      // Also check bookings for matching phone
      const { data: bookingCustomers } = await supabase
        .from("bookings")
        .select("customer_email")
        .eq("customer_phone", entry.phone)
        .not("customer_email", "is", null)
        .limit(1);

      if (bookingCustomers?.[0]?.customer_email && (!customers?.[0]?.email || bookingCustomers[0].customer_email !== customers[0].email)) {
        await supabase.from("customer_notes").insert({
          customer_email: bookingCustomers[0].customer_email,
          note: `⚠️ Check number — SMS to ${entry.phone} failed (invalid/disconnected number, error 30005). Please verify phone number at next visit.`,
          created_by: "00000000-0000-0000-0000-000000000000",
        });
      }
    }
  } catch (err) {
    console.error("Error flagging unreachable numbers:", err);
  }
}

// Background processing function for bulk sends
async function processBulkSend(
  recipients: { phone: string; name: string }[],
  fullMessage: string,
  campaignName: string,
  message: string,
  twilioUrl: string,
  twilioAuth: string,
  statusCallbackUrl: string,
  supabase: any,
) {
  let sent = 0, failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    for (const recipient of batch) {
      const trackableMsg = await makeTrackableMessage(fullMessage, campaignName, recipient.phone);
      const result = await sendOneSms(recipient.phone, trackableMsg, twilioUrl, twilioAuth, statusCallbackUrl);
      const status = result.ok ? "sent" : "failed";
      await supabase.from("bulk_sms_log").insert({
        campaign_name: campaignName, message, phone: recipient.phone,
        customer_name: recipient.name, status, error_message: result.error || null,
        twilio_message_sid: result.sid || null,
      });
      if (result.ok) sent++; else failed++;
    }
    if (i + BATCH_SIZE < recipients.length) await delay(DELAY_MS);
  }

  console.log(`Bulk send complete: ${sent} sent, ${failed} failed out of ${recipients.length}`);

  // Auto-flag unreachable numbers after sending
  await flagUnreachableNumbers(supabase, campaignName);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { accountSid, twilioUrl, authHeader: twilioAuth } = getTwilioConfig();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authReqHeader = req.headers.get("Authorization");
    if (!authReqHeader) throw new Error("Not authenticated");
    const token = authReqHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Not authenticated");

    const { message, campaignName, filter, retryFailed, existingCampaignName, manualNumbers } = await req.json();
    if (!message) throw new Error("message is required");

    // Auto-append STOP instruction
    const STOP_SUFFIX = " Reply STOP to unsubscribe.";
    const fullMessage = message.endsWith(STOP_SUFFIX) ? message : message + STOP_SUFFIX;

    // Validate credentials once up front so we fail fast instead of logging hundreds of auth failures.
    await verifyTwilioCredentials(accountSid, twilioAuth);

    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-sms-status`;

    // Retry failed mode — use background processing
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

      // Delete failed records before re-sending
      await supabase.from("bulk_sms_log").delete()
        .eq("campaign_name", existingCampaignName)
        .eq("status", "failed");

      const retryRecipients = failedLogs.map((entry: any) => ({ phone: entry.phone, name: entry.customer_name || "Customer" }));

      // Process in background — return immediately
      EdgeRuntime.waitUntil(
        processBulkSend(retryRecipients, fullMessage, existingCampaignName, message, twilioUrl, twilioAuth, statusCallbackUrl, supabase)
          .catch(err => console.error("Background retry error:", err))
      );

      return new Response(JSON.stringify({
        success: true, sent: 0, failed: 0, skipped: 0,
        background: true, totalQueued: retryRecipients.length,
        campaignName: existingCampaignName,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build recipient list
    const phoneMap = new Map<string, { phone: string; name: string }>();

    if (filter === "manual" && Array.isArray(manualNumbers)) {
      for (const raw of manualNumbers) {
        const normalized = normalizeUkMobile(raw);
        if (normalized && !phoneMap.has(normalized)) {
          phoneMap.set(normalized, { phone: normalized, name: "Manual" });
        }
      }
    } else {
      const { data: migratedCustomers } = await supabase
        .from("migrated_customers")
        .select("phone, full_name, sms_unreachable, sms_opt_out")
        .not("phone", "is", null);

      for (const mc of (migratedCustomers || [])) {
        if (!mc.phone || mc.sms_unreachable || mc.sms_opt_out) continue;
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

      if (filter === "has_upcoming") {
        for (const [key] of phoneMap) {
          if (!hasUpcoming.has(key)) phoneMap.delete(key);
        }
      } else if (filter === "no_upcoming") {
        for (const [key] of phoneMap) {
          if (hasUpcoming.has(key)) phoneMap.delete(key);
        }
      }
    }

    let recipients = Array.from(phoneMap.values());

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

    // For large sends (>50 recipients), use background processing
    if (recipients.length > 50) {
      EdgeRuntime.waitUntil(
        processBulkSend(recipients, fullMessage, cName, message, twilioUrl, twilioAuth, statusCallbackUrl, supabase)
          .catch(err => console.error("Background send error:", err))
      );

      return new Response(JSON.stringify({
        success: true, sent: 0, failed: 0, skipped: 0,
        background: true, totalQueued: recipients.length,
        total: phoneMap.size, campaignName: cName,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Small sends — process inline
    let sent = 0, failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      for (const recipient of batch) {
        const trackableMsg = await makeTrackableMessage(fullMessage, cName, recipient.phone);
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

    // Flag unreachable numbers for inline sends too
    await flagUnreachableNumbers(supabase, cName);

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
