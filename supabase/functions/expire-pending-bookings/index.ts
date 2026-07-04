import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hourly sweeper — cancels online Pending bookings older than 2 hours that
// never received payment. Belt-and-braces backup to the Stripe webhook.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: stale, error } = await supabase
      .from("bookings")
      .select("id, customer_name, booking_date, booking_time")
      .eq("booking_source", "online")
      .eq("status", "Pending")
      .eq("deposit_paid", 0)
      .is("stripe_payment_id", null)
      .lt("created_at", cutoff);

    if (error) throw error;

    const ids = (stale ?? []).map((b) => b.id);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ ok: true, cancelled: 0, ids: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip any booking that has been rescheduled after creation — staff have
    // touched it, so it's not an abandoned checkout even if the deposit is £0.
    const { data: rescheduledRows } = await supabase
      .from("booking_audit_log")
      .select("booking_id")
      .in("booking_id", ids)
      .eq("event_type", "rescheduled");

    const rescheduledIds = new Set((rescheduledRows ?? []).map((r: any) => r.booking_id));
    const cancellableIds = ids.filter((id) => !rescheduledIds.has(id));
    const skippedIds = ids.filter((id) => rescheduledIds.has(id));

    if (cancellableIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, cancelled: 0, ids: [], skipped_rescheduled: skippedIds }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase.from("bookings").update({ status: "Cancelled" }).in("id", cancellableIds);

    const logRows = cancellableIds.map((id) => ({
      booking_id: id,
      event_type: "cancelled",
      performed_by: "System (expire-pending-bookings)",
      note: "Auto-cancelled — no payment received within 2 hours of booking.",
    }));
    await supabase.from("booking_audit_log").insert(logRows as any);

    return new Response(JSON.stringify({
      ok: true,
      cancelled: cancellableIds.length,
      ids: cancellableIds,
      skipped_rescheduled: skippedIds,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("expire-pending-bookings error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});