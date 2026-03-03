import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Time-window attribution: finds bookings made within 7 days of a campaign send
 * by customers who received that campaign, and creates attribution records.
 * Called after a campaign is sent or on a schedule.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Process all sent campaigns from last 8 days
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    const { data: recentCampaigns, error: campErr } = await supabase
      .from("email_campaigns")
      .select("id, segment, sent_at")
      .eq("status", "sent")
      .gte("sent_at", eightDaysAgo.toISOString());

    if (campErr) throw campErr;
    if (!recentCampaigns?.length) {
      return new Response(JSON.stringify({ message: "No recent campaigns to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all bookings with customer emails
    const { data: allBookings, error: bookErr } = await supabase
      .from("bookings")
      .select("id, customer_email, total_price, created_at, campaign_id, status")
      .gte("created_at", eightDaysAgo.toISOString())
      .not("customer_email", "is", null)
      .in("status", ["Confirmed", "Completed"]);

    if (bookErr) throw bookErr;

    // Get all customer emails from bookings for segmentation
    const { data: allBookingsForSegment } = await supabase
      .from("bookings")
      .select("customer_email, customer_name, status, booking_date")
      .not("customer_email", "is", null);

    // Build email segments (same logic as frontend)
    const customerMap = new Map<string, { completedCount: number; lastBooking: string }>();
    for (const b of (allBookingsForSegment || [])) {
      if (!b.customer_email) continue;
      const key = b.customer_email.toLowerCase().trim();
      const existing = customerMap.get(key);
      const isCompleted = b.status === "Completed";
      if (existing) {
        if (isCompleted) existing.completedCount++;
        if (b.booking_date > existing.lastBooking) existing.lastBooking = b.booking_date;
      } else {
        customerMap.set(key, { completedCount: isCompleted ? 1 : 0, lastBooking: b.booking_date });
      }
    }

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoff = threeMonthsAgo.toISOString().slice(0, 10);

    function getSegmentEmails(segment: string): Set<string> {
      const all = Array.from(customerMap.keys());
      switch (segment) {
        case "one-timers":
          return new Set(all.filter(e => customerMap.get(e)!.completedCount === 1));
        case "lost-regulars":
          return new Set(all.filter(e => {
            const c = customerMap.get(e)!;
            return c.completedCount >= 2 && c.lastBooking < cutoff;
          }));
        case "vips":
          return new Set(all.filter(e => customerMap.get(e)!.completedCount > 5));
        default:
          return new Set(all);
      }
    }

    // Get existing attributions to avoid duplicates
    const { data: existingAttrs } = await supabase
      .from("campaign_attributions")
      .select("campaign_id, booking_id");
    const attrSet = new Set((existingAttrs || []).map(a => `${a.campaign_id}:${a.booking_id}`));

    let created = 0;

    for (const campaign of recentCampaigns) {
      if (!campaign.sent_at) continue;
      const sentAt = new Date(campaign.sent_at);
      const windowEnd = new Date(sentAt);
      windowEnd.setDate(windowEnd.getDate() + 7);

      const segmentEmails = getSegmentEmails(campaign.segment);

      for (const booking of (allBookings || [])) {
        if (!booking.customer_email) continue;
        const bookingEmail = booking.customer_email.toLowerCase().trim();

        // Skip if already attributed
        const key = `${campaign.id}:${booking.id}`;
        if (attrSet.has(key)) continue;

        // Check if customer was in the segment
        if (!segmentEmails.has(bookingEmail)) continue;

        const bookingCreated = new Date(booking.created_at);

        // Direct attribution (UTM link)
        if (booking.campaign_id === campaign.id) {
          await supabase.from("campaign_attributions").insert({
            campaign_id: campaign.id,
            booking_id: booking.id,
            attribution_type: "direct",
            revenue: Number(booking.total_price),
          });
          attrSet.add(key);
          created++;
          continue;
        }

        // Time-window attribution: booked within 7 days of campaign send
        if (bookingCreated >= sentAt && bookingCreated <= windowEnd) {
          await supabase.from("campaign_attributions").insert({
            campaign_id: campaign.id,
            booking_id: booking.id,
            attribution_type: "time_window",
            revenue: Number(booking.total_price),
          });
          attrSet.add(key);
          created++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, attributions_created: created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Attribution error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
