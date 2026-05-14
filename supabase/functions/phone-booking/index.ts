import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SALON_OPEN = 9 * 60;   // 09:00
const SALON_CLOSE = 18 * 60; // 18:00
const SLOT_STEP = 30;        // minutes

function parseTime(t: string): number {
  const [h, m] = (t || "00:00").split(":");
  return parseInt(h || "0", 10) * 60 + parseInt(m || "0", 10);
}

function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function dayOfWeekDb(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  return (d.getUTCDay() + 6) % 7; // 0=Mon
}

function nextDate(dateStr: string, addDays: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10);
}

function normalizePhone(raw: string): string {
  let p = (raw || "").trim().replace(/[\s\-\(\)]/g, "");
  if (p.startsWith("0")) p = "+44" + p.slice(1);
  else if (!p.startsWith("+")) p = "+44" + p;
  return p;
}

interface Window { start: number; end: number }

async function getGroomerWindows(
  supabase: any,
  staffId: string,
  date: string,
): Promise<Window[]> {
  const { data: overrides } = await supabase
    .from("staff_schedule_overrides")
    .select("start_time, end_time, is_working")
    .eq("staff_id", staffId)
    .eq("override_date", date);

  const list = overrides || [];
  const fullDayOff = list.some(
    (o: any) => !o.is_working && !o.start_time && !o.end_time,
  );
  if (fullDayOff) return [];

  const partialBlocks = list.filter(
    (o: any) => !o.is_working && o.start_time && o.end_time,
  );
  const manualOpenings = list.filter(
    (o: any) => o.is_working && o.start_time && o.end_time,
  );

  const dbDow = dayOfWeekDb(date);
  const { data: baseSchedule } = await supabase
    .from("staff_availability")
    .select("start_time, end_time, is_available")
    .eq("staff_id", staffId)
    .eq("day_of_week", dbDow)
    .eq("is_available", true);

  let windows: Window[] = [];
  if (manualOpenings.length > 0) {
    for (const mo of manualOpenings) {
      windows.push({ start: parseTime(mo.start_time), end: parseTime(mo.end_time) });
    }
    for (const bs of baseSchedule || []) {
      windows.push({ start: parseTime(bs.start_time), end: parseTime(bs.end_time) });
    }
  } else if (baseSchedule && baseSchedule.length > 0) {
    for (const bs of baseSchedule) {
      windows.push({ start: parseTime(bs.start_time), end: parseTime(bs.end_time) });
    }
  }

  if (windows.length === 0) return [];

  // Merge overlapping
  windows.sort((a, b) => a.start - b.start);
  const merged: Window[] = [windows[0]];
  for (let i = 1; i < windows.length; i++) {
    const last = merged[merged.length - 1];
    if (windows[i].start <= last.end) last.end = Math.max(last.end, windows[i].end);
    else merged.push(windows[i]);
  }
  windows = merged;

  // Subtract partial blocks
  for (const block of partialBlocks) {
    const bStart = parseTime(block.start_time);
    const bEnd = parseTime(block.end_time);
    const next: Window[] = [];
    for (const w of windows) {
      if (bEnd <= w.start || bStart >= w.end) next.push(w);
      else {
        if (w.start < bStart) next.push({ start: w.start, end: bStart });
        if (w.end > bEnd) next.push({ start: bEnd, end: w.end });
      }
    }
    windows = next;
  }

  return windows;
}

async function getGroomerBusy(
  supabase: any,
  staffId: string,
  staffName: string,
  date: string,
): Promise<Window[]> {
  const busy: Window[] = [];

  const { data: bookings } = await supabase
    .from("bookings")
    .select("booking_time, duration_minutes, services(duration_minutes), breeds(duration_minutes), status")
    .eq("booking_date", date)
    .eq("staff_id", staffId)
    .not("status", "in", "(Cancelled,No Show,Refunded)");

  for (const b of bookings || []) {
    const start = parseTime(b.booking_time);
    const dur = Number(
      b.duration_minutes ??
        (b as any).services?.duration_minutes ??
        (b as any).breeds?.duration_minutes ??
        90,
    );
    busy.push({ start, end: start + dur });
  }

  const firstName = staffName.split(" ")[0] || staffName;
  const { data: migrated } = await supabase
    .from("migrated_bookings")
    .select("booking_time, duration_minutes, staff_name")
    .eq("booking_date", date)
    .eq("is_future_booking", true)
    .or(`staff_name.eq.${staffName},staff_name.ilike.${staffName},staff_name.ilike.${firstName}%`);

  for (const mb of migrated || []) {
    if (!mb.booking_time) continue;
    const start = parseTime(mb.booking_time);
    const dur = Number(mb.duration_minutes || 0) || 90;
    busy.push({ start, end: start + dur });
  }

  return busy;
}

function findSlotsForGroomer(
  windows: Window[],
  busy: Window[],
  duration: number,
): number[] {
  const slots: number[] = [];
  for (const w of windows) {
    let t = Math.max(w.start, SALON_OPEN);
    // align to next SLOT_STEP boundary
    if (t % SLOT_STEP !== 0) t += SLOT_STEP - (t % SLOT_STEP);
    while (t + duration <= w.end && t + duration <= SALON_CLOSE) {
      const slotEnd = t + duration;
      const conflict = busy.some((b) => t < b.end && slotEnd > b.start);
      if (!conflict) slots.push(t);
      t += SLOT_STEP;
    }
  }
  return slots;
}

async function findAvailableSlots(
  supabase: any,
  date: string,
  duration: number,
  serviceId: string,
): Promise<{ time: string; groomer: string; staff_id: string }[]> {
  // Find groomers who can perform this service.
  // Rule (mirrors check-availability): if a groomer has rows in staff_services,
  // they're restricted to those services. If they have NO rows, they can do all.
  const { data: allStaff } = await supabase
    .from("staff")
    .select("id, name, is_accepting_bookings, block_new_bookings, employment_end_date")
    .eq("is_accepting_bookings", true)
    .or("block_new_bookings.is.null,block_new_bookings.eq.false")
    .or(`employment_end_date.is.null,employment_end_date.gte.${date}`);

  const staffList = allStaff || [];
  if (staffList.length === 0) return [];

  const staffIds = staffList.map((s: any) => s.id);
  const { data: assignments } = await supabase
    .from("staff_services")
    .select("staff_id, service_id")
    .in("staff_id", staffIds);

  const assignmentsByStaff = new Map<string, Set<string>>();
  for (const a of assignments || []) {
    if (!assignmentsByStaff.has(a.staff_id)) {
      assignmentsByStaff.set(a.staff_id, new Set());
    }
    assignmentsByStaff.get(a.staff_id)!.add(a.service_id);
  }

  const eligible = staffList.filter((s: any) => {
    const set = assignmentsByStaff.get(s.id);
    if (!set || set.size === 0) return true; // legacy: can do all
    return set.has(serviceId);
  });

  const result: { time: string; groomer: string; staff_id: string }[] = [];
  for (const g of eligible) {
    const windows = await getGroomerWindows(supabase, g.id, date);
    if (windows.length === 0) continue;
    const busy = await getGroomerBusy(supabase, g.id, g.name, date);
    const slots = findSlotsForGroomer(windows, busy, duration);
    for (const s of slots) {
      result.push({ time: fmtTime(s), groomer: g.name.split(" ")[0], staff_id: g.id });
    }
  }

  result.sort((a, b) => parseTime(a.time) - parseTime(b.time));
  return result;
}

async function sendSms(phone: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) {
    console.error("[phone-booking] Twilio creds missing");
    return;
  }
  const MESSAGING_SERVICE_SID = "MG3c95c22cb05574f545cc1b32d9db4600";
  const params = new URLSearchParams();
  params.append("To", phone);
  params.append("MessagingServiceSid", MESSAGING_SERVICE_SID);
  params.append("Body", body);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      },
      body: params.toString(),
    },
  );
  if (!res.ok) {
    console.error("[phone-booking] Twilio error", await res.text());
  }
}

async function sendEmail(subject: string, htmlBody: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[phone-booking] RESEND_API_KEY missing");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Fluff & Scruff Studio <bookings@fluffandscruff.co.uk>",
      to: ["info@fluffandscruff.co.uk"],
      subject,
      html: htmlBody,
    }),
  });
  if (!res.ok) {
    console.error("[phone-booking] Resend error", await res.text());
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = body?.action;
  console.log(`[phone-booking] action=${action}`, body);

  try {
    // ─────────────────────────── get_services ───────────────────────────
    if (action === "get_services") {
      const { data, error } = await supabase
        .from("services")
        .select("name")
        .eq("is_active", true)
        .order("name");
      if (error) return json({ error: error.message }, 500);
      return json({ services: (data || []).map((s: any) => s.name) });
    }

    // ─────────────────────────── check_availability ───────────────────────────
    if (action === "check_availability") {
      const { date, service_name, breed_name } = body;
      if (!date || !service_name) {
        return json({ error: "date and service_name are required" }, 400);
      }

      const { data: service } = await supabase
        .from("services")
        .select("id, duration_minutes")
        .ilike("name", service_name)
        .eq("is_active", true)
        .maybeSingle();
      if (!service) return json({ error: `Service "${service_name}" not found` }, 404);

      let duration = Number(service.duration_minutes || 0);
      if (breed_name) {
        const { data: breed } = await supabase
          .from("breeds")
          .select("duration_minutes")
          .ilike("name", breed_name)
          .maybeSingle();
        if (breed?.duration_minutes) duration = Number(breed.duration_minutes);
      }
      // breed_name is OPTIONAL — if not provided (or unknown), fall back to 90 min
      // so the AI can quote availability before the breed is mentioned.
      if (!duration || duration <= 0) duration = 90;

      const slots = await findAvailableSlots(supabase, date, duration, service.id);

      if (slots.length > 0) {
        return json({
          available: true,
          slots: slots.slice(0, 10).map((s) => ({ time: s.time, groomer: s.groomer })),
        });
      }

      // Look ahead up to 14 days for next available
      let nextAvail: string | null = null;
      for (let i = 1; i <= 14; i++) {
        const candidate = nextDate(date, i);
        const s = await findAvailableSlots(supabase, candidate, duration, service.id);
        if (s.length > 0) { nextAvail = candidate; break; }
      }

      return json({
        available: false,
        message: "No availability on that date",
        next_available: nextAvail,
      });
    }

    // ─────────────────────────── create_booking ───────────────────────────
    if (action === "create_booking") {
      const {
        customer_name, customer_phone, dog_name, breed_name,
        service_name, date, time, groomer_name, notes,
      } = body;

      if (!customer_name || !customer_phone || !dog_name || !service_name ||
          !date || !time || !groomer_name) {
        return json({ error: "Missing required booking fields" }, 400);
      }

      const { data: service } = await supabase
        .from("services")
        .select("id, fixed_price, duration_minutes")
        .ilike("name", service_name)
        .eq("is_active", true)
        .maybeSingle();
      if (!service) return json({ error: `Service "${service_name}" not found` }, 404);

      let breedId: string | null = null;
      let duration = Number(service.duration_minutes || 0);
      if (breed_name) {
        const { data: breed } = await supabase
          .from("breeds")
          .select("id, duration_minutes")
          .ilike("name", breed_name)
          .maybeSingle();
        if (breed) {
          breedId = breed.id;
          if (breed.duration_minutes) duration = Number(breed.duration_minutes);
        }
      }
      if (!duration || duration <= 0) duration = 90;

      // Find groomer (match by full name or first name)
      const { data: staffMatches } = await supabase
        .from("staff")
        .select("id, name, is_accepting_bookings, block_new_bookings, employment_end_date")
        .or(`name.ilike.${groomer_name},name.ilike.${groomer_name}%`);
      const groomer = (staffMatches || []).find((s: any) =>
        s.is_accepting_bookings && !s.block_new_bookings &&
        (!s.employment_end_date || s.employment_end_date >= date),
      );
      if (!groomer) return json({ error: `Groomer "${groomer_name}" not available` }, 404);

      // Lookup price
      let totalPrice = Number(service.fixed_price || 0);
      if (breedId) {
        const { data: priceRow } = await supabase
          .from("service_prices")
          .select("price")
          .eq("service_id", service.id)
          .eq("breed_id", breedId)
          .maybeSingle();
        if (priceRow?.price != null) totalPrice = Number(priceRow.price);
      }
      if (!totalPrice || totalPrice <= 0) totalPrice = 52; // estimate fallback

      // Re-verify availability via the existing edge function for consistency
      const verifyRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/check-availability`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            groomer_id: groomer.id,
            date,
            start_time: time,
            duration_minutes: duration,
            service_id: service.id,
          }),
        },
      );
      const verify = await verifyRes.json();
      if (!verify?.available) {
        return json({
          success: false,
          error: verify?.reason || "That time slot is no longer available",
        }, 409);
      }

      const phoneNorm = normalizePhone(customer_phone);

      const { data: inserted, error: insertErr } = await supabase
        .from("bookings")
        .insert({
          customer_name,
          customer_phone: phoneNorm,
          dog_name,
          breed_id: breedId,
          service_id: service.id,
          staff_id: groomer.id,
          booking_date: date,
          booking_time: time,
          duration_minutes: duration,
          total_price: totalPrice,
          deposit_paid: 0,
          status: "Pending",
          booking_source: "phone_ai",
          created_by_staff: "AI Receptionist",
          notes: notes || null,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("[phone-booking] insert error", insertErr);
        return json({ success: false, error: "Failed to create booking" }, 500);
      }

      // Audit trail — booking created by AI
      supabase.from("booking_audit_log").insert({
        booking_id: inserted.id,
        event_type: "created_by_ai",
        performed_by: "AI Receptionist",
        new_date: date,
        new_time: time,
        note: "Booking created by AI phone receptionist",
      }).then(({ error }: any) => {
        if (error) console.error("[phone-booking] audit log failed", error);
      });

      // Groomer activity log
      supabase.from("groomer_activity_log").insert({
        staff_id: groomer.id,
        action_type: "booking_created",
        action_summary:
          `AI Receptionist booked ${customer_name} (${dog_name}) for ` +
          `${service_name} on ${date} at ${time} via phone call`,
        booking_id: inserted.id,
        customer_name,
        dog_name,
        booking_date: date,
        booking_time: time,
        service_name,
        extra_details: { source: "phone_ai", performed_by: "AI Receptionist" },
      }).then(({ error }: any) => {
        if (error) console.error("[phone-booking] activity log failed", error);
      });

      // Queue a deposit-link SMS for ~3 minutes from now (sender cron picks it up).
      let depositQueued = false;
      const { error: queueErr } = await supabase
        .from("phone_booking_deposit_queue")
        .insert({
          booking_id: inserted.id,
          customer_phone: phoneNorm,
          customer_name,
          status: "pending",
        });
      if (queueErr) {
        console.error("[phone-booking] deposit queue insert failed", queueErr);
      } else {
        depositQueued = true;
      }

      const groomerFirst = groomer.name.split(" ")[0] || groomer.name;
      const customerFirst = customer_name.split(" ")[0] || customer_name;
      const smsBody =
        `Hi ${customerFirst}, your grooming appointment for ${dog_name} has been ` +
        `received for ${date} at ${time} with ${groomerFirst} at Fluff & Scruff Studio. ` +
        `We will be in touch shortly to confirm. Call 01708 606655 with any questions.`;

      // Best-effort notifications — don't fail the booking on these
      sendSms(phoneNorm, smsBody).catch((e) =>
        console.error("[phone-booking] sms failed", e),
      );

      const emailHtml = `
        <h2>📞 New Phone Booking</h2>
        <p><strong>Customer:</strong> ${customer_name}</p>
        <p><strong>Phone:</strong> ${phoneNorm}</p>
        <p><strong>Dog:</strong> ${dog_name} (${breed_name || "breed not given"})</p>
        <p><strong>Service:</strong> ${service_name}</p>
        <p><strong>Date / Time:</strong> ${date} at ${time}</p>
        <p><strong>Groomer:</strong> ${groomer.name}</p>
        <p><strong>Duration:</strong> ${duration} min</p>
        <p><strong>Price:</strong> £${totalPrice}</p>
        <p><strong>Notes:</strong> ${notes || "—"}</p>
        <p><strong>Booking ID:</strong> ${inserted.id}</p>
      `;
      sendEmail(
        `📞 Phone Booking — ${customer_name} — ${dog_name} — ${date}`,
        emailHtml,
      ).catch((e) => console.error("[phone-booking] email failed", e));

      return json({
        success: true,
        booking_id: inserted.id,
        message: depositQueued
          ? "Booking created. Deposit link will be sent by SMS shortly."
          : "Booking created successfully",
        deposit_link_queued: depositQueued,
      });
    }

    // ─────────────────────────── lookup_customer ───────────────────────────
    if (action === "lookup_customer") {
      const { phone } = body;
      if (!phone) return json({ error: "phone is required" }, 400);

      // Build candidate phone formats to match against stored values.
      const raw = String(phone).trim().replace(/[\s\-\(\)]/g, "");
      const candidates = new Set<string>([raw]);
      const normalized = normalizePhone(raw);
      candidates.add(normalized);
      // +44XXXXXXXXXX -> 0XXXXXXXXXX
      if (normalized.startsWith("+44")) {
        candidates.add("0" + normalized.slice(3));
        candidates.add(normalized.slice(3));        // bare national number
        candidates.add(normalized.slice(1));        // 44XXXXXXXXXX
      }
      // 0XXXXXXXXXX -> +44XXXXXXXXXX (already covered) and bare 7XXXXXXXXX
      if (raw.startsWith("0")) candidates.add(raw.slice(1));

      const list = Array.from(candidates).filter(Boolean);
      const { data: matches } = await supabase
        .from("bookings")
        .select(
          "customer_name, customer_phone, dog_name, booking_date, breeds(name)",
        )
        .in("customer_phone", list)
        .order("booking_date", { ascending: false });

      if (!matches || matches.length === 0) {
        return json({ found: false });
      }

      const latest: any = matches[0];
      return json({
        found: true,
        customer_name: latest.customer_name,
        dog_name: latest.dog_name,
        breed_name: latest.breeds?.name || null,
        last_visit: latest.booking_date,
        total_visits: matches.length,
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("[phone-booking] error", err);
    return json({ error: err?.message || "Server error" }, 500);
  }
});