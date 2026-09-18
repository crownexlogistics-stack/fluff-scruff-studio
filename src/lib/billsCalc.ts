import {
  addDays,
  addMonths,
  differenceInDays,
  endOfMonth,
  getDate,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
} from "date-fns";

export interface UpcomingBill {
  name: string;
  category: string;
  amount: number;
  dueDate: Date;
  daysUntilDue: number;
}

/**
 * Expand recurring + one-off expenses into individual due-date entries within
 * the given horizon (days from today). This is the single shared implementation
 * used by the owner dashboard so every "bills due" figure agrees.
 */
export function expandUpcomingBills(
  recurring: any[],
  oneOff: any[],
  today: Date,
  horizonDays = 35,
): UpcomingBill[] {
  const horizon = addDays(today, horizonDays);
  const out: UpcomingBill[] = [];

  for (const exp of recurring) {
    const freq = exp.frequency || "monthly";
    const amount = Number(exp.amount || 0);
    if (amount <= 0) continue;

    const startDate = exp.recurring_start_date ? parseISO(exp.recurring_start_date) : null;
    const endDate = exp.recurring_end_date ? parseISO(exp.recurring_end_date) : null;
    if (endDate && isBefore(endDate, today)) continue;

    const push = (dueDate: Date) =>
      out.push({
        name: exp.name,
        category: exp.category || "other",
        amount,
        dueDate,
        daysUntilDue: differenceInDays(dueDate, today),
      });

    if (freq === "monthly") {
      const dueDay = startDate ? getDate(startDate) : 1;
      for (let offset = 0; offset <= 2; offset++) {
        const refMonth = addMonths(today, offset);
        const ms = startOfMonth(refMonth);
        const me = endOfMonth(refMonth);
        if (startDate && isAfter(startDate, me)) continue;
        if (endDate && isBefore(endDate, ms)) continue;
        const actualDay = Math.min(dueDay, getDate(me));
        const dueDate = new Date(refMonth.getFullYear(), refMonth.getMonth(), actualDay);
        if (dueDate >= today && dueDate <= horizon) push(dueDate);
      }
    } else if (freq === "weekly") {
      let d = new Date(today);
      const targetDow = startDate ? startDate.getDay() : 1;
      while (d.getDay() !== targetDow) d = addDays(d, 1);
      while (d <= horizon) {
        if (startDate && isBefore(d, startDate)) {
          d = addDays(d, 7);
          continue;
        }
        if (endDate && isAfter(d, endDate)) break;
        push(new Date(d));
        d = addDays(d, 7);
      }
    } else if (freq === "annual") {
      if (!startDate) continue;
      for (let yearOff = 0; yearOff <= 1; yearOff++) {
        const annDate = new Date(today.getFullYear() + yearOff, startDate.getMonth(), getDate(startDate));
        if (annDate >= today && annDate <= horizon) push(annDate);
      }
    }
  }

  for (const e of oneOff) {
    const amount = Number(e.amount || 0);
    if (amount <= 0 || !e.expense_date) continue;
    const dueDate = parseISO(e.expense_date);
    if (dueDate >= today && dueDate <= horizon) {
      out.push({
        name: e.name || "One-off expense",
        category: e.category || "other",
        amount,
        dueDate,
        daysUntilDue: differenceInDays(dueDate, today),
      });
    }
  }

  return out.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
