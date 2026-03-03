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

    let totalProcessed = 0;

    for (const campaign of dueCampaigns) {
      // Mark as sending
      await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaign.id);

      // Build segment email list from bookings
      const { data: bookings } = await supabase
        .from("bookings")
        .select("customer_email, customer_name, status, booking_date")
        .not("customer_email", "is", null)
        .order("booking_date", { ascending: false });

      if (!bookings) continue;

      // Build customer map
      const map = new Map<string, { email: string; completedCount: number; lastBooking: string }>();
      for (const b of bookings) {
        if (!b.customer_email) continue;
        const key = b.customer_email.toLowerCase().trim();
        if (unsubSet.has(key)) continue;
        const existing = map.get(key);
        const isCompleted = b.status === "Completed";
        if (existing) {
          if (isCompleted) existing.completedCount++;
          if (b.booking_date > existing.lastBooking) existing.lastBooking = b.booking_date;
        } else {
          map.set(key, { email: b.customer_email, completedCount: isCompleted ? 1 : 0, lastBooking: b.booking_date });
        }
      }

      const all = Array.from(map.values());
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const cutoff = threeMonthsAgo.toISOString().slice(0, 10);

      const segments: Record<string, typeof all> = {
        all,
        "one-timers": all.filter(c => c.completedCount === 1),
        "lost-regulars": all.filter(c => c.completedCount >= 2 && c.lastBooking < cutoff),
        vips: all.filter(c => c.completedCount > 5),
      };

      const targetEmails = (segments[campaign.segment] || all).map(c => c.email);
      const validEmails = targetEmails.filter(e => !unsubSet.has(e.toLowerCase()));

      const unsubscribeBaseUrl = `${supabaseUrl}/functions/v1/handle-unsubscribe`;
      let sent = 0;
      const batchSize = 20;

      for (let i = 0; i < validEmails.length; i += batchSize) {
        const batch = validEmails.slice(i, i + batchSize);
        const promises = batch.map(async (email: string) => {
          const unsubUrl = `${unsubscribeBaseUrl}?email=${encodeURIComponent(email)}`;
          const personalizedHtml = campaign.html_body.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubUrl);

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
              subject: campaign.subject,
              content: [{ type: "text/html", value: personalizedHtml }],
            }),
          });

          if (res.ok) sent++;
          else console.error(`Failed to send to ${email}:`, await res.text());
        });
        await Promise.all(promises);
      }

      // Update campaign as sent
      await supabase.from("email_campaigns").update({
        status: "sent",
        emails_sent: sent,
        sent_at: new Date().toISOString(),
      }).eq("id", campaign.id);

      totalProcessed++;
      console.log(`Campaign ${campaign.id} sent: ${sent} emails`);
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
