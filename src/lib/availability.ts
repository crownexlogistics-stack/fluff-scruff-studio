/**
 * Booking Availability Engine — "Golden Rules"
 *
 * Slot generation formula:
 *   [Base_Schedule] + [Manual_Overtime] - [Manual_Blocks] - [Existing_Bookings]
 *
 * Rules:
 * 1. Only show slots within a groomer's working hours for that day-of-week
 * 2. Manual overrides (is_working=true on an off-day) ADD availability
 * 3. Manual blocks (is_working=false) SUBTRACT availability
 * 4. Existing bookings (not Cancelled/No Show) SUBTRACT availability
 * 5. Service duration must fit: slot_start + duration <= shift_end AND no overlap
 * 6. One groomer = one dog at a time
 */

export interface StaffAvailability {
  staff_id: string;
  day_of_week: number; // DB format: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface ScheduleOverride {
  staff_id: string;
  override_date: string;
  start_time: string | null;
  end_time: string | null;
  is_working: boolean;
}

export interface ExistingBooking {
  staff_id: string;
  booking_time: string;
  services?: { duration_minutes: number | null } | null;
  breeds?: { duration_minutes: number | null } | null;
}

export interface Groomer {
  id: string;
  name: string;
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = (time || "00:00").split(":");
  return parseInt(h || "0", 10) * 60 + parseInt(m || "0", 10);
}

/**
 * For a given date, determine each groomer's working windows:
 *   1. Start with base schedule for that day-of-week
 *   2. If there's a manual opening override (is_working=true), use it instead/additionally
 *   3. Subtract blocked overrides (is_working=false)
 */
interface TimeWindow {
  start: number; // minutes from midnight
  end: number;
}

function getGroomerWindows(
  groomerId: string,
  dayOfWeek: number, // JS getDay(): 0=Sun
  baseSchedules: StaffAvailability[],
  overrides: ScheduleOverride[]
): TimeWindow[] {
  // Get base schedule for this groomer + day
  const baseForDay = baseSchedules.filter(
    (s) => s.staff_id === groomerId && s.day_of_week === dayOfWeek && s.is_available
  );

  // Check for manual openings (is_working=true) — these override/add to base
  const manualOpenings = overrides.filter(
    (o) => o.staff_id === groomerId && o.is_working && o.start_time && o.end_time
  );

  // Check for blocks (is_working=false)
  const blocks = overrides.filter(
    (o) => o.staff_id === groomerId && !o.is_working && o.start_time && o.end_time
  );

  // Build initial windows
  let windows: TimeWindow[] = [];

  if (manualOpenings.length > 0) {
    // Manual openings REPLACE the base schedule for this day
    // (if someone is normally off but opened, use the opening)
    // (if someone is normally on and has an opening, the opening takes priority)
    for (const mo of manualOpenings) {
      windows.push({
        start: parseTimeToMinutes(mo.start_time!),
        end: parseTimeToMinutes(mo.end_time!),
      });
    }
    // Also include base schedule windows if they exist (merge)
    for (const bs of baseForDay) {
      windows.push({
        start: parseTimeToMinutes(bs.start_time),
        end: parseTimeToMinutes(bs.end_time),
      });
    }
    // Merge overlapping windows
    windows = mergeWindows(windows);
  } else if (baseForDay.length > 0) {
    for (const bs of baseForDay) {
      windows.push({
        start: parseTimeToMinutes(bs.start_time),
        end: parseTimeToMinutes(bs.end_time),
      });
    }
  }

  // Subtract blocks
  for (const block of blocks) {
    const blockStart = parseTimeToMinutes(block.start_time!);
    const blockEnd = parseTimeToMinutes(block.end_time!);
    windows = subtractBlock(windows, blockStart, blockEnd);
  }

  return windows;
}

function mergeWindows(windows: TimeWindow[]): TimeWindow[] {
  if (windows.length <= 1) return windows;
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const merged: TimeWindow[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}

function subtractBlock(
  windows: TimeWindow[],
  blockStart: number,
  blockEnd: number
): TimeWindow[] {
  const result: TimeWindow[] = [];
  for (const w of windows) {
    if (blockEnd <= w.start || blockStart >= w.end) {
      // No overlap
      result.push(w);
    } else {
      // Overlap — split
      if (w.start < blockStart) {
        result.push({ start: w.start, end: blockStart });
      }
      if (w.end > blockEnd) {
        result.push({ start: blockEnd, end: w.end });
      }
    }
  }
  return result;
}

/**
 * Generate available time slots for a given date.
 * Returns only slots where at least one groomer is free for the full service duration.
 */
export function generateAvailableSlots(
  date: Date,
  serviceDurationMins: number,
  groomers: Groomer[],
  baseSchedules: StaffAvailability[],
  overrides: ScheduleOverride[],
  existingBookings: ExistingBooking[],
  slotIntervalMins: number = 30
): string[] {
  if (!groomers.length) return [];

  // Convert JS getDay() (0=Sun,1=Mon,...,6=Sat) to DB format (0=Mon,1=Tue,...,6=Sun)
  const dayOfWeek = (date.getDay() + 6) % 7;

  // For each groomer, compute available windows after blocks
  const groomerWindows = new Map<string, TimeWindow[]>();
  for (const g of groomers) {
    const windows = getGroomerWindows(g.id, dayOfWeek, baseSchedules, overrides);
    if (windows.length > 0) {
      groomerWindows.set(g.id, windows);
    }
  }

  // Collect all possible slot times from all groomer windows
  const allSlotTimes = new Set<number>();
  for (const windows of groomerWindows.values()) {
    for (const w of windows) {
      for (let t = w.start; t + serviceDurationMins <= w.end; t += slotIntervalMins) {
        allSlotTimes.add(t);
      }
    }
  }

  // Sort
  const sortedSlots = Array.from(allSlotTimes).sort((a, b) => a - b);

  // Filter: keep only slots where at least one groomer is free
  const availableSlots: string[] = [];

  for (const slotStart of sortedSlots) {
    const slotEnd = slotStart + serviceDurationMins;

    let hasAvailableGroomer = false;

    for (const g of groomers) {
      const windows = groomerWindows.get(g.id);
      if (!windows) continue;

      // Check slot fits within a window
      const fitsInWindow = windows.some(
        (w) => slotStart >= w.start && slotEnd <= w.end
      );
      if (!fitsInWindow) continue;

      // Check no booking conflict
      const hasBookingConflict = existingBookings.some((b) => {
        if (b.staff_id !== g.id) return false;
        const bStart = parseTimeToMinutes(b.booking_time);
        const bDuration =
          Number(b.services?.duration_minutes ?? b.breeds?.duration_minutes ?? 90);
        const bEnd = bStart + bDuration;
        return slotStart < bEnd && slotEnd > bStart;
      });

      if (!hasBookingConflict) {
        hasAvailableGroomer = true;
        break;
      }
    }

    if (hasAvailableGroomer) {
      const h = Math.floor(slotStart / 60);
      const m = slotStart % 60;
      availableSlots.push(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      );
    }
  }

  return availableSlots;
}

/**
 * Check if a date has ANY possible availability (for greying out dates).
 * Uses a quick check: does any groomer have working hours on this day-of-week
 * (or a manual opening), that aren't fully blocked?
 */
export function dateHasAnyAvailability(
  date: Date,
  groomers: Groomer[],
  baseSchedules: StaffAvailability[],
  overrides: ScheduleOverride[]
): boolean {
  // Convert JS getDay() (0=Sun,1=Mon,...,6=Sat) to DB format (0=Mon,1=Tue,...,6=Sun)
  const dayOfWeek = (date.getDay() + 6) % 7;
  for (const g of groomers) {
    const windows = getGroomerWindows(g.id, dayOfWeek, baseSchedules, overrides);
    if (windows.length > 0) return true;
  }
  return false;
}

/**
 * Find a free groomer for a specific slot (used at submission time for auto-assignment).
 */
export function findFreeGroomer(
  slotTime: string,
  serviceDurationMins: number,
  date: Date,
  groomers: Groomer[],
  baseSchedules: StaffAvailability[],
  overrides: ScheduleOverride[],
  existingBookings: ExistingBooking[]
): Groomer | null {
  // Convert JS getDay() (0=Sun,1=Mon,...,6=Sat) to DB format (0=Mon,1=Tue,...,6=Sun)
  const dayOfWeek = (date.getDay() + 6) % 7;
  const slotStart = parseTimeToMinutes(slotTime);
  const slotEnd = slotStart + serviceDurationMins;

  for (const g of groomers) {
    const windows = getGroomerWindows(g.id, dayOfWeek, baseSchedules, overrides);
    const fitsInWindow = windows.some(
      (w) => slotStart >= w.start && slotEnd <= w.end
    );
    if (!fitsInWindow) continue;

    const hasConflict = existingBookings.some((b) => {
      if (b.staff_id !== g.id) return false;
      const bStart = parseTimeToMinutes(b.booking_time);
      const bDuration =
        Number(b.services?.duration_minutes ?? b.breeds?.duration_minutes ?? 90);
      const bEnd = bStart + bDuration;
      return slotStart < bEnd && slotEnd > bStart;
    });

    if (!hasConflict) return g;
  }

  return null;
}
