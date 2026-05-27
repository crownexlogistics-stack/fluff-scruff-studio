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

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { groomer_id, date, start_time, service_id, booking_source, start_from } = body;
    let { duration_minutes } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ───────────────────────────────────────────────────────────────
    // ASAP MODE — scan forward for first day with at least one slot
    // ───────────────────────────────────────────────────────────────
    if (typeof date === "string" && date.toLowerCase() === "asap") {
      if (!duration_minutes && service_id) {
        const { data: svc } = await supabase
          .from("services")
          .select("duration_minutes")
          .eq("id", service_id)
          .maybeSingle();
        if (svc?.duration_minutes) duration_minutes = svc.duration_minutes;
      }
      if (!duration_minutes) duration_minutes = 90;

      if ((booking_source ?? "online") === "online" && !service_id) {
        return new Response(
          JSON.stringify({ available: false, reason: "Service not resolved — please re-select your service and try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let groomerIds: string[] = [];
      if (groomer_id) {
        groomerIds = [groomer_id];
      } else {
        const { data: gs } = await supabase
          .from("staff")
          .select("id")
          .eq("is_accepting_bookings", true)
          .eq("block_new_bookings", false);
        groomerIds = (gs || []).map((g: any) => g.id);
      }

      if (service_id && groomerIds.length) {
        const { data: ssRows } = await supabase
          .from("staff_services")
          .select("staff_id, service_id")
          .in("staff_id", groomerIds);
        const byStaff = new Map<string, Set<string>>();
        for (const r of ssRows || []) {
          if (!byStaff.has(r.staff_id)) byStaff.set(r.staff_id, new Set());
          byStaff.get(r.staff_id)!.add(r.service_id);
        }
        groomerIds = groomerIds.filter(gid => {
          const set = byStaff.get(gid);
          return !set || set.has(service_id);
        });
      }

      if (!groomerIds.length) {
        return new Response(
          JSON.stringify({ available: false, asap: true, next_available_date: null, next_available_slots: [], reason: "No groomers available for this service" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: staffRows } = await supabase
        .from("staff")
        .select("id, name, employment_end_date")
        .in("id", groomerIds);
      const staffById = new Map<string, any>((staffRows || []).map((s: any) => [s.id, s]));

      const scanStart = (typeof start_from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start_from)) ? start_from : todayISO();
      const today0 = todayISO();
      const SCAN_DAYS = 60;
      const GRANULARITY = 30;

      console.log(`[check-availability:asap] from=${scanStart} days=${SCAN_DAYS} groomers=${groomerIds.length} duration=${duration_minutes}`);

      for (let i = 0; i < SCAN_DAYS; i++) {
        const d = addDaysISO(scanStart, i);
        if (d < today0) continue;

        const dateObj = new Date(d + "T00:00:00Z");
        const dbDayOfWeek = (dateObj.getUTCDay() + 6) % 7;

        const [overridesRes, baseRes, bookingsRes, migratedRes] = await Promise.all([
          supabase.from("staff_schedule_overrides").select("staff_id, start_time, end_time, is_working").eq("override_date", d).in("staff_id", groomerIds),
          supabase.from("staff_availability").select("staff_id, start_time, end_time, is_available").eq("day_of_week", dbDayOfWeek).eq("is_available", true).in("staff_id", groomerIds),
          supabase.from("bookings").select("staff_id, booking_time, duration_minutes, services(duration_minutes), breeds(duration_minutes)").eq("booking_date", d).in("staff_id", groomerIds).not("status", "in", "(Cancelled,No Show,Refunded)"),
          supabase.from("migrated_bookings").select("booking_time, duration_minutes, staff_name").eq("booking_date", d).eq("is_future_booking", true),
        ]);

        const overridesByStaff = new Map<string, any[]>();
        for (const o of overridesRes.data || []) {
          if (!overridesByStaff.has(o.staff_id)) overridesByStaff.set(o.staff_id, []);
          overridesByStaff.get(o.staff_id)!.push(o);
        }
        const baseByStaff = new Map<string, any[]>();
        for (const b of baseRes.data || []) {
          if (!baseByStaff.has(b.staff_id)) baseByStaff.set(b.staff_id, []);
          baseByStaff.get(b.staff_id)!.push(b);
        }
        const bookingsByStaff = new Map<string, any[]>();
        for (const b of bookingsRes.data || []) {
          if (!bookingsByStaff.has(b.staff_id)) bookingsByStaff.set(b.staff_id, []);
          bookingsByStaff.get(b.staff_id)!.push(b);
        }

        const slotsForDay = new Set<string>();

        for (const gid of groomerIds) {
          const staff = staffById.get(gid);
          if (!staff) continue;
          if (staff.employment_end_date && staff.employment_end_date < d) continue;

          const ovs = overridesByStaff.get(gid) || [];
          const fullDayOff = ovs.some((o: any) => !o.is_working && !o.start_time && !o.end_time);
          if (fullDayOff) continue;

          const partialBlocks = ovs.filter((o: any) => !o.is_working && o.start_time && o.end_time);
          const manualOpenings = ovs.filter((o: any) => o.is_working && o.start_time && o.end_time);
          const base = baseByStaff.get(gid) || [];

          let windows: { start: number; end: number }[] = [];
          if (manualOpenings.length > 0) {
            for (const mo of manualOpenings) windows.push({ start: parseTimeToMinutes(mo.start_time), end: parseTimeToMinutes(mo.end_time) });
            for (const bs of base) windows.push({ start: parseTimeToMinutes(bs.start_time), end: parseTimeToMinutes(bs.end_time) });
            windows.sort((a, b) => a.start - b.start);
            const merged: { start: number; end: number }[] = windows.length ? [windows[0]] : [];
            for (let k = 1; k < windows.length; k++) {
              const last = merged[merged.length - 1];
              if (windows[k].start <= last.end) last.end = Math.max(last.end, windows[k].end);
              else merged.push(windows[k]);
            }
            windows = merged;
          } else if (base.length > 0) {
            for (const bs of base) windows.push({ start: parseTimeToMinutes(bs.start_time), end: parseTimeToMinutes(bs.end_time) });
          }

          for (const block of partialBlocks) {
            const bStart = parseTimeToMinutes(block.start_time);
            const bEnd = parseTimeToMinutes(block.end_time);
            const nw: { start: number; end: number }[] = [];
            for (const w of windows) {
              if (bEnd <= w.start || bStart >= w.end) nw.push(w);
              else {
                if (w.start < bStart) nw.push({ start: w.start, end: bStart });
                if (w.end > bEnd) nw.push({ start: bEnd, end: w.end });
              }
            }
            windows = nw;
          }

          if (!windows.length) continue;

          const intervals: { start: number; end: number }[] = [];
          for (const b of bookingsByStaff.get(gid) || []) {
            const s = parseTimeToMinutes(b.booking_time);
            const dur = Number(b.duration_minutes ?? b.services?.duration_minutes ?? b.breeds?.duration_minutes ?? 90);
            intervals.push({ start: s, end: s + dur });
          }
          const firstName = (staff.name || "").split(" ")[0]?.toLowerCase() || "";
          for (const mb of migratedRes.data || []) {
            if (!mb.booking_time) continue;
            const mbFirst = (mb.staff_name || "").split(" ")[0]?.toLowerCase() || "";
            if (mbFirst !== firstName) continue;
            const s = parseTimeToMinutes(mb.booking_time);
            const dur = Number(mb.duration_minutes || 90);
            intervals.push({ start: s, end: s + dur });
          }

          let minStart = 0;
          if (d === today0) {
            const now = new Date();
            minStart = now.getHours() * 60 + now.getMinutes() + 30;
          }

          for (const w of windows) {
            const startAt = Math.max(w.start, Math.ceil(minStart / GRANULARITY) * GRANULARITY);
            for (let t = startAt; t + duration_minutes <= w.end; t += GRANULARITY) {
              const slotEnd = t + duration_minutes;
              const overlaps = intervals.some(iv => t < iv.end && slotEnd > iv.start);
              if (!overlaps) slotsForDay.add(minutesToTime(t));
            }
          }
        }

        if (slotsForDay.size > 0) {
          const sorted = Array.from(slotsForDay).sort();
          console.log(`[check-availability:asap] Found ${sorted.length} slots on ${d}`);
          return new Response(
            JSON.stringify({ available: false, asap: true, next_available_date: d, next_available_slots: sorted }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ available: false, asap: true, next_available_date: null, next_available_slots: [], reason: "No availability in the next 60 days" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!groomer_id || !date || !start_time || !duration_minutes) {
      return new Response(
        JSON.stringify({ available: false, reason: "Missing required fields: groomer_id, date, start_time, duration_minutes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Online bookings MUST include a resolved service_id. Without it the
    // staff_services restriction can be silently bypassed (see Mollie/Bohdan
    // incident). Staff-initiated bookings may still be checked without one.
    if ((booking_source ?? "online") === "online" && !service_id) {
      console.log("[check-availability] BLOCKED: online booking without service_id");
      return new Response(
        JSON.stringify({ available: false, reason: "Service not resolved — please re-select your service and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // ── 1b. Check staff_services restriction ──
    // Rule: a groomer with NO rows in staff_services is treated as able to do
    // ALL services (safe fallback for legacy groomers). A groomer with at least
    // one row is restricted to those service_ids only.
    if (service_id) {
      const { data: assigned } = await supabase
        .from("staff_services")
        .select("service_id")
        .eq("staff_id", groomer_id);
      const rows = assigned || [];
      if (rows.length > 0) {
        const allowed = rows.some((r: any) => r.service_id === service_id);
        if (!allowed) {
          console.log(`[check-availability] BLOCKED: groomer ${staff.name} not assigned to service ${service_id}`);
          return new Response(
            JSON.stringify({ available: false, reason: "This groomer does not perform this service" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
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
