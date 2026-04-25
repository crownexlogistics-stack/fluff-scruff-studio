import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfWeek,
  addDays,
  parseISO,
  isBefore,
  isAfter,
  getDate,
  startOfMonth,
  endOfMonth,
  addMonths,
  differenceInDays,
  nextSaturday,
  isSaturday,
} from "date-fns";
import { AlertTriangle } from "lucide-react";

/**
 * Calculate recurring + one-off bills due between today and next Saturday.
 * Mirrors logic from CashHealthSection, scoped to the next 7 days.
 */
function computeBillsThisWeek(
  recurring: any[],
  oneOff: any[],
  today: Date,
  endDate: Date,
): number {
  let total = 0;

  for (const exp of recurring) {
    const freq = exp.frequency || "monthly";
    const amount = Number(exp.amount || 0);
    if (amount <= 0) continue;
    const startD = exp.recurring_start_date ? parseISO(exp.recurring_start_date) : null;
    const endD = exp.recurring_end_date ? parseISO(exp.recurring_end_date) : null;
    if (endD && isBefore(endD, today)) continue;

    if (freq === "monthly") {
      const dueDay = startD ? getDate(startD) : 1;
      for (let offset = 0; offset <= 1; offset++) {
        const refMonth = addMonths(today, offset);
        const monthEnd2 = endOfMonth(refMonth);
        const monthStart2 = startOfMonth(refMonth);
        if (startD && isAfter(startD, monthEnd2)) continue;
        if (endD && isBefore(endD, monthStart2)) continue;
        const lastDay = getDate(monthEnd2);
        const actualDay = Math.min(dueDay, lastDay);
        const dueDate = new Date(refMonth.getFullYear(), refMonth.getMonth(), actualDay);
        if (dueDate >= today && dueDate <= endDate) total += amount;
      }
    } else if (freq === "weekly") {
      let d = new Date(today);
      const targetDow = startD ? startD.getDay() : 1;
      while (d.getDay() !== targetDow) d = addDays(d, 1);
      while (d <= endDate) {
        if (startD && isBefore(d, startD)) {
          d = addDays(d, 7);
          continue;
        }
        if (endD && isAfter(d, endD)) break;
        total += amount;
        d = addDays(d, 7);
      }
    }
    // annual bills rarely fall inside a 7-day window — handled in the wider cash health card
  }

  for (const e of oneOff) {
    const due = parseISO(e.expense_date);
    if (due >= today && due <= endDate) total += Number(e.amount || 0);
  }

  return total;
}

const BankDangerBanner = () => {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const nextSat = isSaturday(today) ? today : nextSaturday(today);
  const nextSatStr = format(nextSat, "yyyy-MM-dd");
  const weekMonday = startOfWeek(today, { weekStartsOn: 1 });
  const weekMondayStr = format(weekMonday, "yyyy-MM-dd");

  const { data: latestBalance } = useQuery({
    queryKey: ["danger-bank-balance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_balance_snapshots")
        .select("balance, noted_at")
        .order("noted_at", { ascending: false })
        .limit(1);
      return (data && data.length > 0) ? data[0] : null;
    },
  });

  const { data: recurring = [] } = useQuery({
    queryKey: ["danger-recurring"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount, frequency, recurring_start_date, recurring_end_date")
        .eq("expense_type", "recurring");
      return (data ?? []) as any[];
    },
  });

  const { data: oneOff = [] } = useQuery({
    queryKey: ["danger-oneoff", todayStr, nextSatStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount, expense_date")
        .eq("expense_type", "one_off")
        .gte("expense_date", todayStr)
        .lte("expense_date", nextSatStr);
      return (data ?? []) as any[];
    },
  });

  const { data: groomerPayThisWeek = 0 } = useQuery({
    queryKey: ["danger-groomer-pay", weekMondayStr, nextSatStr],
    queryFn: async () => {
      // Sum commission_records where the underlying booking is in this week
      const { data } = await supabase
        .from("commission_records")
        .select("groomer_pay, bookings:booking_id(booking_date)");
      const total = ((data ?? []) as any[])
        .filter((r) => {
          const bd = r.bookings?.booking_date;
          return bd && bd >= weekMondayStr && bd <= nextSatStr;
        })
        .reduce((s, r) => s + Number(r.groomer_pay || 0), 0);
      return total;
    },
  });

  if (!latestBalance) return null;

  const balance = Number(latestBalance.balance || 0);
  const expensesThisWeek = computeBillsThisWeek(recurring, oneOff, today, nextSat);
  const billsDue = expensesThisWeek + (groomerPayThisWeek as number);
  const projected = balance - billsDue;

  if (projected >= 0) return null;

  return (
    <div
      role="alert"
      className="-mx-4 sm:mx-0 sm:rounded-lg bg-destructive text-destructive-foreground px-5 py-4 shadow-lg"
    >
      <div className="flex items-start gap-3 max-w-[1600px] mx-auto">
        <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-base">
            🚨 URGENT: Projected bank balance after this week's bills is £
            {Math.round(projected).toLocaleString()}.
          </p>
          <p className="text-sm opacity-95 mt-1">
            Bills due: £{Math.round(billsDue).toLocaleString()}. Current balance: £
            {Math.round(balance).toLocaleString()}. Immediate action required.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BankDangerBanner;