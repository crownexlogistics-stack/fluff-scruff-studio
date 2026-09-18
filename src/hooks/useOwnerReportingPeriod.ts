import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, endOfMonth, format, isAfter, isBefore, parseISO, startOfMonth } from "date-fns";

export type ReportingPeriodKey = "today" | "week" | "month" | "year" | "beginning" | "custom";
export interface ReportingRange { key: ReportingPeriodKey; start: Date; end: Date; label: string; }

const valueOf = (b: any) => Number(b.final_charge || 0) > 0 ? Number(b.final_charge) : Number(b.total_price || 0);
const sum = (rows: any[], fn: (r: any) => number) => rows.reduce((total, row) => total + fn(row), 0);

function recurringExpensesInRange(rows: any[], start: Date, end: Date) {
  let total = 0;
  for (const row of rows) {
    const amount = Number(row.amount || 0);
    if (amount <= 0) continue;
    const activeStart = row.recurring_start_date ? parseISO(row.recurring_start_date) : start;
    const activeEnd = row.recurring_end_date ? parseISO(row.recurring_end_date) : end;
    const from = isAfter(activeStart, start) ? activeStart : start;
    const to = isBefore(activeEnd, end) ? activeEnd : end;
    if (isAfter(from, to)) continue;
    const frequency = row.frequency || "monthly";
    if (frequency === "weekly") {
      total += amount * (Math.floor((to.getTime() - from.getTime()) / 604800000) + 1);
    } else if (frequency === "annual") {
      for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
        const due = new Date(year, activeStart.getMonth(), activeStart.getDate());
        if (!isBefore(due, from) && !isAfter(due, to)) total += amount;
      }
    } else {
      let cursor = startOfMonth(from);
      const last = startOfMonth(to);
      while (!isAfter(cursor, last)) {
        total += amount;
        cursor = addMonths(cursor, 1);
      }
    }
  }
  return total;
}

export function useOwnerReportingPeriod(range: ReportingRange) {
  const today = new Date();
  const effectiveEnd = isAfter(range.end, today) ? today : range.end;
  const startStr = format(range.start, "yyyy-MM-dd");
  const endStr = format(range.end, "yyyy-MM-dd");
  const effectiveEndStr = format(effectiveEnd, "yyyy-MM-dd");
  const enabled = !isAfter(range.start, effectiveEnd);

  const bookingsQ = useQuery({
    queryKey: ["owner-report-bookings", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings")
        .select("id, booking_date, status, total_price, final_charge")
        .gte("booking_date", startStr).lte("booking_date", endStr);
      if (error) throw error;
      return data ?? [];
    }, enabled,
  });
  const migratedQ = useQuery({
    queryKey: ["owner-report-migrated", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase.from("migrated_bookings")
        .select("id, booking_date, total_price, is_future_booking")
        .gte("booking_date", startStr).lte("booking_date", endStr);
      if (error) throw error;
      return data ?? [];
    }, enabled,
  });
  const commissionsQ = useQuery({
    queryKey: ["owner-report-commissions", startStr, effectiveEndStr],
    queryFn: async () => {
      const { data, error } = await supabase.from("commission_records")
        .select("groomer_pay, total_price, final_charge, created_at")
        .gte("created_at", `${startStr}T00:00:00`).lte("created_at", `${effectiveEndStr}T23:59:59`);
      if (error) throw error;
      return data ?? [];
    }, enabled,
  });
  const expensesQ = useQuery({
    queryKey: ["owner-report-expenses", startStr, effectiveEndStr],
    queryFn: async () => {
      const [oneOff, recurring, purchases] = await Promise.all([
        supabase.from("expenses").select("amount, expense_date").eq("expense_type", "one_off").gte("expense_date", startStr).lte("expense_date", effectiveEndStr),
        supabase.from("expenses").select("amount, frequency, recurring_start_date, recurring_end_date").eq("expense_type", "recurring"),
        supabase.from("purchases").select("total_price").eq("is_returned", false).gte("purchased_at", `${startStr}T00:00:00`).lte("purchased_at", `${effectiveEndStr}T23:59:59`),
      ]);
      return {
        oneOff: oneOff.data ?? [], recurring: recurring.data ?? [], purchases: purchases.data ?? [],
      };
    }, enabled,
  });
  const cashQ = useQuery({
    queryKey: ["owner-report-cash", startStr, effectiveEndStr],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-cash-flow", { body: { month_start: startStr, month_end: effectiveEndStr } });
      if (error) throw error;
      return Number(data?.total_cash || 0);
    }, enabled, staleTime: 60000,
  });

  const bookings = bookingsQ.data ?? [];
  const migrated = migratedQ.data ?? [];
  const happened = bookings.filter((b: any) => b.booking_date <= effectiveEndStr);
  const completed = happened.filter((b: any) => b.status === "Completed");
  const cancellations = happened.filter((b: any) => b.status === "Cancelled");
  const noShows = happened.filter((b: any) => b.status === "No Show");
  const migratedHappened = migrated.filter((b: any) => b.booking_date <= effectiveEndStr);
  const future = bookings.filter((b: any) => b.booking_date > effectiveEndStr && ["Confirmed", "Pending"].includes(b.status));
  const migratedFuture = migrated.filter((b: any) => b.booking_date > effectiveEndStr && b.is_future_booking);
  const revenueEarned = sum(completed, valueOf) + sum(migratedHappened, (b) => Number(b.total_price || 0));
  const groomerPay = sum(commissionsQ.data ?? [], (c) => Number(c.groomer_pay || 0));
  const expenseRows = expensesQ.data;
  const expenses = expenseRows ? sum(expenseRows.oneOff, (e) => Number(e.amount || 0)) + sum(expenseRows.purchases, (p) => Number(p.total_price || 0)) + recurringExpensesInRange(expenseRows.recurring, range.start, effectiveEnd) : null;
  const profitLoss = expenses === null ? null : revenueEarned - groomerPay - expenses;
  const futureRevenue = sum(future, valueOf) + sum(migratedFuture, (b) => Number(b.total_price || 0));

  return {
    isLoading: bookingsQ.isLoading || migratedQ.isLoading || commissionsQ.isLoading || expensesQ.isLoading || cashQ.isLoading,
    range: { ...range, startStr, endStr },
    metrics: {
      revenueEarned,
      cashReceived: cashQ.data ?? null,
      appointments: bookings.length + migrated.length,
      completed: completed.length + migratedHappened.length,
      cancellations: cancellations.length,
      noShows: noShows.length,
      groomerPay,
      expenses,
      profitLoss,
      futureBookings: future.length + migratedFuture.length,
      futureRevenue,
    },
  };
}
