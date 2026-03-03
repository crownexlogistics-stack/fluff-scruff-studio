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

    const { campaignId, emails, subject, htmlBody, variantBSubject, abTestPercentage } = await req.json();
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

    // A/B test logic
    const isABTest = variantBSubject && abTestPercentage && abTestPercentage > 0;
    let groupA: string[] = validEmails;
    let groupB: string[] = [];
    let groupRemainder: string[] = [];

    if (isABTest) {
      // Shuffle emails for random split
      const shuffled = [...validEmails].sort(() => Math.random() - 0.5);
      const testSize = Math.floor(shuffled.length * (abTestPercentage / 100));
      groupA = shuffled.slice(0, testSize);
      groupB = shuffled.slice(testSize, testSize * 2);
      groupRemainder = shuffled.slice(testSize * 2);
    }

    let sentA = 0;
    let sentB = 0;
    const batchSize = 20;

    // Send function
    const sendBatch = async (emailList: string[], subjectLine: string, variant: string) => {
      let count = 0;
      for (let i = 0; i < emailList.length; i += batchSize) {
        const batch = emailList.slice(i, i + batchSize);
        const promises = batch.map(async (email: string) => {
          const unsubUrl = `${unsubscribeBaseUrl}?email=${encodeURIComponent(email)}`;
          let personalizedHtml = htmlBody.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubUrl);
          if (campaignId) {
            personalizedHtml = personalizedHtml.replace(
              /(https?:\/\/[^"']*\/book)(?:\?([^"']*))?/g,
              (match: string, base: string, existing: string) => {
                const sep = existing ? `${base}?${existing}&` : `${base}?`;
                return `${sep}utm_campaign=${campaignId}`;
              }
            );
          }

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
              subject: subjectLine,
              content: [{ type: "text/html", value: personalizedHtml }],
              custom_args: campaignId ? { campaign_id: campaignId, ab_variant: variant } : undefined,
              tracking_settings: {
                click_tracking: { enable: true },
                open_tracking: { enable: true },
              },
            }),
          });

          if (res.ok) count++;
          else console.error(`Failed to send to ${email}:`, await res.text());
        });
        await Promise.all(promises);
      }
      return count;
    };

    // Send to group A
    sentA = await sendBatch(groupA, subject, "A");

    // Send to group B (if A/B test)
    if (isABTest && groupB.length > 0) {
      sentB = await sendBatch(groupB, variantBSubject, "B");
    }

    const totalSent = sentA + sentB;

    // Update campaign record
    if (campaignId) {
      const updateData: any = {
        status: isABTest && groupRemainder.length > 0 ? "ab_testing" : "sent",
        emails_sent: totalSent,
        sent_at: new Date().toISOString(),
        variant_a_sent: sentA,
        variant_b_sent: sentB,
      };

      await supabase.from("email_campaigns").update(updateData).eq("id", campaignId);

      // Trigger attribution processing asynchronously
      supabase.functions.invoke("attribute-campaign-bookings").catch(() => {});

      // If A/B test, schedule remainder send after 2 hours (handled by pick-ab-winner function)
      if (isABTest && groupRemainder.length > 0) {
        // Store remainder emails for later pickup
        await supabase.from("site_config").upsert({
          key: `ab_remainder_${campaignId}`,
          value: { emails: groupRemainder, htmlBody },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true, sent: totalSent, skipped: emails.length - validEmails.length,
      abTest: isABTest ? { sentA, sentB, remainder: groupRemainder.length } : undefined,
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
