import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 2;
const DELAY_MS = 1000;
const MAX_RETRIES = 3;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Unsubscribe footer template
function makeUnsubFooter(email: string) {
  const unsubUrl = `https://fluffandscruff.co.uk/unsubscribe?email=${encodeURIComponent(email)}`;
  return `<div style="border-top:1px solid #e0e0e0;margin-top:32px;padding-top:20px;text-align:center;font-family:Arial,sans-serif;"><p style="font-size:12px;color:#999;line-height:1.6;margin:0;">You are receiving this email because you are part of the Fluff &amp; Scruff family.<br/>To unsubscribe from future marketing emails, <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">click here</a>.</p></div>`;
}

async function sendOneEmail(
  email: string,
  subjectLine: string,
  htmlBody: string,
  campaignId: string | null,
  supabaseUrl: string,
  RESEND_API_KEY: string,
  supabase: any,
): Promise<"sent" | "failed"> {
  const unsubUrl = `${supabaseUrl}/functions/v1/handle-unsubscribe?email=${encodeURIComponent(email)}`;
  let personalizedHtml = htmlBody.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubUrl);
  if (campaignId) {
    personalizedHtml = personalizedHtml.replace(
      /(https?:\/\/[^"']*\/book)(?:\?([^"']*))?/g,
      (_match: string, base: string, existing: string) => {
        const sep = existing ? `${base}?${existing}&` : `${base}?`;
        return `${sep}utm_campaign=${campaignId}`;
      }
    );
  }
  personalizedHtml += makeUnsubFooter(email);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
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
          subject: subjectLine,
          html: personalizedHtml,
        }),
      });

      if (res.ok) {
        if (campaignId) {
          await supabase.from("campaign_send_log").insert({
            campaign_id: campaignId, email, status: "sent",
          });
        }
        return "sent";
      }

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
        const waitMs = Math.max(retryAfter * 1000, 1000);
        console.warn(`429 for ${email}, attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${waitMs}ms`);
        await delay(waitMs);
        continue; // retry
      }

      // Non-429 error — log and stop retrying
      const errText = await res.text();
      console.error(`Failed to send to ${email}:`, errText);
      if (campaignId) {
        await supabase.from("campaign_send_log").insert({
          campaign_id: campaignId, email, status: "failed",
          error_message: errText.substring(0, 500),
        });
      }
      return "failed";
    } catch (err) {
      console.error(`Exception sending to ${email}:`, err);
      if (attempt === MAX_RETRIES - 1) {
        if (campaignId) {
          await supabase.from("campaign_send_log").insert({
            campaign_id: campaignId, email, status: "failed",
            error_message: String(err).substring(0, 500),
          });
        }
        return "failed";
      }
      await delay(1000);
    }
  }

  // Exhausted retries (429s)
  console.error(`Rate limited after ${MAX_RETRIES} retries for ${email}`);
  if (campaignId) {
    await supabase.from("campaign_send_log").insert({
      campaign_id: campaignId, email, status: "failed",
      error_message: `rate_limit_exceeded after ${MAX_RETRIES} retries`,
    });
  }
  return "failed";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Not authenticated");

    const { campaignId, emails, subject, htmlBody, variantBSubject, abTestPercentage, retryFailed } = await req.json();
    if (!subject || !htmlBody) {
      return new Response(JSON.stringify({ error: "subject and htmlBody required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unsubscribed emails
    const { data: unsubs } = await supabase.from("email_unsubscribes").select("email");
    const unsubSet = new Set((unsubs || []).map((u: any) => u.email.toLowerCase()));

    // Build recipient list
    let recipientEmails: string[];

    if (retryFailed && campaignId) {
      const { data: failedLogs } = await supabase
        .from("campaign_send_log")
        .select("email")
        .eq("campaign_id", campaignId)
        .eq("status", "failed");
      recipientEmails = (failedLogs || []).map((l: any) => l.email);
    } else if (emails?.length) {
      recipientEmails = emails;
    } else {
      throw new Error("No recipients specified");
    }

    if (recipientEmails.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, failed: 0, skipped: 0, total: 0, noFailedToRetry: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out unsubscribed and invalid emails
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const validEmails = recipientEmails.filter((e: string) => {
      const lower = e.toLowerCase().trim();
      return emailRegex.test(lower) && !unsubSet.has(lower) && !lower.includes("test");
    });

    const skippedCount = recipientEmails.length - validEmails.length;

    // A/B test logic
    const isABTest = variantBSubject && abTestPercentage && abTestPercentage > 0;
    let groupA: string[] = validEmails;
    let groupB: string[] = [];
    let groupRemainder: string[] = [];

    if (isABTest) {
      const shuffled = [...validEmails].sort(() => Math.random() - 0.5);
      const testSize = Math.floor(shuffled.length * (abTestPercentage / 100));
      groupA = shuffled.slice(0, testSize);
      groupB = shuffled.slice(testSize, testSize * 2);
      groupRemainder = shuffled.slice(testSize * 2);
    }

    let sentA = 0;
    let sentB = 0;
    let failedCount = 0;

    // Sequential send with rate limiting
    const sendBatch = async (emailList: string[], subjectLine: string) => {
      let count = 0;
      for (let i = 0; i < emailList.length; i += BATCH_SIZE) {
        const batch = emailList.slice(i, i + BATCH_SIZE);
        // Send sequentially within each batch
        for (const email of batch) {
          const result = await sendOneEmail(
            email, subjectLine, htmlBody, campaignId,
            supabaseUrl, RESEND_API_KEY, supabase,
          );
          if (result === "sent") count++;
          else failedCount++;
        }
        // Rate limit: wait between batches
        if (i + BATCH_SIZE < emailList.length) {
          await delay(DELAY_MS);
        }
      }
      return count;
    };

    // If retrying, clear old failed logs for this campaign first
    if (retryFailed && campaignId) {
      await supabase.from("campaign_send_log").delete()
        .eq("campaign_id", campaignId)
        .eq("status", "failed");
    }

    // Log skipped emails
    if (campaignId) {
      const skippedEmails = recipientEmails.filter((e: string) => {
        const lower = e.toLowerCase().trim();
        return !emailRegex.test(lower) || unsubSet.has(lower) || lower.includes("test");
      });
      if (skippedEmails.length > 0) {
        const skippedLogs = skippedEmails.map((email: string) => ({
          campaign_id: campaignId,
          email,
          status: "skipped",
          error_message: unsubSet.has(email.toLowerCase()) ? "Unsubscribed" : "Invalid email",
        }));
        await supabase.from("campaign_send_log").insert(skippedLogs);
      }
    }

    // Send to group A
    sentA = await sendBatch(groupA, subject);

    // Send to group B (if A/B test)
    if (isABTest && groupB.length > 0) {
      sentB = await sendBatch(groupB, variantBSubject);
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

      // If A/B test, store remainder emails for later pickup
      if (isABTest && groupRemainder.length > 0) {
        await supabase.from("site_config").upsert({
          key: `ab_remainder_${campaignId}`,
          value: { emails: groupRemainder, htmlBody },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent: totalSent,
      failed: failedCount,
      skipped: skippedCount,
      total: recipientEmails.length,
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
