import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  PoundSterling,
  Users,
  Clock,
  ArrowRight,
  Wallet,
  CalendarDays,
  BarChart3,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  CreditCard,
  Dog,
  ExternalLink,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcDateAwareExpenses } from "@/lib/expenseCalc";
import { useAuth } from "@/hooks/useAuth";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  addDays,
  parseISO,
  differenceInDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isWithinInterval,
  isSameDay,
} from "date-fns";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WebsiteAnalyticsSection } from "@/components/dashboard/WebsiteAnalyticsSection";
import { UnavailableBookingsWarning } from "@/components/dashboard/UnavailableBookingsWarning";
import MonthForecastCard from "@/components/dashboard/MonthForecastCard";
import { DailyBriefingCard } from "@/components/dashboard/DailyBriefingCard";
import { usePermissions } from "@/config/rolePermissions";

// ── Types ───────────────────────────────────────────────────
type RangeKey = "week" | "month" | "year" | "custom";

function getRange(key: RangeKey, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (key) {
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "custom":
      return {
        start: customStart ? startOfDay(customStart) : startOfMonth(now),
        end: customEnd ? endOfDay(customEnd) : endOfDay(now),
      };
  }
}

function getPreviousRange(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime() + 86400000;
  return {
    start: new Date(start.getTime() - diff),
    end: new Date(start.getTime() - 86400000),
  };
}

// ── Colors ──────────────────────────────────────────────────
const SOURCE_COLORS: Record<string, string> = {
  google: "hsl(217, 91%, 60%)",
  instagram: "hsl(330, 80%, 55%)",
  facebook: "hsl(221, 44%, 41%)",
  referral: "hsl(145, 60%, 40%)",
  walk_in: "hsl(24, 90%, 60%)",
  direct: "hsl(220, 10%, 45%)",
  returning: "hsl(280, 60%, 55%)",
  other: "hsl(240, 5%, 65%)",
};
const SOURCE_LABELS: Record<string, string> = {
  google: "Google",
  instagram: "Instagram",
  facebook: "Facebook",
  referral: "Referral",
  walk_in: "Walk-in",
  direct: "Direct/Website",
  returning: "Returning",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  Confirmed: "hsl(217, 91%, 60%)",
  Completed: "hsl(145, 60%, 40%)",
  Cancelled: "hsl(0, 72%, 51%)",
  "No Show": "hsl(38, 92%, 50%)",
  Pending: "hsl(280, 60%, 55%)",
  Refunded: "hsl(220, 10%, 45%)",
};

// ── Component ───────────────────────────────────────────────
const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [compareOn, setCompareOn] = useState(false);
  const [expandedGroomer, setExpandedGroomer] = useState<string | null>(null);
  const [groomerSort, setGroomerSort] = useState<{ col: string; asc: boolean }>({ col: "revenue", asc: false });

  const { start, end } = getRange(rangeKey, customStart, customEnd);
  const prev = getPreviousRange(start, end);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const prevStartStr = format(prev.start, "yyyy-MM-dd");
  const prevEndStr = format(prev.end, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const next30Str = format(addDays(new Date(), 30), "yyyy-MM-dd");

  // ── Queries ──────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ["dash-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["dash-bookings", startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, staff(name), services(name)")
        .gte("booking_date", startStr)
        .lte("booking_date", endStr);
      return (data ?? []) as any[];
    },
  });

  const { data: prevBookings = [] } = useQuery({
    queryKey: ["dash-prev-bookings", prevStartStr, prevEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, total_price, deposit_paid, status, referral_source, customer_email, staff_id")
        .gte("booking_date", prevStartStr)
        .lte("booking_date", prevEndStr);
      return (data ?? []) as any[];
    },
    enabled: compareOn,
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["dash-commissions", startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_records")
        .select("*, bookings(customer_name, customer_email, dog_name, booking_date, service_id, services:service_id(name))")
        .gte("created_at", `${startStr}T00:00:00`)
        .lte("created_at", `${endStr}T23:59:59`);
      return (data ?? []) as any[];
    },
  });

  const { data: prevCommissions = [] } = useQuery({
    queryKey: ["dash-prev-commissions", prevStartStr, prevEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_records")
        .select("groomer_pay, studio_share, total_price, staff_id")
        .gte("created_at", `${prevStartStr}T00:00:00`)
        .lte("created_at", `${prevEndStr}T23:59:59`);
      return (data ?? []) as any[];
    },
    enabled: compareOn,
  });

  // Upcoming (next 30 days for forecast)
  const { data: upcomingLive = [] } = useQuery({
    queryKey: ["dash-upcoming-30", todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, staff(name), services(name)")
        .gte("booking_date", todayStr)
        .lte("booking_date", next30Str)
        .in("status", ["Confirmed", "Pending"])
        .order("booking_date")
        .order("booking_time");
      return (data ?? []) as any[];
    },
  });

  // Upcoming migrated bookings (future)
  const { data: upcomingMigrated = [] } = useQuery({
    queryKey: ["dash-upcoming-migrated", todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("migrated_bookings")
        .select("*, migrated_customers(full_name, email)")
        .gte("booking_date", todayStr)
        .eq("is_future_booking", true);
      return (data ?? []) as any[];
    },
  });

  // Combine upcoming bookings
  const upcomingAll = useMemo(() => {
    const live = upcomingLive.map((b: any) => ({ ...b, _source: "live" as const }));
    const migrated = upcomingMigrated.map((b: any) => ({
      ...b,
      _source: "wix" as const,
      customer_name: b.migrated_customers?.full_name || "Wix Customer",
      total_price: b.total_price || 0,
      deposit_paid: b.deposit_paid || 0,
      status: "Confirmed",
    }));
    return [...live, ...migrated].sort((a, b) => {
      const dateA = a.booking_date + (a.booking_time || "");
      const dateB = b.booking_date + (b.booking_time || "");
      return dateA.localeCompare(dateB);
    });
  }, [upcomingLive, upcomingMigrated]);

  // Recent activity (last 10 bookings by created_at)
  const { data: recentActivity = [] } = useQuery({
    queryKey: ["dash-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, customer_name, dog_name, booking_date, status, total_price, deposit_paid, created_at, staff(name), services(name)")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as any[];
    },
    refetchInterval: 120000,
  });

  // Staff
  const { data: staff = [] } = useQuery({
    queryKey: ["dash-staff"],
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("id, name, role").eq("role", "Groomer").order("name");
      return (data ?? []) as any[];
    },
  });

  // Migrated bookings for historical accuracy
  const { data: migratedBookings = [] } = useQuery({
    queryKey: ["dash-migrated", startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("migrated_bookings")
        .select("*, migrated_customers(full_name, email)")
        .gte("booking_date", startStr)
        .lte("booking_date", endStr);
      return (data ?? []) as any[];
    },
  });

  // Expenses — recurring (with full details for date-aware calc)
  const { data: recurringExpenses = [] } = useQuery({
    queryKey: ["dash-recurring-expenses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("id, name, category, amount, frequency, recurring_start_date, recurring_end_date")
        .eq("expense_type", "recurring");
      return (data ?? []) as any[];
    },
  });

  // Expenses — one-off in current month (only past or today's date)
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const expenseTodayStr = format(new Date(), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const { data: oneOffExpenses = [] } = useQuery({
    queryKey: ["dash-oneoff-expenses", monthStart, expenseTodayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("expense_type", "one_off")
        .gte("expense_date", monthStart)
        .lte("expense_date", expenseTodayStr);
      return (data ?? []) as any[];
    },
  });

  // One-off expenses upcoming (after today in current month)
  const { data: upcomingOneOffExpenses = [] } = useQuery({
    queryKey: ["dash-upcoming-oneoff-expenses", expenseTodayStr, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("expense_type", "one_off")
        .gt("expense_date", expenseTodayStr)
        .lte("expense_date", monthEnd);
      return (data ?? []) as any[];
    },
  });

  // ── Computed Stats ───────────────────────────
  const completed = bookings.filter((b: any) => b.status === "Completed" || b.status === "No Show");
  const cancelled = bookings.filter((b: any) => b.status === "Cancelled");
  const confirmed = bookings.filter((b: any) => b.status === "Confirmed");
  const pending = bookings.filter((b: any) => b.status === "Pending");

  const totalRevenue = completed.reduce((s: number, b: any) => s + Number(b.total_price), 0);
  const migratedRevenue = migratedBookings.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
  const combinedRevenue = totalRevenue + migratedRevenue;

  const prevCompleted = prevBookings.filter((b: any) => b.status === "Completed" || b.status === "No Show");
  const prevRevenue = prevCompleted.reduce((s: number, b: any) => s + Number(b.total_price), 0);

  const totalGroomerPay = commissions.reduce((s: number, c: any) => s + Number(c.groomer_pay), 0);
  const totalStudioShare = commissions.reduce((s: number, c: any) => s + Number(c.studio_share), 0);
  const prevGroomerPay = prevCommissions.reduce((s: number, c: any) => s + Number(c.groomer_pay), 0);
  const prevStudioShare = prevCommissions.reduce((s: number, c: any) => s + Number(c.studio_share), 0);

  const projectedGross = upcomingAll.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);

  // Date-aware expenses
  const dateAwareExpenses = calcDateAwareExpenses(recurringExpenses, new Date());
  const paidRecurring = dateAwareExpenses.paidTotal;
  const upcomingRecurring = dateAwareExpenses.upcomingTotal;
  const monthlyOneOffExpenses = oneOffExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const upcomingOneOffTotal = upcomingOneOffExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  const expensesPaidToDate = paidRecurring + monthlyOneOffExpenses;
  const expensesStillToPay = upcomingRecurring + upcomingOneOffTotal;
  const totalMonthlyExpenses = expensesPaidToDate + expensesStillToPay;
  const netProfit = totalStudioShare - expensesPaidToDate;
  const projectedProfit = totalStudioShare - totalMonthlyExpenses;

  const calcDelta = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;

  // Cancellation rate
  const totalBookingsCount = bookings.length + migratedBookings.length;
  const cancellationRate = totalBookingsCount > 0 ? Math.round((cancelled.length / totalBookingsCount) * 100) : 0;

  // Status breakdown
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b: any) => { counts[b.status] = (counts[b.status] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] || "hsl(220, 10%, 45%)" }))
      .sort((a, b) => b.value - a.value);
  }, [bookings]);

  // Source data
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b: any) => {
      const src = b.referral_source || "direct";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, label: SOURCE_LABELS[name] || name, fill: SOURCE_COLORS[name] || SOURCE_COLORS.other }))
      .sort((a, b) => b.value - a.value);
  }, [bookings]);
  const sourceChartConfig: ChartConfig = Object.fromEntries(sourceData.map((s) => [s.name, { label: s.label, color: s.fill }]));

  // Revenue trend
  const revenueTrend = useMemo(() => {
    const days = differenceInDays(end, start);
    let intervals: Date[];
    let labelFmt: string;
    if (days <= 14) {
      intervals = eachDayOfInterval({ start, end });
      labelFmt = "EEE dd";
    } else if (days <= 90) {
      intervals = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      labelFmt = "dd MMM";
    } else {
      intervals = eachMonthOfInterval({ start, end });
      labelFmt = "MMM yy";
    }

    return intervals.map((d, i) => {
      const rangeEnd = intervals[i + 1] ? subDays(intervals[i + 1], 1) : end;
      const rev = completed
        .filter((b: any) => {
          const bd = parseISO(b.booking_date);
          return isWithinInterval(bd, { start: startOfDay(d), end: endOfDay(rangeEnd) });
        })
        .reduce((s: number, b: any) => s + Number(b.total_price), 0);

      // Previous period equivalent
      const offset = start.getTime() - prev.start.getTime();
      const prevD = new Date(d.getTime() - offset);
      const prevRangeEnd = new Date(rangeEnd.getTime() - offset);
      const prevRev = compareOn ? prevCompleted
        .filter((b: any) => {
          const bd = parseISO(b.booking_date);
          return isWithinInterval(bd, { start: startOfDay(prevD), end: endOfDay(prevRangeEnd) });
        })
        .reduce((s: number, b: any) => s + Number(b.total_price), 0) : undefined;

      return { label: format(d, labelFmt), revenue: rev, previous: prevRev };
    });
  }, [completed, prevCompleted, start, end, prev, compareOn]);
  const trendConfig: ChartConfig = {
    revenue: { label: "Revenue", color: "#FF6B35" },
    previous: { label: "Previous", color: "hsl(220, 10%, 65%)" },
  };

  // Best / quietest
  const bestDay = revenueTrend.reduce((best, d) => d.revenue > best.revenue ? d : best, { label: "-", revenue: 0 });
  const quietDay = revenueTrend.filter(d => d.revenue >= 0).reduce((q, d) => d.revenue < q.revenue ? d : q, revenueTrend[0] || { label: "-", revenue: 0 });

  // Groomer performance
  const groomerPerformance = useMemo(() => {
    const map = new Map<string, {
      id: string; name: string; completed: number; revenue: number; commission: number;
      cancellations: number; customerEmails: Set<string>; services: Record<string, number>;
    }>();
    staff.forEach((g: any) => map.set(g.id, {
      id: g.id, name: g.name, completed: 0, revenue: 0, commission: 0,
      cancellations: 0, customerEmails: new Set(), services: {},
    }));

    commissions.forEach((c: any) => {
      const entry = map.get(c.staff_id);
      if (entry) {
        entry.completed++;
        entry.revenue += Number(c.total_price);
        entry.commission += Number(c.groomer_pay);
        const svcName = c.bookings?.services?.name || "Other";
        entry.services[svcName] = (entry.services[svcName] || 0) + 1;
        if (c.bookings?.customer_email) entry.customerEmails.add(c.bookings.customer_email.toLowerCase());
      }
    });

    bookings.forEach((b: any) => {
      if (b.status === "Cancelled" && b.staff_id) {
        const entry = map.get(b.staff_id);
        if (entry) entry.cancellations++;
      }
    });

    // Rebooking: customers who have >1 booking with same groomer
    const groomerCustomerBookings = new Map<string, Map<string, number>>();
    bookings.forEach((b: any) => {
      if (b.staff_id && b.customer_email && b.status !== "Cancelled") {
        if (!groomerCustomerBookings.has(b.staff_id)) groomerCustomerBookings.set(b.staff_id, new Map());
        const cm = groomerCustomerBookings.get(b.staff_id)!;
        const e = b.customer_email.toLowerCase();
        cm.set(e, (cm.get(e) || 0) + 1);
      }
    });

    const result = Array.from(map.values()).map(g => {
      const cm = groomerCustomerBookings.get(g.id);
      const totalCustomers = g.customerEmails.size;
      const rebookedCustomers = cm ? Array.from(cm.values()).filter(v => v > 1).length : 0;
      const rebookRate = totalCustomers > 0 ? Math.round((rebookedCustomers / totalCustomers) * 100) : 0;
      const cancellationPct = (g.completed + g.cancellations) > 0
        ? Math.round((g.cancellations / (g.completed + g.cancellations)) * 100) : 0;
      const topServices = Object.entries(g.services).sort(([, a], [, b]) => b - a).slice(0, 3);
      return { ...g, rebookRate, cancellationPct, topServices, customerEmails: undefined };
    });

    // Sort
    return result.sort((a, b) => {
      const dir = groomerSort.asc ? 1 : -1;
      switch (groomerSort.col) {
        case "name": return dir * a.name.localeCompare(b.name);
        case "completed": return dir * (a.completed - b.completed);
        case "revenue": return dir * (a.revenue - b.revenue);
        case "commission": return dir * (a.commission - b.commission);
        case "cancellations": return dir * (a.cancellationPct - b.cancellationPct);
        case "rebook": return dir * (a.rebookRate - b.rebookRate);
        default: return dir * (a.revenue - b.revenue);
      }
    });
  }, [commissions, bookings, staff, groomerSort]);

  // Top performer badges
  const topRevenue = groomerPerformance.length > 0 ? groomerPerformance.reduce((t, g) => g.revenue > t.revenue ? g : t) : null;
  const topRebook = groomerPerformance.length > 0 ? groomerPerformance.reduce((t, g) => g.rebookRate > t.rebookRate ? g : t) : null;

  // Forecast: next 7 days
  const next7Days = useMemo(() => {
    const days = eachDayOfInterval({ start: new Date(), end: addDays(new Date(), 6) });
    return days.map(d => {
      const dayBookings = upcomingAll.filter((b: any) => isSameDay(parseISO(b.booking_date), d));
      const rev = dayBookings.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
      const wixCount = dayBookings.filter((b: any) => b._source === "wix").length;
      return { date: d, label: format(d, "EEE dd MMM"), count: dayBookings.length, revenue: rev, wixCount };
    });
  }, [upcomingAll]);

  const totalDepositsCollected = upcomingAll.reduce((s: number, b: any) => s + Number(b.deposit_paid || 0), 0);
  const totalBalanceDue = upcomingAll.reduce((s: number, b: any) => s + Math.max(0, Number(b.total_price || 0) - Number(b.deposit_paid || 0)), 0);
  const unbilledCount = upcomingAll.filter((b: any) => !b.total_price || Number(b.total_price) === 0).length;

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Director";

  const rangeButtons: { key: RangeKey; label: string }[] = [
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "year", label: "This Year" },
    { key: "custom", label: "Custom" },
  ];

  const DeltaBadge = ({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) => {
    if (!compareOn || previous === 0) return null;
    const delta = calcDelta(current, previous);
    if (delta === 0) return null;
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", delta > 0 ? "text-green-600" : "text-destructive")}>
        {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(delta)}%{suffix}
      </span>
    );
  };

  const SortHeader = ({ col, label }: { col: string; label: string }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors text-xs"
      onClick={() => setGroomerSort(prev => ({ col, asc: prev.col === col ? !prev.asc : false }))}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {groomerSort.col === col && (groomerSort.asc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </TableHead>
  );

  const getActivityIcon = (status: string) => {
    switch (status) {
      case "Completed": return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
      case "Cancelled": return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
      case "No Show": return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
      default: return <Dog className="h-4 w-4 text-primary shrink-0" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* Warning banner for bookings with unavailable groomers */}
        <UnavailableBookingsWarning />
        {/* Header + Period Selector */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading">Welcome back, {displayName}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Business Intelligence Dashboard</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {rangeButtons.map((rb) =>
                rb.key === "custom" ? (
                  <Popover key={rb.key}>
                    <PopoverTrigger asChild>
                      <Button variant={rangeKey === "custom" ? "default" : "outline"} size="sm" className="text-xs h-8">
                        {rangeKey === "custom" && customStart && customEnd
                          ? `${format(customStart, "dd MMM")} – ${format(customEnd, "dd MMM")}`
                          : "Custom"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="end">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-muted-foreground">Start</p>
                        <CalendarPicker
                          mode="single"
                          selected={customStart}
                          onSelect={(d) => { setCustomStart(d); if (d && !customEnd) setCustomEnd(d); setRangeKey("custom"); }}
                          className="p-2 pointer-events-auto"
                        />
                        <p className="text-xs font-medium text-muted-foreground">End</p>
                        <CalendarPicker
                          mode="single"
                          selected={customEnd}
                          onSelect={(d) => { setCustomEnd(d); setRangeKey("custom"); }}
                          className="p-2 pointer-events-auto"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Button
                    key={rb.key}
                    variant={rangeKey === rb.key ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setRangeKey(rb.key)}
                  >
                    {rb.label}
                  </Button>
                )
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Compare to previous period</span>
              <Switch checked={compareOn} onCheckedChange={setCompareOn} />
            </div>
          </div>
        </div>

        {/* ── 1. Key Metrics Cards ─────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue */}
          <Card className="rounded-xl border-l-4 border-l-accent">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Total Revenue</span>
                <PoundSterling className="h-4 w-4 text-accent" />
              </div>
              <p className="text-2xl font-bold font-heading">£{combinedRevenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">£{projectedGross.toLocaleString()} projected upcoming</p>
              <DeltaBadge current={totalRevenue} previous={prevRevenue} />
            </CardContent>
          </Card>

          {/* Appointments */}
          <Card className="rounded-xl border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Appointments</span>
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold font-heading">{totalBookingsCount}</p>
              <p className="text-xs text-muted-foreground">
                {completed.length} completed · {confirmed.length + pending.length + upcomingMigrated.length} upcoming · {cancelled.length} cancelled
              </p>
              <DeltaBadge current={bookings.length} previous={prevBookings.length} />
            </CardContent>
          </Card>

          {/* Net Profit */}
          <Card className={cn("rounded-xl border-l-4", netProfit >= 0 ? "border-l-green-500" : "border-l-destructive")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Salon Profit</span>
                <Wallet className="h-4 w-4 text-green-600" />
              </div>
              <p className={cn("text-2xl font-bold font-heading", netProfit >= 0 ? "text-green-600" : "text-destructive")}>
                £{netProfit.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">After groomer pay & paid expenses</p>
              {expensesStillToPay > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  📅 £{Math.round(expensesStillToPay).toLocaleString()} still due this month
                </p>
              )}
              {totalMonthlyExpenses > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  📊 £{Math.round(projectedProfit).toLocaleString()} projected end of month
                </p>
              )}
              <DeltaBadge current={netProfit} previous={prevStudioShare} />
            </CardContent>
          </Card>

          {/* Groomer Pay */}
          <Card className="rounded-xl border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Total Payroll</span>
                <Users className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold font-heading">£{totalGroomerPay.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                {totalRevenue > 0 ? Math.round((totalGroomerPay / totalRevenue) * 100) : 0}% of revenue
              </p>
              <DeltaBadge current={totalGroomerPay} previous={prevGroomerPay} />
            </CardContent>
          </Card>
        </div>

        {/* ── 1b. Month Forecast ───────────────────── */}
        <MonthForecastCard />

        {/* ── 2. Revenue Trend Chart ───────────────── */}
        <Card className="rounded-xl">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Revenue Trend</CardTitle>
              <DeltaBadge current={totalRevenue} previous={prevRevenue} />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {revenueTrend.length > 1 ? (
              <>
                <ChartContainer config={trendConfig} className="h-[260px] w-full">
                  <LineChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" tickFormatter={(v) => `£${v}`} tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="revenue" stroke="#FF6B35" strokeWidth={2.5} dot={false} name="This period" />
                    {compareOn && (
                      <Line type="monotone" dataKey="previous" stroke="hsl(220, 10%, 65%)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Previous" />
                    )}
                  </LineChart>
                </ChartContainer>
                <div className="flex gap-6 mt-2 text-xs text-muted-foreground">
                  <span>Best: <strong className="text-foreground">{bestDay.label}</strong> — £{bestDay.revenue.toLocaleString()}</span>
                  <span>Quietest: <strong className="text-foreground">{quietDay.label}</strong> — £{quietDay.revenue.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Not enough data for trend chart</div>
            )}
          </CardContent>
        </Card>

        {/* ── 3. Appointments Health + Forecast ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column — 60% */}
          <div className="lg:col-span-3 space-y-4">
            {/* Booking Sources */}
            <Card className="rounded-xl">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-semibold">Booking Sources</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {sourceData.length > 0 ? (
                  <div className="flex flex-col items-center gap-3">
                    <ChartContainer config={sourceChartConfig} className="h-[160px] w-[160px]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                        <Pie data={sourceData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={40} outerRadius={65} strokeWidth={2}>
                          {sourceData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {sourceData.map((s) => (
                        <div key={s.name} className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                          <span className="text-xs text-muted-foreground">
                            {s.label} <strong className="text-foreground">{s.value}</strong> ({totalBookingsCount > 0 ? Math.round((s.value / totalBookingsCount) * 100) : 0}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No booking data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Status Breakdown */}
            <Card className="rounded-xl">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-semibold">Booking Status</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {statusData.length > 0 ? (
                  <div className="space-y-3">
                    {statusData.map((s) => {
                      const pct = totalBookingsCount > 0 ? Math.round((s.value / totalBookingsCount) * 100) : 0;
                      return (
                        <div key={s.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">{s.name}</span>
                            <span className="text-xs text-muted-foreground">{s.value} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.fill }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
                )}
              </CardContent>
            </Card>

            {/* Cancellation Rate */}
            <Card className="rounded-xl">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-semibold">Cancellation Rate</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 flex flex-col items-center justify-center">
                <p className={cn(
                  "text-5xl font-bold font-heading",
                  cancellationRate < 10 ? "text-green-600" : cancellationRate < 20 ? "text-amber-500" : "text-destructive"
                )}>
                  {cancellationRate}%
                </p>
                <p className="text-xs text-muted-foreground mt-2">{cancelled.length} of {totalBookingsCount} bookings cancelled</p>
                <div className="mt-3 px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground">
                  Industry average: 8–12%
                </div>
                {cancellationRate < 10 && <Badge className="mt-2 bg-green-100 text-green-700 hover:bg-green-100">Below average ✅</Badge>}
                {cancellationRate >= 10 && cancellationRate < 20 && <Badge className="mt-2 bg-amber-100 text-amber-700 hover:bg-amber-100">At industry average</Badge>}
                {cancellationRate >= 20 && <Badge className="mt-2 bg-red-100 text-red-700 hover:bg-red-100">Above average ⚠️</Badge>}
              </CardContent>
            </Card>
          </div>

          {/* Right column — 40% */}
          <div className="lg:col-span-2 space-y-4">
            {/* Upcoming Revenue Forecast */}
            <Card className="rounded-xl">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-semibold">Upcoming Revenue Forecast</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold font-heading">£{projectedGross.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Confirmed (30d)</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold font-heading text-green-600">£{totalDepositsCollected.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Deposits In</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold font-heading text-amber-500">£{totalBalanceDue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Balance Due</p>
                  </div>
                </div>
                {unbilledCount > 0 && (
                  <p className="text-xs text-amber-600 mb-3">⚠️ {unbilledCount} appointment{unbilledCount > 1 ? "s" : ""} with no price set</p>
                )}
                <div className="space-y-1.5">
                  {next7Days.map((d) => (
                    <div key={d.label} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                      <span className="text-muted-foreground">{d.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {d.count} appt{d.count !== 1 ? "s" : ""}
                          {d.wixCount > 0 && <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-300">W {d.wixCount}</Badge>}
                        </span>
                        <span className="font-semibold min-w-[60px] text-right">£{d.revenue.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity Feed */}
            <Card className="rounded-xl">
              <CardHeader className="p-5 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {recentActivity.length > 0 ? (
                  <div className="space-y-2">
                    {recentActivity.map((b: any) => (
                      <div
                        key={b.id}
                        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate("/bookings")}
                      >
                        {getActivityIcon(b.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-tight">
                            {b.status === "Completed" && <><strong>{b.customer_name}</strong>'s {b.services?.name || "groom"} with {b.staff?.name || "groomer"}</>}
                            {b.status === "Cancelled" && <><strong>{b.customer_name}</strong> cancelled {format(parseISO(b.booking_date), "dd MMM")} booking</>}
                            {b.status === "No Show" && <><strong>{b.customer_name}</strong> no-show for {format(parseISO(b.booking_date), "dd MMM")}</>}
                            {!["Completed", "Cancelled", "No Show"].includes(b.status) && (
                              <>New booking — <strong>{b.customer_name}</strong> booked {b.services?.name || "service"} for {format(parseISO(b.booking_date), "dd MMM")}
                                {Number(b.deposit_paid) > 0 && <> — £{Number(b.deposit_paid)} deposit</>}
                              </>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{format(parseISO(b.created_at), "dd MMM · HH:mm")}</p>
                        </div>
                        {Number(b.total_price) > 0 && (
                          <span className="text-sm font-semibold shrink-0">£{Number(b.total_price)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No recent activity</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── 4. Groomer Performance Table ─────────── */}
        <Card className="rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-semibold">Groomer Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 overflow-x-auto">
            {groomerPerformance.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader col="name" label="Groomer" />
                    <SortHeader col="completed" label="Completed" />
                    <SortHeader col="revenue" label="Revenue" />
                    <SortHeader col="commission" label="Commission" />
                    <SortHeader col="cancellations" label="Cancellations" />
                    <SortHeader col="rebook" label="Rebook Rate" />
                    <TableHead className="text-xs">Badge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groomerPerformance.map((g) => (
                    <>
                      <TableRow
                        key={g.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedGroomer(expandedGroomer === g.id ? null : g.id)}
                      >
                        <TableCell className="font-medium text-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {g.name.charAt(0)}
                            </div>
                            {g.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{g.completed}</TableCell>
                        <TableCell className="text-sm font-semibold">£{g.revenue.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">£{g.commission.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">
                          {g.cancellations} <span className="text-muted-foreground">({g.cancellationPct}%)</span>
                        </TableCell>
                        <TableCell className="text-sm">{g.rebookRate}%</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {topRevenue?.id === g.id && g.revenue > 0 && <span title="Top Revenue">⭐</span>}
                            {topRebook?.id === g.id && g.rebookRate > 0 && <span title="Best Retention">🎯</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedGroomer === g.id && (
                        <TableRow key={`${g.id}-exp`}>
                          <TableCell colSpan={7} className="bg-muted/30 py-2 px-6">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Top Services</p>
                            {g.topServices.length > 0 ? (
                              <div className="flex gap-3">
                                {g.topServices.map(([name, count]) => (
                                  <Badge key={name} variant="outline" className="text-xs">
                                    {name}: {count}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No service data</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No groomer data for this period</p>
            )}
          </CardContent>
        </Card>

        {/* ── 5. Website Analytics — Full Width ──────── */}
        <WebsiteAnalyticsSection />
      </div>
    </AppLayout>
  );
};

export default Index;
