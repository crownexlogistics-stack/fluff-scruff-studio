import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

serve(async (req) => {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("c") || "";
  const email = url.searchParams.get("e") || "";
  const type = url.searchParams.get("t") || "open"; // "open" or "click"
  const destination = url.searchParams.get("url") || "";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (campaignId && email) {
      const eventType = type === "click" ? "click" : "open";
      const sgEventId = `${email}-${eventType}-${Date.now()}`;

      // Insert event (duplicates ignored via sg_event_id if unique constraint exists)
      await supabase.from("email_events").insert({
        campaign_id: campaignId,
        email: decodeURIComponent(email),
        event_type: eventType,
        sg_event_id: sgEventId,
        url: destination || null,
      }).then(() => {
        // Update campaign aggregate counts
        return updateCampaignCounts(supabase, campaignId);
      });
    }
  } catch (err) {
    console.error("Track error:", err);
  }

  // Return based on type
  if (type === "click" && destination) {
    return new Response(null, {
      status: 302,
      headers: { Location: decodeURIComponent(destination) },
    });
  }

  // Return tracking pixel for opens
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
});

async function updateCampaignCounts(supabase: any, campaignId: string) {
  try {
    // Count total opens
    const { count: totalOpens } = await supabase
      .from("email_events")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("event_type", "open");

    // Count unique opens (distinct emails)
    const { data: uniqueOpenEmails } = await supabase
      .from("email_events")
      .select("email")
      .eq("campaign_id", campaignId)
      .eq("event_type", "open");
    const uniqueOpens = new Set((uniqueOpenEmails || []).map((r: any) => r.email)).size;

    // Count total clicks
    const { count: totalClicks } = await supabase
      .from("email_events")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("event_type", "click");

    // Count unique clicks
    const { data: uniqueClickEmails } = await supabase
      .from("email_events")
      .select("email")
      .eq("campaign_id", campaignId)
      .eq("event_type", "click");
    const uniqueClicks = new Set((uniqueClickEmails || []).map((r: any) => r.email)).size;

    await supabase.from("email_campaigns").update({
      opens: totalOpens || 0,
      unique_opens: uniqueOpens,
      clicks: totalClicks || 0,
      unique_clicks: uniqueClicks,
    }).eq("id", campaignId);
  } catch (err) {
    console.error("Failed to update campaign counts:", err);
  }
}
