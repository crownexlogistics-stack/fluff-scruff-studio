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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { groomer_id, date, start_time, duration_minutes } = await req.json();

    if (!groomer_id || !date || !start_time || !duration_minutes) {
      return new Response(
        JSON.stringify({ available: false, reason: "Missing required fields: groomer_id, date, start_time, duration_minutes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const slotStart = parseTimeToMinutes(start_time);
    const slotEnd = slotStart + Number(duration_minutes);

    console.log(`[check-availability] Checking groomer=${groomer_id} date=${date} time=${start_time} duration=${duration_minutes}min slot=${slotStart}-${slotEnd}`);

    // ── 1. Check groomer exists and is accepting bookings ──
    const { data: staff, error: staffErr } = await supabase
      .from("staff")
      .select("id, name, is_accepting_bookings, block_new_bookings, employment_end_date")
      .eq("id", groomer_id)
      .single();

    if (staffErr || !staff) {
      return new Response(
        JSON.stringify({ available: false, reason: "Groomer not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (staff.block_new_bookings) {
      console.log(`[check-availability] BLOCKED: groomer ${staff.name} has block_new_bookings=true`);
      return new Response(
        JSON.stringify({ available: false, reason: "This groomer is not currently accepting new bookings" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!staff.is_accepting_bookings) {
      console.log(`[check-availability] BLOCKED: groomer ${staff.name} is_accepting_bookings=false`);
      return new Response(
        JSON.stringify({ available: false, reason: "This groomer is not currently accepting bookings" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (staff.employment_end_date && staff.employment_end_date < date) {
      console.log(`[check-availability] BLOCKED: groomer ${staff.name} employment ended ${staff.employment_end_date}`);
      return new Response(
        JSON.stringify({ available: false, reason: "This groomer is no longer available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Check schedule overrides (blocks / days off) ──
    const { data: overrides } = await supabase
      .from("staff_schedule_overrides")
      .select("start_time, end_time, is_working")
      .eq("staff_id", groomer_id)
      .eq("override_date", date);

    const overrideList = overrides || [];

    // Full day off: is_working=false with null times
    const fullDayOff = overrideList.some(
      (o: any) => !o.is_working && !o.start_time && !o.end_time
    );
    if (fullDayOff) {
      console.log(`[check-availability] BLOCKED: groomer has full day off override on ${date}`);
      return new Response(
        JSON.stringify({ available: false, reason: "This groomer is not working on this date" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Partial blocks: is_working=false WITH specific times
    const partialBlocks = overrideList.filter(
      (o: any) => !o.is_working && o.start_time && o.end_time
    );
    for (const block of partialBlocks) {
      const blockStart = parseTimeToMinutes(block.start_time);
      const blockEnd = parseTimeToMinutes(block.end_time);
      if (slotStart < blockEnd && slotEnd > blockStart) {
        console.log(`[check-availability] BLOCKED: slot overlaps with block ${block.start_time}-${block.end_time}`);
        return new Response(
          JSON.stringify({ available: false, reason: "This time slot overlaps with a blocked period" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 3. Check working hours ──
    // Manual openings (overtime) for this date
    const manualOpenings = overrideList.filter(
      (o: any) => o.is_working && o.start_time && o.end_time
    );

    // Convert date to day_of_week (DB format: 0=Mon ... 6=Sun)
    const dateObj = new Date(date + "T00:00:00Z");
    const jsDay = dateObj.getUTCDay(); // 0=Sun
    const dbDayOfWeek = (jsDay + 6) % 7; // 0=Mon

    const { data: baseSchedule } = await supabase
      .from("staff_availability")
      .select("start_time, end_time, is_available")
      .eq("staff_id", groomer_id)
      .eq("day_of_week", dbDayOfWeek)
      .eq("is_available", true);

    // Build working windows
    interface TimeWindow { start: number; end: number }
    let windows: TimeWindow[] = [];

    if (manualOpenings.length > 0) {
      // Manual openings + base schedule merged
      for (const mo of manualOpenings) {
        windows.push({ start: parseTimeToMinutes(mo.start_time), end: parseTimeToMinutes(mo.end_time) });
      }
      for (const bs of (baseSchedule || [])) {
        windows.push({ start: parseTimeToMinutes(bs.start_time), end: parseTimeToMinutes(bs.end_time) });
      }
      // Merge overlapping
      windows.sort((a, b) => a.start - b.start);
      const merged: TimeWindow[] = [windows[0]];
      for (let i = 1; i < windows.length; i++) {
        const last = merged[merged.length - 1];
        if (windows[i].start <= last.end) {
          last.end = Math.max(last.end, windows[i].end);
        } else {
          merged.push(windows[i]);
        }
      }
      windows = merged;
    } else if (baseSchedule && baseSchedule.length > 0) {
      for (const bs of baseSchedule) {
        windows.push({ start: parseTimeToMinutes(bs.start_time), end: parseTimeToMinutes(bs.end_time) });
      }
    }

    // Subtract partial blocks from windows
    for (const block of partialBlocks) {
      const bStart = parseTimeToMinutes(block.start_time);
      const bEnd = parseTimeToMinutes(block.end_time);
      const newWindows: TimeWindow[] = [];
      for (const w of windows) {
        if (bEnd <= w.start || bStart >= w.end) {
          newWindows.push(w);
        } else {
          if (w.start < bStart) newWindows.push({ start: w.start, end: bStart });
          if (w.end > bEnd) newWindows.push({ start: bEnd, end: w.end });
        }
      }
      windows = newWindows;
    }

    if (windows.length === 0) {
      console.log(`[check-availability] BLOCKED: no working windows for groomer on ${date} (day=${dbDayOfWeek})`);
      return new Response(
        JSON.stringify({ available: false, reason: "This groomer is not scheduled to work on this day" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fitsInWindow = windows.some(w => slotStart >= w.start && slotEnd <= w.end);
    if (!fitsInWindow) {
      console.log(`[check-availability] BLOCKED: slot ${slotStart}-${slotEnd} doesn't fit any window: ${JSON.stringify(windows)}`);
      return new Response(
        JSON.stringify({ available: false, reason: "This time is outside the groomer's working hours" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Check existing bookings for conflicts ──
    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("id, booking_time, duration_minutes, staff_id, status, services(duration_minutes), breeds(duration_minutes)")
      .eq("booking_date", date)
      .eq("staff_id", groomer_id)
      .not("status", "in", "(Cancelled,No Show,Refunded)");

    console.log(`[check-availability] Found ${(existingBookings || []).length} active bookings for ${staff.name} on ${date}`);
    for (const b of (existingBookings || [])) {
      const bStart = parseTimeToMinutes(b.booking_time);
      const bDuration = Number(
        b.duration_minutes ??
        (b as any).services?.duration_minutes ??
        (b as any).breeds?.duration_minutes ??
        90
      );
      const bEnd = bStart + bDuration;
      console.log(`[check-availability] Existing booking id=${b.id} status=${b.status} time=${b.booking_time} duration=${bDuration}min range=${bStart}-${bEnd}`);
      if (slotStart < bEnd && slotEnd > bStart) {
        console.log(`[check-availability] BLOCKED: overlaps existing booking ${b.booking_time} duration=${bDuration}min`);
        return new Response(
          JSON.stringify({ available: false, reason: "This groomer already has a booking at this time" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 5. Check migrated bookings for conflicts ──
    const staffFullName = staff.name;
    const staffFirstName = staffFullName.split(" ")[0] || staffFullName;

    const { data: migratedBookings } = await supabase
      .from("migrated_bookings")
      .select("id, booking_time, duration_minutes, staff_name")
      .eq("booking_date", date)
      .eq("is_future_booking", true)
      .or(`staff_name.eq.${staffFullName},staff_name.ilike.${staffFullName},staff_name.ilike.${staffFirstName}%`);

    console.log(`[check-availability] Found ${(migratedBookings || []).length} migrated bookings for "${staffFullName}" on ${date}`);
    for (const mb of (migratedBookings || [])) {
      if (!mb.booking_time) continue;

      let mbDuration = Number(mb.duration_minutes || 0);
      if (!mbDuration || mbDuration <= 0) {
        mbDuration = 90;
      }

      const mbStart = parseTimeToMinutes(mb.booking_time);
      const mbEnd = mbStart + mbDuration;
      console.log(`[check-availability] Migrated booking id=${mb.id} staff_name="${mb.staff_name}" time=${mb.booking_time} duration=${mbDuration}min range=${mbStart}-${mbEnd}`);

      if (slotStart < mbEnd && slotEnd > mbStart) {
        console.log(`[check-availability] BLOCKED: overlaps migrated booking ${mb.booking_time} duration=${mbDuration}min`);
        return new Response(
          JSON.stringify({ available: false, reason: "This groomer already has a booking at this time" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── All checks passed ──
    console.log(`[check-availability] AVAILABLE: groomer ${staff.name} is free at ${start_time} on ${date}`);
    return new Response(
      JSON.stringify({ available: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[check-availability] Error:", err);
    return new Response(
      JSON.stringify({ available: false, reason: "Server error checking availability" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
