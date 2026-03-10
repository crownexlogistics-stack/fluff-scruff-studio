import { parseISO, getDate, startOfMonth, endOfMonth, differenceInCalendarWeeks, isBefore, isAfter, isSameMonth } from "date-fns";

/**
 * Normalise any expense amount to its monthly equivalent.
 */
export const toMonthly = (amount: number, frequency: string) => {
  if (frequency === "weekly") return amount * 4.33;
  if (frequency === "annual") return amount / 12;
  return amount;
};

export interface RecurringExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string | null;
  recurring_start_date: string | null;
  recurring_end_date: string | null;
}

export interface SplitExpenseItem {
  expense: RecurringExpense;
  monthlyAmount: number;
  dueDay: number | null;
}

export interface DateAwareExpenses {
  paidItems: SplitExpenseItem[];
  upcomingItems: SplitExpenseItem[];
  paidTotal: number;
  upcomingTotal: number;
  fullMonthTotal: number;
}

/**
 * Given a list of recurring expenses and a reference month,
 * split them into "paid" (due date already passed) and "upcoming"
 * (due date hasn't arrived yet) for that month.
 *
 * For past months: everything is "paid".
 * For future months: everything is "upcoming".
 * For current month: split based on today's date.
 */
export function calcDateAwareExpenses(
  recurring: RecurringExpense[],
  referenceMonth: Date,
  today: Date = new Date()
): DateAwareExpenses {
  const monthStart = startOfMonth(referenceMonth);
  const monthEnd = endOfMonth(referenceMonth);
  const todayDate = today;
  const todayDay = getDate(todayDate);
  const isCurrentMonth = isSameMonth(referenceMonth, todayDate);
  const isPastMonth = isBefore(monthEnd, todayDate) && !isCurrentMonth;
  // const isFutureMonth = isAfter(monthStart, todayDate) && !isCurrentMonth;

  const paidItems: SplitExpenseItem[] = [];
  const upcomingItems: SplitExpenseItem[] = [];

  for (const expense of recurring) {
    const freq = expense.frequency || "monthly";
    const startDate = expense.recurring_start_date ? parseISO(expense.recurring_start_date) : null;
    const endDate = expense.recurring_end_date ? parseISO(expense.recurring_end_date) : null;

    // Skip if expense hasn't started yet or has already ended
    if (startDate && isAfter(startDate, monthEnd)) continue;
    if (endDate && isBefore(endDate, monthStart)) continue;

    if (freq === "monthly") {
      const dueDay = startDate ? getDate(startDate) : 1;
      const monthlyAmount = Number(expense.amount);
      const item: SplitExpenseItem = { expense, monthlyAmount, dueDay };

      if (isPastMonth) {
        paidItems.push(item);
      } else if (isCurrentMonth) {
        if (dueDay <= todayDay) {
          paidItems.push(item);
        } else {
          upcomingItems.push(item);
        }
      } else {
        // Future month
        upcomingItems.push(item);
      }
    } else if (freq === "weekly") {
      const weeklyAmount = Number(expense.amount);

      if (isPastMonth) {
        // Count all weeks in that month (approx 4.33)
        paidItems.push({ expense, monthlyAmount: weeklyAmount * 4.33, dueDay: null });
      } else if (isCurrentMonth) {
        // Count weeks from month start to today as paid
        const weeksPassedFromStart = differenceInCalendarWeeks(todayDate, monthStart, { weekStartsOn: 1 }) + 1;
        // Count remaining weeks as upcoming
        const totalWeeksInMonth = differenceInCalendarWeeks(monthEnd, monthStart, { weekStartsOn: 1 }) + 1;
        const remainingWeeks = Math.max(0, totalWeeksInMonth - weeksPassedFromStart);

        if (weeksPassedFromStart > 0) {
          paidItems.push({ expense, monthlyAmount: weeklyAmount * weeksPassedFromStart, dueDay: null });
        }
        if (remainingWeeks > 0) {
          upcomingItems.push({ expense, monthlyAmount: weeklyAmount * remainingWeeks, dueDay: null });
        }
      } else {
        upcomingItems.push({ expense, monthlyAmount: weeklyAmount * 4.33, dueDay: null });
      }
    } else if (freq === "annual") {
      if (!startDate) continue;
      const anniversaryMonth = startDate.getMonth();
      const anniversaryDay = getDate(startDate);
      const refMonth = referenceMonth.getMonth();

      // Only count if the anniversary falls in this month
      if (anniversaryMonth !== refMonth) continue;

      const annualAmount = Number(expense.amount);
      const item: SplitExpenseItem = { expense, monthlyAmount: annualAmount, dueDay: anniversaryDay };

      if (isPastMonth) {
        paidItems.push(item);
      } else if (isCurrentMonth) {
        if (anniversaryDay <= todayDay) {
          paidItems.push(item);
        } else {
          upcomingItems.push(item);
        }
      } else {
        upcomingItems.push(item);
      }
    }
  }

  const paidTotal = paidItems.reduce((s, i) => s + i.monthlyAmount, 0);
  const upcomingTotal = upcomingItems.reduce((s, i) => s + i.monthlyAmount, 0);

  return {
    paidItems,
    upcomingItems,
    paidTotal,
    upcomingTotal,
    fullMonthTotal: paidTotal + upcomingTotal,
  };
}
