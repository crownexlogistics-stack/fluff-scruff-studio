import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    if (!SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Not authenticated");

    const { campaignId, emails, subject, htmlBody } = await req.json();
    if (!emails?.length || !subject || !htmlBody) {
      return new Response(JSON.stringify({ error: "emails, subject, and htmlBody required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unsubscribed emails
    const { data: unsubs } = await supabase.from("email_unsubscribes").select("email");
    const unsubSet = new Set((unsubs || []).map(u => u.email.toLowerCase()));

    // Filter out unsubscribed
    const validEmails = emails.filter((e: string) => !unsubSet.has(e.toLowerCase()));

    const unsubscribeBaseUrl = `${supabaseUrl}/functions/v1/handle-unsubscribe`;

    let sent = 0;
    const batchSize = 20;

    for (let i = 0; i < validEmails.length; i += batchSize) {
      const batch = validEmails.slice(i, i + batchSize);

      const promises = batch.map(async (email: string) => {
        const unsubUrl = `${unsubscribeBaseUrl}?email=${encodeURIComponent(email)}`;
        const personalizedHtml = htmlBody.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubUrl);

        const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: "info@fluffandscruff.co.uk", name: "Fluff & Scruff Studio" },
            reply_to: { email: "info@fluffandscruff.co.uk" },
            subject,
            content: [{ type: "text/html", value: personalizedHtml }],
          }),
        });

        if (res.ok) sent++;
        else console.error(`Failed to send to ${email}:`, await res.text());
      });

      await Promise.all(promises);
    }

    // Update campaign record
    if (campaignId) {
      await supabase.from("email_campaigns").update({
        status: "sent",
        emails_sent: sent,
        sent_at: new Date().toISOString(),
      }).eq("id", campaignId);
    }

    return new Response(JSON.stringify({ success: true, sent, skipped: emails.length - validEmails.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
