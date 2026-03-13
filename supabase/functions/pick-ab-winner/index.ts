import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find campaigns in ab_testing status that were sent 2+ hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: abCampaigns, error: fetchErr } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("status", "ab_testing")
      .lte("sent_at", twoHoursAgo);

    if (fetchErr) throw fetchErr;
    if (!abCampaigns?.length) {
      return new Response(JSON.stringify({ message: "No A/B tests ready", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const campaign of abCampaigns) {
      // Determine winner by open rate
      const aOpens = campaign.variant_a_opens || 0;
      const bOpens = campaign.variant_b_opens || 0;
      const aSent = campaign.variant_a_sent || 1;
      const bSent = campaign.variant_b_sent || 1;

      const aRate = aOpens / aSent;
      const bRate = bOpens / bSent;
      const winner = bRate > aRate ? "B" : "A";
      const winnerSubject = winner === "B" ? campaign.variant_b_subject : campaign.subject;

      // Get remainder emails
      const { data: configData } = await supabase
        .from("site_config")
        .select("value")
        .eq("key", `ab_remainder_${campaign.id}`)
        .single();

      if (!configData?.value) {
        await supabase.from("email_campaigns").update({
          status: "sent",
          ab_winner: winner,
        }).eq("id", campaign.id);
        continue;
      }

      const { emails: remainderEmails, htmlBody } = configData.value as any;
      const unsubscribeBaseUrl = `${supabaseUrl}/functions/v1/handle-unsubscribe`;
      let sent = 0;

      for (let i = 0; i < remainderEmails.length; i += 20) {
        const batch = remainderEmails.slice(i, i + 20);
        const promises = batch.map(async (email: string) => {
          const unsubUrl = `${unsubscribeBaseUrl}?email=${encodeURIComponent(email)}`;
          let personalizedHtml = htmlBody.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubUrl);
          personalizedHtml = personalizedHtml.replace(
            /(https?:\/\/[^"']*\/book)(?:\?([^"']*))?/g,
            (match: string, base: string, existing: string) => {
              const sep = existing ? `${base}?${existing}&` : `${base}?`;
              return `${sep}utm_campaign=${campaign.id}`;
            }
          );

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
              to: [email],
              reply_to: "info@fluffandscruff.co.uk",
              subject: winnerSubject,
              html: personalizedHtml,
            }),
          });

          if (res.ok) sent++;
          else console.error(`Failed to send to ${email}:`, await res.text());
        });
        await Promise.all(promises);
      }

      // Update campaign
      await supabase.from("email_campaigns").update({
        status: "sent",
        ab_winner: winner,
        emails_sent: (campaign.emails_sent || 0) + sent,
      }).eq("id", campaign.id);

      // Clean up remainder config
      await supabase.from("site_config").delete().eq("key", `ab_remainder_${campaign.id}`);

      processed++;
      console.log(`A/B winner for ${campaign.id}: Variant ${winner} (A: ${(aRate * 100).toFixed(1)}%, B: ${(bRate * 100).toFixed(1)}%), sent ${sent} remainder emails`);
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
