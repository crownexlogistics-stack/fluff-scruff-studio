// AI Receptionist - Twilio Voice webhook handler
// Receives Twilio webhooks, talks to Claude, returns TwiML.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const FN_BASE = `${SUPABASE_URL}/functions/v1/ai-receptionist`;
const VOICE = "Google.en-GB-Neural2-C";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-6";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

function escapeXml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(body: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`;
  return new Response(xml, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/xml; charset=utf-8" },
  });
}

function gatherTwiml(sayText: string, callSid: string, hint?: string): string {
  const action = `${FN_BASE}?action=conversation&CallSid=${encodeURIComponent(callSid)}`;
  return `
    <Gather input="speech" action="${action}" method="POST" speechTimeout="auto" language="en-GB" actionOnEmptyResult="true">
      <Say voice="${VOICE}">${escapeXml(sayText)}</Say>
    </Gather>
    <Say voice="${VOICE}">I didn't hear anything. Goodbye.</Say>
    <Hangup/>
  `;
}

function transferTwiml(transferNumber: string, callSid: string, intro?: string): string {
  const action = `${FN_BASE}?action=transfer_complete&CallSid=${encodeURIComponent(callSid)}`;
  const intoSay = intro ? `<Say voice="${VOICE}">${escapeXml(intro)}</Say>` : "";
  return `
    ${intoSay}
    <Dial action="${action}" method="POST" timeout="25" callerId="${escapeXml(TWILIO_PHONE_NUMBER || "")}">
      <Number>${escapeXml(transferNumber)}</Number>
    </Dial>
  `;
}

function errorTransferTwiml(transferNumber: string): string {
  return `
    <Say voice="${VOICE}">I'm sorry, I'm having a technical difficulty. Let me transfer you to the salon directly.</Say>
    <Dial timeout="30" callerId="${escapeXml(TWILIO_PHONE_NUMBER || "")}">
      <Number>${escapeXml(transferNumber)}</Number>
    </Dial>
  `;
}

async function parseTwilioForm(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  // also stash raw for signature verification if needed later
  (out as any).__raw = text;
  return out;
}

// Verify Twilio signature (best-effort; logs but does not block if not configured)
async function verifyTwilio(req: Request, url: string, params: Record<string, string>): Promise<boolean> {
  if (!TWILIO_AUTH_TOKEN) return true;
  const sig = req.headers.get("X-Twilio-Signature");
  if (!sig) {
    console.warn("[ai-receptionist] missing X-Twilio-Signature");
    return false;
  }
  const keys = Object.keys(params).filter((k) => k !== "__raw").sort();
  let data = url;
  for (const k of keys) data += k + params[k];
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(TWILIO_AUTH_TOKEN),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
  const ok = b64 === sig;
  if (!ok) console.warn("[ai-receptionist] invalid Twilio signature");
  return ok;
}

// ---------- Settings & context ----------
async function loadSettings() {
  const { data } = await supabase.from("ai_receptionist_settings").select("*").limit(1).maybeSingle();
  return data;
}
async function loadHours() {
  const { data } = await supabase.from("ai_receptionist_hours").select("*").order("day_of_week");
  return data || [];
}
async function loadKnowledge() {
  const { data } = await supabase.from("ai_receptionist_knowledge").select("*").eq("is_active", true);
  return data || [];
}
async function loadServices() {
  const { data } = await supabase.from("services").select("name,description,duration_minutes").limit(50);
  return data || [];
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function todayInLondon(): { day: number; dateStr: string; timeStr: string } {
  const now = new Date();
  const fmtDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long" }).format(now);
  const day = DAY_NAMES.indexOf(fmtDay);
  const dateStr = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", dateStyle: "full" }).format(now);
  const timeStr = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeStyle: "short" }).format(now);
  return { day, dateStr, timeStr };
}

function isOpenNow(hours: any[]): { openToday: boolean; todayLine: string; full: string } {
  const { day, dateStr } = todayInLondon();
  const lines = hours.map((h) => {
    const d = DAY_NAMES[h.day_of_week];
    return h.is_open && h.open_time && h.close_time
      ? `${d}: ${h.open_time} – ${h.close_time}`
      : `${d}: Closed`;
  });
  const today = hours.find((h) => h.day_of_week === day);
  const openToday = !!(today?.is_open && today?.open_time && today?.close_time);
  const todayLine = `Today is ${dateStr}, the salon is ${openToday ? `OPEN (${today.open_time} – ${today.close_time})` : "CLOSED"}`;
  return { openToday, todayLine, full: lines.join("\n") };
}

async function buildSystemPrompt(): Promise<string> {
  const [hours, knowledge, services] = await Promise.all([loadHours(), loadKnowledge(), loadServices()]);
  const h = isOpenNow(hours);
  const svcLines = services.map((s) => `- ${s.name}${s.duration_minutes ? ` (${s.duration_minutes} min)` : ""}${s.description ? ` — ${s.description}` : ""}`).join("\n");
  const kbLines = knowledge.map((k) => `Q: ${k.question}\nA: ${k.answer}`).join("\n\n");

  return `You are the AI receptionist for Fluff and Scruff Studio, a premium dog grooming salon in Hornchurch, Essex.

You are speaking on the phone so:
- Keep responses SHORT — maximum 2-3 sentences
- Never use bullet points or lists
- Speak naturally as if talking to someone
- Always be warm and friendly
- Never say "As an AI" or similar

SALON INFORMATION:
Address: 138 Hillview Avenue, Hornchurch RM11 2DL
Phone: 01708 606655
Website: fluffandscruff.co.uk

OPENING HOURS:
${h.full}
${h.todayLine}

SERVICES:
${svcLines || "(see knowledge base)"}

KNOWLEDGE BASE:
${kbLines || "(none)"}

WHAT YOU CAN DO:
1. Answer questions about services, prices, hours and location
2. Book new appointments — ask for: dog's name and breed, service, preferred date and time, owner's name and phone number, then confirm
3. Take a message if the salon is closed
4. Transfer to a groomer if the caller asks to speak to someone directly

TRANSFERRING TO GROOMER:
If the caller wants to speak to someone, check on their dog, or asks something you cannot answer, say: "Let me transfer you to the salon now, one moment please" and end your response with exactly: [TRANSFER]

BOOKING AN APPOINTMENT:
When you have all details, end with: [BOOK: name=X, dog=X, breed=X, service=X, date=X, time=X, phone=X]

TAKING A MESSAGE:
End with: [MESSAGE: caller=X, number=X, message=X]

ENDING THE CALL:
Say goodbye warmly and end with: [END]

Keep all responses under 40 words. Never read out long lists. If asked about prices for Full Groom or Bath and Brush, say prices vary by breed and size and direct them to the website or offer to book a consultation.`;
}

// ---------- Claude ----------
async function callClaude(system: string, messages: any[], model = HAIKU_MODEL, maxTokens = 200): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude error ${res.status}: ${t}`);
  }
  const json = await res.json();
  return (json.content?.[0]?.text || "").trim();
}

// ---------- Call log helpers ----------
async function getOrCreateCallLog(callSid: string, callerNumber?: string) {
  const { data: existing } = await supabase.from("ai_call_logs").select("*").eq("call_sid", callSid).maybeSingle();
  if (existing) return existing;
  const { data } = await supabase
    .from("ai_call_logs")
    .insert({ call_sid: callSid, caller_number: callerNumber, started_at: new Date().toISOString(), transcript: [] })
    .select()
    .single();
  return data;
}

async function appendTranscript(callSid: string, role: "caller" | "ai" | "system", text: string) {
  const { data: log } = await supabase.from("ai_call_logs").select("transcript").eq("call_sid", callSid).maybeSingle();
  const transcript = Array.isArray(log?.transcript) ? log!.transcript : [];
  transcript.push({ role, text, at: new Date().toISOString() });
  await supabase.from("ai_call_logs").update({ transcript }).eq("call_sid", callSid);
  return transcript;
}

function transcriptToMessages(transcript: any[]): any[] {
  return transcript
    .filter((t) => t.role === "caller" || t.role === "ai")
    .map((t) => ({ role: t.role === "caller" ? "user" : "assistant", content: t.text }));
}

// ---------- Action tag parsing ----------
function detectActionTag(text: string): { tag: "TRANSFER" | "BOOK" | "MESSAGE" | "END" | null; payload: string; clean: string } {
  const m = text.match(/\[(TRANSFER|BOOK|MESSAGE|END)(?::\s*([^\]]*))?\]/i);
  if (!m) return { tag: null, payload: "", clean: text };
  const tag = m[1].toUpperCase() as any;
  const payload = (m[2] || "").trim();
  const clean = text.replace(m[0], "").trim();
  return { tag, payload, clean };
}

function parseKvPayload(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split(/,(?![^=]*=[^,]*,)/)) {
    const [k, ...rest] = part.split("=");
    if (!k) continue;
    out[k.trim().toLowerCase()] = rest.join("=").trim();
  }
  return out;
}

// ---------- SMS / Email helpers ----------
async function sendSms(to: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn("[ai-receptionist] Twilio SMS not configured");
    return;
  }
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const body2 = new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body2,
    });
    if (!res.ok) console.error("[ai-receptionist] sms failed", await res.text());
  } catch (e) {
    console.error("[ai-receptionist] sms err", e);
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
        to: [to],
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error("[ai-receptionist] email err", e);
  }
}

// ---------- Main handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "incoming";

  let params: Record<string, string> = {};
  try {
    if (req.method === "POST") params = await parseTwilioForm(req);
  } catch (_) {
    /* ignore */
  }

  // Best-effort signature check (logged only)
  try { await verifyTwilio(req, req.url, params); } catch (_) {}

  const callSid = params.CallSid || url.searchParams.get("CallSid") || "";
  const fromNumber = params.From || "";

  let settings: any = null;
  try {
    settings = await loadSettings();
  } catch (e) {
    console.error("[ai-receptionist] settings load failed", e);
  }
  const transferNumber = settings?.transfer_number || "+441708606655";
  const summaryEmail = settings?.email_summary_to || "info@fluffandscruff.co.uk";

  try {
    // ---- Initial call ----
    if (action === "incoming" || action === "initial") {
      if (!callSid) {
        return twiml(`<Say voice="${VOICE}">Sorry, I couldn't start the call.</Say><Hangup/>`);
      }
      await getOrCreateCallLog(callSid, fromNumber);

      if (!settings?.is_active) {
        await supabase.from("ai_call_logs").update({ outcome: "transferred", transfer_attempted: true }).eq("call_sid", callSid);
        return twiml(transferTwiml(transferNumber, callSid, "One moment, connecting you to the salon."));
      }

      const greeting = settings.greeting || "Fluff and Scruff Studio, how can I help?";
      await appendTranscript(callSid, "ai", greeting);
      return twiml(gatherTwiml(greeting, callSid));
    }

    // ---- Conversation turn ----
    if (action === "conversation") {
      const speech = (params.SpeechResult || "").trim();
      if (!callSid) return twiml(`<Hangup/>`);

      if (!speech) {
        const reprompt = "Sorry, I didn't catch that. Could you say that again?";
        return twiml(gatherTwiml(reprompt, callSid));
      }

      await appendTranscript(callSid, "caller", speech);

      const { data: log } = await supabase.from("ai_call_logs").select("transcript").eq("call_sid", callSid).maybeSingle();
      const messages = transcriptToMessages(Array.isArray(log?.transcript) ? log!.transcript : []);
      const system = await buildSystemPrompt();

      let aiText = "";
      try {
        aiText = await callClaude(system, messages, HAIKU_MODEL, 200);
      } catch (e) {
        console.error("[ai-receptionist] claude failed", e);
        return twiml(errorTransferTwiml(transferNumber));
      }

      const { tag, payload, clean } = detectActionTag(aiText);
      const sayText = clean || "One moment please.";
      await appendTranscript(callSid, "ai", aiText);

      if (tag === "TRANSFER") {
        await supabase.from("ai_call_logs").update({ outcome: "transferred", transfer_attempted: true }).eq("call_sid", callSid);
        return twiml(transferTwiml(transferNumber, callSid, sayText || "Let me transfer you now."));
      }

      if (tag === "BOOK") {
        const fields = parseKvPayload(payload);
        await supabase.from("ai_call_logs").update({ outcome: "booking_made" }).eq("call_sid", callSid);
        // Booking creation kept lightweight — store note in transcript; full create handled offline.
        await appendTranscript(callSid, "system", `BOOK_REQUEST ${JSON.stringify(fields)}`);
        // Notify salon of booking intent
        await sendSms(transferNumber, `AI booking request: ${JSON.stringify(fields)}`);
        const confirmText = sayText || "Lovely, I've taken those details and the salon will confirm shortly. Anything else?";
        return twiml(gatherTwiml(confirmText, callSid));
      }

      if (tag === "MESSAGE") {
        const fields = parseKvPayload(payload);
        await supabase.from("ai_call_logs").update({ outcome: "voicemail", caller_name: fields.caller || null }).eq("call_sid", callSid);
        await sendSms(transferNumber, `Missed call message via AI receptionist:\nCaller: ${fields.caller || "?"}\nNumber: ${fields.number || fromNumber || "?"}\nMessage: ${fields.message || "(no message)"}`);
        const goodbye = sayText || "Thanks, I've passed your message on. Have a lovely day. Goodbye.";
        return twiml(`<Say voice="${VOICE}">${escapeXml(goodbye)}</Say><Hangup/>`);
      }

      if (tag === "END") {
        const goodbye = sayText || "Thanks for calling Fluff and Scruff. Goodbye.";
        // Fire-and-forget summary
        finalizeCall(callSid, summaryEmail).catch((e) => console.error("[ai-receptionist] finalize err", e));
        return twiml(`<Say voice="${VOICE}">${escapeXml(goodbye)}</Say><Hangup/>`);
      }

      return twiml(gatherTwiml(sayText, callSid));
    }

    // ---- Transfer completion (Dial action callback) ----
    if (action === "transfer_complete") {
      const dialStatus = params.DialCallStatus || "";
      const successful = dialStatus === "completed" || dialStatus === "answered";
      await supabase
        .from("ai_call_logs")
        .update({ transfer_successful: successful, outcome: "transferred" })
        .eq("call_sid", callSid);

      if (!successful) {
        await sendSms(transferNumber, `Missed call from AI receptionist. Caller: ${fromNumber || "unknown"}. Dial status: ${dialStatus}.`);
        return twiml(`
          <Say voice="${VOICE}">Sorry, no one is available right now. Please leave a brief message after the tone, including your name and number.</Say>
          <Record maxLength="60" playBeep="true" action="${FN_BASE}?action=complete&CallSid=${encodeURIComponent(callSid)}"/>
          <Hangup/>
        `);
      }
      return twiml(`<Hangup/>`);
    }

    // ---- Call complete (status callback) ----
    if (action === "complete") {
      finalizeCall(callSid, summaryEmail).catch((e) => console.error("[ai-receptionist] finalize err", e));
      return new Response("ok", { headers: corsHeaders });
    }

    // Unknown action — be safe
    return twiml(`<Hangup/>`);
  } catch (e) {
    console.error("[ai-receptionist] unhandled", e);
    return twiml(errorTransferTwiml(transferNumber));
  }
});

async function finalizeCall(callSid: string, summaryEmail: string) {
  if (!callSid) return;
  const { data: log } = await supabase.from("ai_call_logs").select("*").eq("call_sid", callSid).maybeSingle();
  if (!log) return;

  const startedAt = log.started_at ? new Date(log.started_at) : null;
  const endedAt = new Date();
  const duration = startedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : null;

  const transcript: any[] = Array.isArray(log.transcript) ? log.transcript : [];
  const formatted = transcript
    .filter((t) => t.role === "caller" || t.role === "ai")
    .map((t) => `${t.role === "caller" ? "Caller" : "AI"}: ${t.text}`)
    .join("\n");

  let summary = "";
  try {
    summary = await callClaude(
      "You summarise phone calls for a dog grooming salon in 2 short sentences. No preamble.",
      [{ role: "user", content: `Summarise this call in 2 sentences:\n\n${formatted || "(no speech captured)"}` }],
      SONNET_MODEL,
      150,
    );
  } catch (e) {
    console.error("[ai-receptionist] summary failed", e);
    summary = "(summary unavailable)";
  }

  const outcome = log.outcome || "abandoned";
  await supabase
    .from("ai_call_logs")
    .update({
      ended_at: endedAt.toISOString(),
      duration_seconds: duration,
      summary,
      outcome,
    })
    .eq("call_sid", callSid);

  const subject = `📞 AI Receptionist Call — ${outcome} — ${log.caller_number || "unknown"} — ${endedAt.toISOString()}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px">
      <h2>AI Receptionist Call</h2>
      <p><strong>Time:</strong> ${endedAt.toISOString()}</p>
      <p><strong>Duration:</strong> ${duration ?? "?"} seconds</p>
      <p><strong>Caller:</strong> ${escapeXml(log.caller_number || "unknown")}</p>
      <p><strong>Outcome:</strong> ${escapeXml(outcome)}</p>
      <h3>Summary</h3>
      <p>${escapeXml(summary)}</p>
      <h3>Transcript</h3>
      <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px">${escapeXml(formatted)}</pre>
    </div>
  `;
  await sendEmail(summaryEmail, subject, html);
}