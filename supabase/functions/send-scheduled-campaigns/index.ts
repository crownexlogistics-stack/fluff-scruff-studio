import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 10;
const DELAY_MS = 1000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find campaigns that are scheduled and due
    const now = new Date().toISOString();
    const { data: dueCampaigns, error: fetchErr } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (fetchErr) throw fetchErr;
    if (!dueCampaigns || dueCampaigns.length === 0) {
      return new Response(JSON.stringify({ message: "No campaigns due", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unsubscribed emails
    const { data: unsubs } = await supabase.from("email_unsubscribes").select("email");
    const unsubSet = new Set((unsubs || []).map((u: any) => u.email.toLowerCase()));

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

    let totalProcessed = 0;

    for (const campaign of dueCampaigns) {
      // Mark as sending
      await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaign.id);

      // ═══════════════════════════════════════════════
      // BUILD RECIPIENT LIST FROM ALL SOURCES
      // ═══════════════════════════════════════════════

      const masterMap = new Map<string, { email: string; completedCount: number; lastBooking: string }>();

      // 1. Pull from migrated_customers (the main ~800+ customer list)
      const { data: migratedCustomers } = await supabase
        .from("migrated_customers")
        .select("email, full_name")
        .not("email", "is", null);

      for (const mc of (migratedCustomers || [])) {
        if (!mc.email) continue;
        const key = mc.email.toLowerCase().trim();
        if (!emailRegex.test(key) || key.includes("test")) continue;
        if (unsubSet.has(key)) continue;
        if (!masterMap.has(key)) {
          masterMap.set(key, { email: mc.email, completedCount: 0, lastBooking: "" });
        }
      }

      // 2. Pull from bookings (adds any customers not in migrated_customers)
      const { data: bookings } = await supabase
        .from("bookings")
        .select("customer_email, customer_name, status, booking_date")
        .not("customer_email", "is", null)
        .order("booking_date", { ascending: false });

      for (const b of (bookings || [])) {
        if (!b.customer_email) continue;
        const key = b.customer_email.toLowerCase().trim();
        if (!emailRegex.test(key) || key.includes("test")) continue;
        if (unsubSet.has(key)) continue;
        const existing = masterMap.get(key);
        const isCompleted = b.status === "Completed";
        if (existing) {
          if (isCompleted) existing.completedCount++;
          if (b.booking_date > existing.lastBooking) existing.lastBooking = b.booking_date;
        } else {
          masterMap.set(key, {
            email: b.customer_email,
            completedCount: isCompleted ? 1 : 0,
            lastBooking: b.booking_date,
          });
        }
      }

      const all = Array.from(masterMap.values());
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const cutoff = threeMonthsAgo.toISOString().slice(0, 10);

      const segments: Record<string, typeof all> = {
        all,
        "one-timers": all.filter(c => c.completedCount === 1),
        "lost-regulars": all.filter(c => c.completedCount >= 2 && c.lastBooking < cutoff),
        vips: all.filter(c => c.completedCount > 5),
      };

      const targetList = segments[campaign.segment] || all;
      const targetEmails = targetList.map(c => c.email);

      console.log(`Campaign ${campaign.id}: segment="${campaign.segment}", total recipients=${targetEmails.length}`);

      const unsubscribeBaseUrl = `${supabaseUrl}/functions/v1/handle-unsubscribe`;
      let sent = 0;
      let failed = 0;

      // Unsubscribe footer template
      const makeUnsubFooter = (email: string) => {
        const unsubUrl = `https://fluffandscruff.co.uk/unsubscribe?email=${encodeURIComponent(email)}`;
        return `<div style="border-top:1px solid #e0e0e0;margin-top:32px;padding-top:20px;text-align:center;font-family:Arial,sans-serif;"><p style="font-size:12px;color:#999;line-height:1.6;margin:0;">You are receiving this email because you are part of the Fluff &amp; Scruff family.<br/>To unsubscribe from future marketing emails, <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">click here</a>.</p></div>`;
      };

      for (let i = 0; i < targetEmails.length; i += BATCH_SIZE) {
        const batch = targetEmails.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (email: string) => {
          const unsubUrl = `${unsubscribeBaseUrl}?email=${encodeURIComponent(email)}`;
          let personalizedHtml = campaign.html_body.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubUrl);
          personalizedHtml = personalizedHtml.replace(
            /(https?:\/\/[^"']*\/book)(?:\?([^"']*))?/g,
            (match: string, base: string, existing: string) => {
              const sep = existing ? `${base}?${existing}&` : `${base}?`;
              return `${sep}utm_campaign=${campaign.id}`;
            }
          );

          // Auto-append the GDPR unsubscribe footer
          personalizedHtml += makeUnsubFooter(email);

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
                subject: campaign.subject,
                html: personalizedHtml,
              }),
            });

            if (res.ok) {
              sent++;
              await supabase.from("campaign_send_log").insert({
                campaign_id: campaign.id, email, status: "sent",
              });
            } else {
              const errText = await res.text();
              console.error(`Failed to send to ${email}:`, errText);
              failed++;
              await supabase.from("campaign_send_log").insert({
                campaign_id: campaign.id, email, status: "failed",
                error_message: errText.substring(0, 500),
              });
            }
          } catch (err) {
            console.error(`Exception sending to ${email}:`, err);
            failed++;
            await supabase.from("campaign_send_log").insert({
              campaign_id: campaign.id, email, status: "failed",
              error_message: String(err).substring(0, 500),
            });
          }
        });
        await Promise.all(promises);

        // Rate limit: wait between batches
        if (i + BATCH_SIZE < targetEmails.length) {
          await delay(DELAY_MS);
        }
      }

      // Update campaign as sent
      await supabase.from("email_campaigns").update({
        status: "sent",
        emails_sent: sent,
        sent_at: new Date().toISOString(),
      }).eq("id", campaign.id);

      totalProcessed++;
      console.log(`Campaign ${campaign.id} done: ${sent} sent, ${failed} failed out of ${targetEmails.length}`);
    }

    return new Response(JSON.stringify({ success: true, processed: totalProcessed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
