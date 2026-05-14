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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const OPEN_DOW = [2, 3, 4, 5, 6]; // Tue-Sat

function londonTodayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function dowFromIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function buildDateResponse() {
  const today = londonTodayIso();
  const todayDow = dowFromIso(today);
  const tomorrow = addDaysIso(today, 1);

  const this_week: { day: string; date: string }[] = [];
  for (let offset = 1; offset <= 6 - todayDow; offset++) {
    const iso = addDaysIso(today, offset);
    const dow = (todayDow + offset) % 7;
    if (OPEN_DOW.includes(dow)) {
      this_week.push({ day: DAY_NAMES[dow], date: iso });
    }
  }

  const next_week: { day: string; date: string }[] = [];
  const daysToNextSunday = 7 - todayDow;
  for (let offset = 2; offset <= 6; offset++) {
    const iso = addDaysIso(today, daysToNextSunday + offset);
    next_week.push({ day: DAY_NAMES[offset], date: iso });
  }

  return {
    today,
    today_name: DAY_NAMES[todayDow],
    tomorrow,
    this_week,
    next_week,
    timezone: "Europe/London",
  };
}

const SERVICE_FUZZY: { keywords: string[]; canonical: string }[] = [
  { keywords: ["full groom"], canonical: "Full Groom" },
  { keywords: ["bath and brush", "bath brush", "bath & brush"], canonical: "Bath & Brush" },
  { keywords: ["nail trim", "nail"], canonical: "Nail Trim & Filing" },
  { keywords: ["teeth", "ultrasonic"], canonical: "Ultrasonic Teeth Cleaning" },
  { keywords: ["puppy"], canonical: "Puppy Special" },
];

function fuzzyServiceName(input: string): string {
  const s = (input || "").toLowerCase().trim();
  for (const m of SERVICE_FUZZY) {
    if (m.keywords.some((k) => s.includes(k))) return m.canonical;
  }
  return input;
}

function resolveDate(input: string): string {
  // Get today in London timezone
  const now = new Date();
  const londonFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const londonParts = londonFormatter.formatToParts(now);
  const todayYear = parseInt(londonParts.find(p => p.type === 'year')!.value);
  const todayMonth = parseInt(londonParts.find(p => p.type === 'month')!.value) - 1;
  const todayDay = parseInt(londonParts.find(p => p.type === 'day')!.value);
  const today = new Date(todayYear, todayMonth, todayDay);
  const todayDow = today.getDay();

  const lower = (input || "").toLowerCase().trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return lower;

  if (lower === 'today') {
    return today.toISOString().split('T')[0];
  }
  if (lower === 'tomorrow') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  const dayMap: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6
  };

  const isNext = lower.startsWith('next ');
  const dayWord = lower.replace(/^(next |this )/, '').trim();
  const targetDow = dayMap[dayWord];
  if (targetDow !== undefined) {
    let daysAhead = targetDow - todayDow;
    if (daysAhead <= 0) daysAhead += 7;
    if (isNext) daysAhead += 7;
    const d = new Date(today);
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  }

  const dmyMatch = lower.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1]);
    const month = parseInt(dmyMatch[2]) - 1;
    const year = dmyMatch[3]
      ? (dmyMatch[3].length === 2 ? 2000 + parseInt(dmyMatch[3]) : parseInt(dmyMatch[3]))
      : todayYear;
    const d = new Date(year, month, day);
    return d.toISOString().split('T')[0];
  }

  const months: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1,
    mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, september: 8,
    oct: 9, october: 9, nov: 10, november: 10,
    dec: 11, december: 11
  };

  const ordinalMatch = lower.match(/(\d{1,2})(?:st|nd|rd|th)?[\s,]+([a-z]+)/);
  if (ordinalMatch) {
    const day = parseInt(ordinalMatch[1]);
    const monthKey = ordinalMatch[2];
    const month = months[monthKey];
    if (month !== undefined) {
      const year = todayYear;
      const d = new Date(year, month, day);
      if (d < today) d.setFullYear(year + 1);
      return d.toISOString().split('T')[0];
    }
  }

  const monthFirstMatch = lower.match(/([a-z]+)[\s,]+(\d{1,2})/);
  if (monthFirstMatch) {
    const monthKey = monthFirstMatch[1];
    const day = parseInt(monthFirstMatch[2]);
    const month = months[monthKey];
    if (month !== undefined) {
      const year = todayYear;
      const d = new Date(year, month, day);
      if (d < today) d.setFullYear(year + 1);
      return d.toISOString().split('T')[0];
    }
  }

  const fallback = new Date(today);
  fallback.setDate(fallback.getDate() + 1);
  console.error("Could not parse date:", input, "falling back to tomorrow:", fallback.toISOString().split('T')[0]);
  return fallback.toISOString().split('T')[0];
}

function parseDateInput(input: string): string {
  return resolveDate(input);
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

  const { data: bookings, error: bookingsErr } = await supabase
    .from("bookings")
    .select("booking_time, duration_minutes, services(duration_minutes), breeds(duration_minutes), status")
    .eq("booking_date", date)
    .eq("staff_id", staffId)
    .not("status", "in", '("Cancelled","No Show","Refunded")');

  console.log(
    "Existing bookings for date:",
    date,
    "staff:",
    staffName,
    "err:",
    bookingsErr?.message || null,
    JSON.stringify(bookings),
  );

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
  const { data: migrated, error: migErr } = await supabase
    .from("migrated_bookings")
    .select("booking_time, duration_minutes, staff_name, payment_status")
    .eq("booking_date", date)
    .not("payment_status", "in", '("Cancelled","Refunded")')
    .or(`staff_name.eq.${staffName},staff_name.ilike.${staffName},staff_name.ilike.${firstName}%`);

  console.log(
    "Existing migrated_bookings for date:",
    date,
    "staff:",
    staffName,
    "err:",
    migErr?.message || null,
    JSON.stringify(migrated),
  );

  for (const mb of migrated || []) {
    if (!mb.booking_time) continue;
    const start = parseTime(mb.booking_time);
    const dur = Number(mb.duration_minutes || 0) || 90;
    busy.push({ start, end: start + dur });
  }

  console.log(`[getGroomerBusy] ${staffName} busy windows:`, JSON.stringify(busy));
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
    console.log("[findAvailableSlots] checking groomer:", g.name, g.id);
    const windows = await getGroomerWindows(supabase, g.id, date);
    if (windows.length === 0) continue;
    const busy = await getGroomerBusy(supabase, g.id, g.name, date);
    const slots = findSlotsForGroomer(windows, busy, duration);
    console.log(`[findAvailableSlots] ${g.name}: ${slots.length} slots`);
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
      const FALLBACK_SERVICES = [
        "Full Groom",
        "Bath & Brush",
        "Nail Trim & Filing",
        "Ultrasonic Teeth Cleaning",
        "Puppy Special",
      ];

      // Date calculation — hardcoded/independent, never relies on DB.
      let dateInfo: any;
      let todayStr = "";
      let todayName = "";
      try {
        dateInfo = buildDateResponse();
        todayStr = dateInfo.today;
        todayName = dateInfo.today_name;
      } catch (e) {
        console.error("buildDateResponse failed, using manual fallback:", e);
        try {
          const fmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/London",
            year: "numeric", month: "2-digit", day: "2-digit",
          });
          todayStr = fmt.format(new Date());
        } catch {
          todayStr = new Date().toISOString().slice(0, 10);
        }
        const [yy, mm, dd] = todayStr.split("-").map(Number);
        const dow = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
        todayName = DAY_NAMES[dow];
        const tomorrow = (() => {
          const dt = new Date(Date.UTC(yy, mm - 1, dd));
          dt.setUTCDate(dt.getUTCDate() + 1);
          return dt.toISOString().slice(0, 10);
        })();
        const this_week: { day: string; date: string }[] = [];
        for (let off = 1; off <= 6 - dow; off++) {
          const dt = new Date(Date.UTC(yy, mm - 1, dd));
          dt.setUTCDate(dt.getUTCDate() + off);
          const d2 = (dow + off) % 7;
          if (OPEN_DOW.includes(d2)) {
            this_week.push({ day: DAY_NAMES[d2], date: dt.toISOString().slice(0, 10) });
          }
        }
        const next_week: { day: string; date: string }[] = [];
        const toNextSun = 7 - dow;
        for (let off = 2; off <= 6; off++) {
          const dt = new Date(Date.UTC(yy, mm - 1, dd));
          dt.setUTCDate(dt.getUTCDate() + toNextSun + off);
          next_week.push({ day: DAY_NAMES[off], date: dt.toISOString().slice(0, 10) });
        }
        dateInfo = {
          today: todayStr,
          today_name: todayName,
          tomorrow,
          this_week,
          next_week,
          timezone: "Europe/London",
        };
      }

      console.log("get_services called, today is:", todayStr, "day:", todayName);

      // Try DB; on ANY failure, use fallback list. Never throw.
      let services: string[] = FALLBACK_SERVICES;
      try {
        const { data, error } = await supabase
          .from("services")
          .select("name")
          .eq("is_active", true)
          .order("name");
        if (error) {
          console.error("get_services db error, using fallback:", error.message);
        } else if (Array.isArray(data) && data.length > 0) {
          services = data.map((s: any) => s?.name).filter((n: any) => typeof n === "string" && n.length > 0);
          if (services.length === 0) services = FALLBACK_SERVICES;
        }
      } catch (e) {
        console.error("get_services threw, using fallback services:", e);
        services = FALLBACK_SERVICES;
      }

      console.log("get_services returning successfully");
      return json({ services, ...dateInfo });
    }

    // ─────────────────────────── check_availability ───────────────────────────
    if (action === "check_availability") {
      const FALLBACK = {
        available: false,
        slots: [],
        message: "Unable to check availability for that date. Please try another date or call us on 01708 606655.",
        error: false,
      };
      try {
        console.log("[check_availability] incoming body:", body);
        const { date: rawDate, service_name: rawServiceName, breed_name } = body;
        console.log("check_availability called with:",
          JSON.stringify({ action, date: rawDate, service_name: rawServiceName, breed_name }),
          "today in London is:", resolveDate("today"));
        if (!rawDate || !rawServiceName) {
          console.log("[check_availability] missing date or service_name");
          return json(FALLBACK);
        }

        const date = parseDateInput(String(rawDate));
        const serviceName = fuzzyServiceName(String(rawServiceName));
        console.log("[check_availability] resolved date:", date, "serviceName:", serviceName);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          console.log("[check_availability] could not parse date:", rawDate);
          return json(FALLBACK);
        }

        const { data: service, error: svcErr } = await supabase
          .from("services")
          .select("id, duration_minutes, name")
          .ilike("name", serviceName)
          .eq("is_active", true)
          .maybeSingle();
        console.log("[check_availability] service lookup:", { service, svcErr });
        if (!service) return json(FALLBACK);

        let duration = Number(service.duration_minutes || 0);
        if (breed_name) {
          const { data: breed, error: breedErr } = await supabase
            .from("breeds")
            .select("name, duration_minutes")
            .ilike("name", `%${String(breed_name).trim()}%`)
            .order("duration_minutes", { ascending: false })
            .limit(1);
          const breedRow = Array.isArray(breed) ? breed[0] : breed;
          console.log("[check_availability] breed lookup:", { breed_name, breedRow, breedErr });
          if (breedRow?.duration_minutes) duration = Number(breedRow.duration_minutes);
        } else {
          console.log("[check_availability] no breed_name provided; using default duration");
        }
        if (!duration || duration <= 0) duration = 90;
        console.log("[check_availability] final duration:", duration);

        const slots = await findAvailableSlots(supabase, date, duration, service.id);
        console.log("[check_availability] final slots found:", slots.length, slots.slice(0, 5));

        if (slots.length > 0) {
          return json({
            available: true,
            slots: slots.slice(0, 10).map((s) => ({ time: s.time, groomer: s.groomer })),
          });
        }

        let nextAvail: string | null = null;
        for (let i = 1; i <= 14; i++) {
          const candidate = nextDate(date, i);
          const s = await findAvailableSlots(supabase, candidate, duration, service.id);
          if (s.length > 0) { nextAvail = candidate; break; }
        }
        console.log("[check_availability] next available:", nextAvail);

        return json({
          available: false,
          slots: [],
          message: nextAvail
            ? `No availability on that date. Next available: ${nextAvail}`
            : "No availability on that date.",
          next_available: nextAvail,
        });
      } catch (e: any) {
        console.error("[check_availability] caught error:", e?.message || e);
        return json(FALLBACK);
      }
    }

    // ─────────────────────────── create_booking ───────────────────────────
    if (action === "create_booking") {
      const {
        customer_name, customer_phone, breed_name,
        service_name, date, time, groomer_name, notes,
      } = body;
      let { dog_name } = body;

      // Fallback: ElevenLabs may not send dog_name as a separate field.
      if (!dog_name || !String(dog_name).trim()) {
        dog_name = breed_name ? String(breed_name) : "Dog";
        console.log("[create_booking] dog_name missing, falling back to:", dog_name);
      }

      console.log("[create_booking] starting", JSON.stringify({
        customer_name, customer_phone, dog_name, breed_name,
        service_name, date, time, groomer_name, notes,
      }));

      if (!customer_name || !customer_phone || !service_name ||
          !date || !time || !groomer_name) {
        const missing = {
          customer_name: !customer_name, customer_phone: !customer_phone,
          service_name: !service_name,
          date: !date, time: !time, groomer_name: !groomer_name,
        };
        console.log("[create_booking] missing fields:", JSON.stringify(missing));
        return json({
          success: false,
          error: `Missing required booking fields: ${
            Object.entries(missing).filter(([, v]) => v).map(([k]) => k).join(", ")
          }`,
        }, 400);
      }

      const fuzzyService = fuzzyServiceName(String(service_name));
      console.log("[create_booking] fuzzy service name:", service_name, "→", fuzzyService);

      let { data: service, error: svcErr } = await supabase
        .from("services")
        .select("id, fixed_price, duration_minutes")
        .ilike("name", fuzzyService)
        .eq("is_active", true)
        .maybeSingle();
      if (!service) {
        // Fallback: contains-match
        const { data: svc2 } = await supabase
          .from("services")
          .select("id, fixed_price, duration_minutes, name")
          .ilike("name", `%${fuzzyService}%`)
          .eq("is_active", true)
          .limit(1);
        service = (svc2 && svc2[0]) || null;
      }
      console.log("[create_booking] service lookup result:", JSON.stringify({ service, svcErr }));
      if (!service) {
        return json({
          success: false,
          error: `Service not found: ${service_name}`,
        }, 400);
      }

      let breedId: string | null = null;
      let duration = Number(service.duration_minutes || 0);
      let breedData: any = null;
      if (breed_name) {
        const { data: breed, error: breedErr } = await supabase
          .from("breeds")
          .select("id, duration_minutes")
          .ilike("name", `%${String(breed_name).trim()}%`)
          .order("duration_minutes", { ascending: false })
          .limit(1);
        breedData = { breed, breedErr };
        const breedRow = Array.isArray(breed) ? breed[0] : breed;
        if (breedRow) {
          breedId = breedRow.id;
          if (breedRow.duration_minutes) duration = Number(breedRow.duration_minutes);
        }
      }
      console.log("[create_booking] breed lookup result:", JSON.stringify(breedData));
      if (!duration || duration <= 0) duration = 90;

      // Find groomer (match by full name or first name)
      const { data: staffMatches, error: staffErr } = await supabase
        .from("staff")
        .select("id, name, is_accepting_bookings, block_new_bookings, employment_end_date")
        .or(`name.ilike.${groomer_name},name.ilike.${groomer_name}%`);
      const groomer = (staffMatches || []).find((s: any) =>
        s.is_accepting_bookings && !s.block_new_bookings &&
        (!s.employment_end_date || s.employment_end_date >= date),
      );
      console.log("[create_booking] staff lookup result:", JSON.stringify({ staffMatches, staffErr, picked: groomer }));
      if (!groomer) {
        return json({
          success: false,
          error: `Groomer not available: ${groomer_name}`,
        }, 400);
      }

      // Lookup price
      let totalPrice = Number(service.fixed_price || 0);
      let priceData: any = null;
      if (breedId) {
        const { data: priceRow, error: priceErr } = await supabase
          .from("service_prices")
          .select("price")
          .eq("service_id", service.id)
          .eq("breed_id", breedId)
          .maybeSingle();
        priceData = { priceRow, priceErr };
        if (priceRow?.price != null) totalPrice = Number(priceRow.price);
      }
      console.log("[create_booking] price lookup result:", JSON.stringify({ priceData, totalPrice }));
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
      console.log("[create_booking] availability verify:", JSON.stringify(verify));
      if (!verify?.available) {
        return json({
          success: false,
          error: verify?.reason || "That time slot is no longer available",
        }, 409);
      }

      const phoneNorm = normalizePhone(customer_phone);

      console.log("[create_booking] inserting booking...");
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
        return json({
          success: false,
          error: `Failed to create booking: ${insertErr.message || insertErr}`,
        }, 500);
      }
      console.log("[create_booking] booking created:", JSON.stringify(inserted));

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

    // ─────────────────────────── reschedule_booking ───────────────────────────
    if (action === "reschedule_booking") {
      const {
        customer_phone,
        original_date,
        original_time,
        new_date,
        new_time,
        service_name,
        groomer_name,
      } = body;

      console.log("[reschedule_booking] starting", JSON.stringify(body));

      if (!customer_phone || !new_date || !new_time || !service_name || !groomer_name) {
        return json({
          success: false,
          error: "Missing required fields: customer_phone, new_date, new_time, service_name, groomer_name",
        }, 400);
      }

      // Build candidate phone formats
      const raw = String(customer_phone).trim().replace(/[\s\-\(\)]/g, "");
      const phoneCandidates = new Set<string>([raw]);
      const normalized = normalizePhone(raw);
      phoneCandidates.add(normalized);
      if (normalized.startsWith("+44")) {
        phoneCandidates.add("0" + normalized.slice(3));
        phoneCandidates.add(normalized.slice(3));
        phoneCandidates.add(normalized.slice(1));
      }
      if (raw.startsWith("0")) phoneCandidates.add(raw.slice(1));
      const phoneList = Array.from(phoneCandidates).filter(Boolean);

      // Find existing booking
      let existing: any = null;
      if (original_date && original_time) {
        const timePrefix = String(original_time).slice(0, 5); // HH:MM
        const { data: matches, error: findErr } = await supabase
          .from("bookings")
          .select("id, customer_name, customer_phone, dog_name, breed_id, breeds(name), notes, status")
          .in("customer_phone", phoneList)
          .eq("booking_date", original_date)
          .like("booking_time", `${timePrefix}%`)
          .not("status", "in", '("Cancelled","No Show","Refunded")')
          .limit(1);
        console.log("[reschedule_booking] existing lookup:", JSON.stringify({ matches, findErr }));
        existing = (matches && matches[0]) || null;
      }

      let cancelledId: string | null = null;
      if (existing) {
        const { error: cancelErr } = await supabase
          .from("bookings")
          .update({ status: "Cancelled" })
          .eq("id", existing.id);
        if (cancelErr) {
          console.error("[reschedule_booking] cancel failed", cancelErr);
          return json({
            success: false,
            error: `Failed to cancel original booking: ${cancelErr.message}`,
          }, 500);
        }
        cancelledId = existing.id;

        await supabase.from("booking_audit_log").insert({
          booking_id: existing.id,
          event_type: "cancelled_by_ai",
          performed_by: "AI Receptionist",
          old_date: original_date,
          old_time: original_time,
          note: "Cancelled for rescheduling via phone call",
        }).then(({ error }: any) => {
          if (error) console.error("[reschedule_booking] audit log failed", error);
        });
      } else {
        console.log("[reschedule_booking] original booking not found, creating new only");
      }

      // Build payload for create_booking re-dispatch
      const customerName = existing?.customer_name || body.customer_name;
      const dogName = existing?.dog_name || body.dog_name;
      const breedName = existing?.breeds?.name || body.breed_name;
      const phoneForBooking = existing?.customer_phone || normalized;

      if (!customerName) {
        return json({
          success: false,
          warning: cancelledId ? null : "Original booking not found",
          cancelled_booking_id: cancelledId,
          error: "Cannot create new booking: customer_name unknown (original booking not found and not provided)",
        }, 400);
      }

      const createPayload = {
        action: "create_booking",
        customer_name: customerName,
        customer_phone: phoneForBooking,
        dog_name: dogName,
        breed_name: breedName,
        service_name,
        date: new_date,
        time: new_time,
        groomer_name,
        notes: `Rescheduled from ${original_date || "?"} ${original_time || "?"} via AI phone receptionist`,
      };

      const createRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/phone-booking`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify(createPayload),
        },
      );
      const createJson = await createRes.json();
      console.log("[reschedule_booking] create result:", JSON.stringify(createJson));

      if (!createJson?.success) {
        return json({
          success: false,
          cancelled_booking_id: cancelledId,
          error: createJson?.error || "Failed to create new booking",
        }, createRes.status || 500);
      }

      if (!cancelledId) {
        return json({
          success: true,
          warning: "Original booking not found — new booking created",
          new_booking_id: createJson.booking_id,
        });
      }

      return json({
        success: true,
        cancelled_booking_id: cancelledId,
        new_booking_id: createJson.booking_id,
        message: "Rescheduled successfully",
      });
    }

    // ─────────────────────────── cancel_booking ───────────────────────────
    if (action === "cancel_booking") {
      const { customer_phone, booking_date, booking_time } = body;
      console.log("[cancel_booking] starting", JSON.stringify(body));

      if (!customer_phone || !booking_date || !booking_time) {
        return json({
          success: false,
          message: "Missing required fields: customer_phone, booking_date, booking_time",
        }, 400);
      }

      // Phone format candidates
      const raw = String(customer_phone).trim().replace(/[\s\-\(\)]/g, "");
      const phoneCandidates = new Set<string>([raw]);
      const normalized = normalizePhone(raw);
      phoneCandidates.add(normalized);
      if (normalized.startsWith("+44")) {
        phoneCandidates.add("0" + normalized.slice(3));
        phoneCandidates.add(normalized.slice(3));
        phoneCandidates.add(normalized.slice(1));
      }
      if (raw.startsWith("0")) phoneCandidates.add(raw.slice(1));
      const phoneList = Array.from(phoneCandidates).filter(Boolean);

      const timePrefix = String(booking_time).slice(0, 5);
      const { data: matches, error: findErr } = await supabase
        .from("bookings")
        .select("id, customer_name, customer_email, customer_phone, dog_name, breed_id, breeds(name), booking_date, booking_time, deposit_paid, total_price, stripe_payment_id, status, services(name)")
        .in("customer_phone", phoneList)
        .eq("booking_date", booking_date)
        .like("booking_time", `${timePrefix}%`)
        .not("status", "in", '("Cancelled","No Show","Refunded")')
        .limit(1);

      console.log("[cancel_booking] lookup result:", JSON.stringify({ matches, findErr }));

      if (findErr) {
        return json({ success: false, message: `Lookup error: ${findErr.message}` }, 500);
      }
      const booking: any = matches && matches[0];
      if (!booking) {
        return json({
          success: false,
          message: "No upcoming booking found for that date and time. Please call us on 01708 606655 if you need further help.",
        });
      }

      // Compute hours until appointment in Europe/London
      const nowLondonStr = new Date().toLocaleString("en-US", { timeZone: "Europe/London" });
      const nowLondon = new Date(nowLondonStr);
      const apptTime = (booking.booking_time || "09:00:00").slice(0, 5);
      const apptLondonStr = new Date(`${booking.booking_date}T${apptTime}:00`).toLocaleString("en-US", { timeZone: "Europe/London" });
      const apptDt = new Date(`${booking.booking_date}T${apptTime}:00`);
      const hoursUntil = (apptDt.getTime() - nowLondon.getTime()) / (1000 * 60 * 60);
      const refundEligible = hoursUntil >= 48;
      const reason = refundEligible ? "more than 48 hours notice" : "within 48 hours";
      console.log("[cancel_booking] hoursUntil=", hoursUntil, "refundEligible=", refundEligible);

      // Cancel the booking
      const { error: cancelErr } = await supabase
        .from("bookings")
        .update({ status: "Cancelled" })
        .eq("id", booking.id);
      if (cancelErr) {
        console.error("[cancel_booking] cancel update failed", cancelErr);
        return json({ success: false, message: `Failed to cancel: ${cancelErr.message}` }, 500);
      }

      // Refund if eligible
      const depositPaid = Number(booking.deposit_paid) || 0;
      let depositRefunded = false;
      let refundAmount = 0;
      if (refundEligible && depositPaid > 0 && booking.stripe_payment_id) {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (stripeKey) {
          try {
            const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${stripeKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                payment_intent: booking.stripe_payment_id,
              }).toString(),
            });
            const refundJson = await refundRes.json();
            console.log("[cancel_booking] stripe refund result:", JSON.stringify(refundJson));
            if (refundRes.ok && refundJson?.id) {
              depositRefunded = true;
              refundAmount = (refundJson.amount || 0) / 100;
              await supabase
                .from("bookings")
                .update({ deposit_paid: 0, status: "Refunded" })
                .eq("id", booking.id);
            } else {
              console.error("[cancel_booking] stripe refund failed", refundJson);
            }
          } catch (e) {
            console.error("[cancel_booking] stripe refund exception", e);
          }
        } else {
          console.error("[cancel_booking] STRIPE_SECRET_KEY missing");
        }
      }

      // Audit log
      await supabase.from("booking_audit_log").insert({
        booking_id: booking.id,
        event_type: "cancelled_by_ai",
        performed_by: "AI Receptionist",
        old_date: booking.booking_date,
        old_time: booking.booking_time,
        note: `Cancelled via phone call. Deposit refund: ${depositRefunded ? "yes" : "no"}. Reason: ${reason}`,
      }).then(({ error }: any) => {
        if (error) console.error("[cancel_booking] audit log failed", error);
      });

      // Email notification
      const serviceName = booking.services?.name || "Grooming";
      const breedName = booking.breeds?.name || "";
      const refundLine = depositRefunded
        ? `Deposit of £${refundAmount.toFixed(2)} has been refunded via Stripe.`
        : refundEligible
          ? (depositPaid > 0 ? "Refund eligible but no Stripe payment found — manual handling needed." : "No deposit was paid.")
          : `Within 48 hours — deposit of £${depositPaid.toFixed(2)} retained per policy.`;

      await sendEmail(
        `📞 Cancellation via AI — ${booking.customer_name} — ${booking.booking_date}`,
        `<h2>Booking cancelled via AI Receptionist</h2>
         <p><strong>Customer:</strong> ${booking.customer_name} (${booking.customer_phone})</p>
         <p><strong>Dog:</strong> ${booking.dog_name || ""} ${breedName ? `(${breedName})` : ""}</p>
         <p><strong>Service:</strong> ${serviceName}</p>
         <p><strong>Date / Time:</strong> ${booking.booking_date} at ${apptTime}</p>
         <p><strong>Hours notice:</strong> ${hoursUntil.toFixed(1)}</p>
         <p><strong>${refundLine}</strong></p>`
      ).catch((e) => console.error("[cancel_booking] email failed", e));

      const message = depositRefunded
        ? `Booking cancelled. Deposit of £${refundAmount.toFixed(2)} will be refunded within 3-5 working days.`
        : refundEligible
          ? "Booking cancelled. No deposit was on file to refund."
          : "Booking cancelled. As this is within 48 hours of your appointment, the deposit cannot be refunded as per our cancellation policy.";

      console.log("[cancel_booking] returning success");
      return json({
        success: true,
        booking_id: booking.id,
        deposit_refunded: depositRefunded,
        deposit_amount: depositRefunded ? refundAmount : depositPaid,
        message,
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("[phone-booking] error", err);
    return json({ error: err?.message || "Server error" }, 500);
  }
});