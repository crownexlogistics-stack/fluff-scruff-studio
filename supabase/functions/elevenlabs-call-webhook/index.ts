import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const data = payload?.data || {};
    const metadata = data?.metadata || {};
    const analysis = data?.analysis || {};
    const phoneCall = metadata?.phone_call || {};

    const callSid = data?.conversation_id || "";
    const callerNumber = phoneCall?.from_phone_number || null;
    const durationSeconds = Number(metadata?.call_duration_secs || 0);
    const summary = analysis?.transcript_summary || null;

    const startUnix = Number(metadata?.start_time_unix_secs || 0);
    const startedAt = startUnix > 0
      ? new Date(startUnix * 1000).toISOString()
      : new Date().toISOString();

    // Build transcript in our format
    const rawTranscript = Array.isArray(data?.transcript) ? data.transcript : [];
    const transcript = rawTranscript.map((t: any) => ({
      role: t.role === "agent" ? "ai" : "caller",
      text: String(t.message || ""),
    }));

    // Determine outcome from transcript text
    const fullText = transcript.map((t: any) => t.text).join(" ").toLowerCase();
    let outcome = "enquiry";
    if (fullText.includes("booked") || fullText.includes("appointment")) {
      outcome = "booking_made";
    } else if (fullText.includes("transfer") || fullText.includes("put you through")) {
      outcome = "transferred";
    } else if (fullText.includes("message")) {
      outcome = "voicemail";
    }

    const startedDate = new Date(startedAt);
    const endedAt = new Date(startedDate.getTime() + durationSeconds * 1000).toISOString();

    const { error } = await supabase
      .from("ai_call_logs")
      .upsert({
        call_sid: callSid,
        caller_number: callerNumber,
        duration_seconds: durationSeconds,
        transcript: transcript.length > 0 ? transcript : null,
        summary,
        started_at: startedAt,
        ended_at: endedAt,
        outcome,
      }, { onConflict: "call_sid" });

    if (error) {
      console.error("[elevenlabs-call-webhook] upsert error:", error);
      return json({ error: error.message }, 500);
    }

    // ────────────────────────────────────────────────────────────────────
    // Create AI Inbox cases for voicemails and callback requests.
    // (missed_opportunity cases are auto-created by a DB trigger on ai_call_logs.)
    // ────────────────────────────────────────────────────────────────────
    try {
      const transcriptText = transcript
        .map((t: any) => `${t.role === "ai" ? "AI" : "Caller"}: ${t.text}`)
        .join("\n");

      // Try to extract a name from the transcript (very rough heuristic)
      const nameMatch = transcriptText.match(/my name is ([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i)
        || transcriptText.match(/this is ([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i);
      const callerName = nameMatch ? nameMatch[1] : null;

      if (outcome === "voicemail") {
        const lastCallerLine = [...transcript].reverse().find((t: any) => t.role === "caller");
        const message = lastCallerLine?.text || summary || transcriptText.slice(0, 500);
        await supabase.from("ai_inbox_cases").insert({
          case_type: "message",
          status: "unassigned",
          caller_number: callerNumber,
          caller_name: callerName,
          summary: message,
          full_transcript: transcript,
          call_duration_seconds: durationSeconds,
        });
      }

      const transferSuccessful = analysis?.transfer_successful;
      if (transferSuccessful === false && (callerNumber || callerName)) {
        await supabase.from("ai_inbox_cases").insert({
          case_type: "callback_requested",
          status: "unassigned",
          caller_number: callerNumber,
          caller_name: callerName,
          summary: summary || transcriptText.slice(0, 500),
          full_transcript: transcript,
          call_duration_seconds: durationSeconds,
        });
      }
    } catch (caseErr) {
      console.error("[elevenlabs-call-webhook] inbox case insert failed:", caseErr);
    }

    // Notify staff about missed opportunities
    if (outcome !== "booking_made") {
      const summaryLower = String(summary || "").toLowerCase();
      const missedKeywords =
        summaryLower.includes("technical difficulty") ||
        summaryLower.includes("unable to help") ||
        summaryLower.includes("call back");

      if (missedKeywords || durationSeconds < 30) {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          const transcriptText = transcript
            .map((t: any) => `${t.role === "ai" ? "AI" : "Caller"}: ${t.text}`)
            .join("\n");

          const callTime = new Date(startedAt).toLocaleString("en-GB", {
            timeZone: "Europe/London",
          });

          const emailBody =
            `The AI receptionist was unable to help a caller and they may have been lost.\n\n` +
            `Caller: ${callerNumber || "Unknown"}\n` +
            `Time: ${callTime}\n` +
            `Duration: ${durationSeconds} seconds\n` +
            `Outcome: ${outcome}\n\n` +
            `Summary: ${summary || "N/A"}\n\n` +
            `Transcript:\n${transcriptText || "N/A"}\n\n` +
            `Action needed: Consider calling this customer back.`;

          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
              to: ["info@fluffandscruff.co.uk"],
              subject: `⚠️ Missed Call Opportunity — AI Could Not Help — ${callerNumber || "Unknown"}`,
              text: emailBody,
            }),
          }).catch((err) => {
            console.error("[elevenlabs-call-webhook] email send error:", err);
          });
        }
      }
    }

    return json({ success: true });
  } catch (err: any) {
    console.error("[elevenlabs-call-webhook] error:", err);
    return json({ error: err?.message || "Server error" }, 500);
  }
});
