import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseTimeToMinutes(time: string): number {
  const [h, m] = (time || "00:00").split(":");
  return parseInt(h || "0", 10) * 60 + parseInt(m || "0", 10);
}

function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

interface Window { start: number; end: number }

function mergeWindows(ws: Window[]): Window[] {
  if (ws.length <= 1) return ws;
  const sorted = [...ws].sort((a, b) => a.start - b.start);
  const out: Window[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i].start <= last.end) last.end = Math.max(last.end, sorted[i].end);
    else out.push(sorted[i]);
  }
  return out;
}

function subtractBlock(ws: Window[], bs: number, be: number): Window[] {
  const out: Window[] = [];
  for (const w of ws) {
    if (be <= w.start || bs >= w.end) { out.push(w); continue; }
    if (w.start < bs) out.push({ start: w.start, end: bs });
    if (w.end > be) out.push({ start: be, end: w.end });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fg_service_id, bb_service_id, fg_duration, bb_duration, start_date, days = 14 } = await req.json();
    if (!fg_service_id || !bb_service_id || !fg_duration || !bb_duration || !start_date) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const startD = new Date(start_date + "T00:00:00Z");
    const endD = new Date(startD); endD.setUTCDate(endD.getUTCDate() + days);
    const startStr = fmtDate(startD); const endStr = fmtDate(endD);

    // Load groomers (active, accepting bookings)
    const { data: staffRaw } = await supabase
      .from("staff")
      .select("id, name, employment_end_date, is_accepting_bookings, block_new_bookings");
    const staff = (staffRaw || []).filter((s: any) => s.is_accepting_bookings && !s.block_new_bookings);

    // staff_services
    const { data: ssRaw } = await supabase.from("staff_services").select("staff_id, service_id");
    const ss = ssRaw || [];
    const canDo = (staffId: string, serviceId: string) => {
      const rows = ss.filter((r: any) => r.staff_id === staffId);
      if (rows.length === 0) return true;
      return rows.some((r: any) => r.service_id === serviceId);
    };
    const fgGroomers = staff.filter((g: any) => canDo(g.id, fg_service_id));
    const bbGroomers = staff.filter((g: any) => canDo(g.id, bb_service_id));
    const fgIds = new Set(fgGroomers.map((g: any) => g.id));
    const bbOnlyGroomers = bbGroomers.filter((g: any) => !fgIds.has(g.id));
    if (!fgGroomers.length || !bbOnlyGroomers.length) {
      return new Response(JSON.stringify({ suggestion: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Base availability
    const { data: avail } = await supabase
      .from("staff_availability")
      .select("staff_id, day_of_week, start_time, end_time, is_available")
      .eq("is_available", true);

    // Overrides in window
    const { data: overrides } = await supabase
      .from("staff_schedule_overrides")
      .select("staff_id, override_date, start_time, end_time, is_working")
      .gte("override_date", startStr).lte("override_date", endStr);

    // Bookings in window
    const { data: bookings } = await supabase
      .from("bookings")
      .select("booking_date, booking_time, staff_id, duration_minutes, services(duration_minutes), breeds(duration_minutes)")
      .gte("booking_date", startStr).lte("booking_date", endStr)
      .not("status", "in", "(Cancelled,No Show,Refunded)");

    const { data: migrated } = await supabase
      .from("migrated_bookings")
      .select("booking_date, booking_time, staff_name, duration_minutes")
      .gte("booking_date", startStr).lte("booking_date", endStr)
      .eq("is_future_booking", true);

    // Map migrated to staff
    const allBookings: Array<{ date: string; staff_id: string; start: number; end: number }> = [];
    for (const b of (bookings || [])) {
      const dur = Number((b as any).duration_minutes ?? (b as any).services?.duration_minutes ?? (b as any).breeds?.duration_minutes ?? 90);
      const s = parseTimeToMinutes((b as any).booking_time);
      allBookings.push({ date: (b as any).booking_date, staff_id: (b as any).staff_id, start: s, end: s + dur });
    }
    for (const m of (migrated || [])) {
      if (!(m as any).booking_time) continue;
      const fn = (m as any).staff_name?.split(" ")[0]?.toLowerCase();
      const matched = staff.find((g: any) => g.name?.split(" ")[0]?.toLowerCase() === fn);
      if (!matched) continue;
      const dur = Number((m as any).duration_minutes || 90);
      const s = parseTimeToMinutes((m as any).booking_time);
      allBookings.push({ date: (m as any).booking_date, staff_id: matched.id, start: s, end: s + dur });
    }

    function windowsFor(staffId: string, date: Date): Window[] {
      const dateStr = fmtDate(date);
      const ovs = (overrides || []).filter((o: any) => o.staff_id === staffId && o.override_date === dateStr);
      if (ovs.some((o: any) => !o.is_working && !o.start_time && !o.end_time)) return [];
      const dow = (date.getUTCDay() + 6) % 7;
      const base = (avail || []).filter((a: any) => a.staff_id === staffId && a.day_of_week === dow);
      const manual = ovs.filter((o: any) => o.is_working && o.start_time && o.end_time);
      const blocks = ovs.filter((o: any) => !o.is_working && o.start_time && o.end_time);
      let ws: Window[] = [];
      if (manual.length) {
        for (const m of manual) ws.push({ start: parseTimeToMinutes(m.start_time), end: parseTimeToMinutes(m.end_time) });
        for (const b of base) ws.push({ start: parseTimeToMinutes(b.start_time), end: parseTimeToMinutes(b.end_time) });
        ws = mergeWindows(ws);
      } else {
        for (const b of base) ws.push({ start: parseTimeToMinutes(b.start_time), end: parseTimeToMinutes(b.end_time) });
      }
      for (const blk of blocks) ws = subtractBlock(ws, parseTimeToMinutes(blk.start_time), parseTimeToMinutes(blk.end_time));
      return ws;
    }

    function findSlot(date: Date, groomers: any[], duration: number): { time: string; groomer: any } | null {
      const dateStr = fmtDate(date);
      // Active filter
      const active = groomers.filter((g: any) => !g.employment_end_date || g.employment_end_date >= dateStr);
      // Collect candidate times
      const times = new Set<number>();
      const groomerWindows = new Map<string, Window[]>();
      for (const g of active) {
        const ws = windowsFor(g.id, date);
        if (ws.length) {
          groomerWindows.set(g.id, ws);
          for (const w of ws) for (let t = w.start; t + duration <= w.end; t += 30) times.add(t);
        }
      }
      const sorted = Array.from(times).sort((a, b) => a - b);
      for (const t of sorted) {
        const tEnd = t + duration;
        for (const g of active) {
          const ws = groomerWindows.get(g.id); if (!ws) continue;
          if (!ws.some(w => t >= w.start && tEnd <= w.end)) continue;
          const conflict = allBookings.some(b => b.staff_id === g.id && b.date === dateStr && t < b.end && tEnd > b.start);
          if (!conflict) {
            const h = Math.floor(t / 60), m = t % 60;
            return { time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, groomer: g };
          }
        }
      }
      return null;
    }

    let bbCandidate: { date: string; time: string; groomerName: string } | null = null;
    const cursor = new Date(startD);
    for (let i = 0; i <= days; i++) {
      const dateStr = fmtDate(cursor);
      const fgFound = findSlot(cursor, fgGroomers, fg_duration);
      if (fgFound) {
        if (!bbCandidate) {
          return new Response(JSON.stringify({ suggestion: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const diff = Math.round((new Date(dateStr + "T00:00:00Z").getTime() - new Date(bbCandidate.date + "T00:00:00Z").getTime()) / 86_400_000);
        if (diff >= 1) {
          return new Response(JSON.stringify({ suggestion: { ...bbCandidate, fullGroomDate: dateStr, daysSooner: diff } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ suggestion: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!bbCandidate) {
        const bbFound = findSlot(cursor, bbOnlyGroomers, bb_duration);
        if (bbFound) bbCandidate = { date: dateStr, time: bbFound.time, groomerName: bbFound.groomer.name || "one of our groomers" };
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return new Response(JSON.stringify({ suggestion: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[find-earlier-bb-suggestion]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});