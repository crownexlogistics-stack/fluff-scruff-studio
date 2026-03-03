import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const events = await req.json();
    if (!Array.isArray(events)) {
      return new Response(JSON.stringify({ error: "Expected array of events" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group events by campaign for batch updates
    const campaignUpdates = new Map<string, { opens: number; uniqueOpens: Set<string>; clicks: number; uniqueClicks: Set<string> }>();

    for (const event of events) {
      const campaignId = event.campaign_id;
      if (!campaignId) continue;

      const eventType = event.event;
      if (eventType !== "open" && eventType !== "click") continue;

      const sgEventId = event.sg_event_id || `${event.email}-${event.event}-${event.timestamp}`;

      // Insert event (skip duplicates via unique constraint on sg_event_id)
      const { error: insertErr } = await supabase.from("email_events").insert({
        campaign_id: campaignId,
        email: event.email,
        event_type: eventType,
        sg_event_id: sgEventId,
        url: event.url || null,
      });

      // If duplicate, skip counting
      if (insertErr) continue;

      if (!campaignUpdates.has(campaignId)) {
        campaignUpdates.set(campaignId, { opens: 0, uniqueOpens: new Set(), clicks: 0, uniqueClicks: new Set() });
      }
      const stats = campaignUpdates.get(campaignId)!;

      if (eventType === "open") {
        stats.opens++;
        stats.uniqueOpens.add(event.email);
      } else if (eventType === "click") {
        stats.clicks++;
        stats.uniqueClicks.add(event.email);
      }
    }

    // Update campaign aggregate counts
    for (const [campaignId, stats] of campaignUpdates) {
      // Fetch current values first
      const { data: current } = await supabase
        .from("email_campaigns")
        .select("opens, unique_opens, clicks, unique_clicks")
        .eq("id", campaignId)
        .single();

      if (!current) continue;

      // For unique counts, we need to query actual distinct emails
      const { count: uniqueOpenCount } = await supabase
        .from("email_events")
        .select("email", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("event_type", "open");

      const { count: uniqueClickCount } = await supabase
        .from("email_events")
        .select("email", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("event_type", "click");

      await supabase.from("email_campaigns").update({
        opens: (current.opens || 0) + stats.opens,
        unique_opens: uniqueOpenCount || 0,
        clicks: (current.clicks || 0) + stats.clicks,
        unique_clicks: uniqueClickCount || 0,
      }).eq("id", campaignId);
    }

    return new Response(JSON.stringify({ processed: events.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
