import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  PoundSterling,
  Users,
  Clock,
  ArrowRight,
  Wallet,
  BarChart3,
  UserCheck,
  UserPlus,
  AlertTriangle,
  Gauge,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  subWeeks,
  subMonths,
  subYears,
  parseISO,
  isAfter,
  isBefore,
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
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ── Date range presets ──────────────────────────────────────
type RangeKey = "today" | "7days" | "month" | "year" | "custom";

function getRange(key: RangeKey, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (key) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "7days":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
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
  const diff = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - diff - 86400000),
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
  other: "hsl(240, 5%, 65%)",
};

const SOURCE_LABELS: Record<string, string> = {
  google: "Google",
  instagram: "Instagram",
  facebook: "Facebook",
  referral: "Referral",
  walk_in: "Walk-in",
  direct: "Direct",
  other: "Other",
};

// ── Component ───────────────────────────────────────────────
const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const { start, end } = getRange(rangeKey, customStart, customEnd);
  const prev = getPreviousRange(start, end);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const prevStartStr = format(prev.start, "yyyy-MM-dd");
  const prevEndStr = format(prev.end, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

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

  // Current period bookings
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

  // Previous period bookings
  const { data: prevBookings = [] } = useQuery({
    queryKey: ["dash-prev-bookings", prevStartStr, prevEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, total_price, deposit_paid, status, referral_source, customer_email")
        .gte("booking_date", prevStartStr)
        .lte("booking_date", prevEndStr);
      return (data ?? []) as any[];
    },
  });

  // Commission records for current period
  const { data: commissions = [] } = useQuery({
    queryKey: ["dash-commissions", startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_records")
        .select("*, bookings(customer_name, dog_name, booking_date, service_id, services:service_id(name))")
        .gte("created_at", `${startStr}T00:00:00`)
        .lte("created_at", `${endStr}T23:59:59`);
      return (data ?? []) as any[];
    },
  });

  // Upcoming bookings (from today onwards)
  const { data: upcoming = [] } = useQuery({
    queryKey: ["dash-upcoming", todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, staff(name), services(name)")
        .gte("booking_date", todayStr)
        .in("status", ["Confirmed", "Pending"])
        .order("booking_date")
        .order("booking_time")
        .limit(8);
      return (data ?? []) as any[];
    },
  });

  // Staff list
  const { data: staff = [] } = useQuery({
    queryKey: ["dash-staff"],
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("id, name, role").order("name");
      return (data ?? []) as any[];
    },
  });

  // Staff availability (weekly capacity)
  const { data: availability = [] } = useQuery({
    queryKey: ["dash-availability"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_availability").select("*").eq("is_available", true);
      return (data ?? []) as any[];
    },
  });

  // All bookings for capacity (this week)
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const { data: weekBookings = [] } = useQuery({
    queryKey: ["dash-week-capacity", weekStart, weekEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, status")
        .gte("booking_date", weekStart)
        .lte("booking_date", weekEnd)
        .not("status", "eq", "Cancelled");
      return (data ?? []) as any[];
    },
  });

  // ── Computed Stats ───────────────────────────
  const completed = bookings.filter((b: any) => b.status === "Completed" || b.status === "No Show");
  const noShows = bookings.filter((b: any) => b.status === "No Show");

  const totalRevenue = completed.reduce((s: number, b: any) => s + Number(b.total_price), 0);
  const totalDeposits = completed.reduce((s: number, b: any) => s + Number(b.deposit_paid), 0);
  const totalFinalCharge = completed.reduce((s: number, b: any) => s + Number(b.final_charge || 0), 0);
  const grossCollected = totalDeposits + totalFinalCharge;

  const prevCompleted = prevBookings.filter((b: any) => b.status === "Completed" || b.status === "No Show");
  const prevRevenue = prevCompleted.reduce((s: number, b: any) => s + Number(b.total_price), 0);
  const revenueDelta = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;

  // Commission aggregates
  const totalGroomerPay = commissions.reduce((s: number, c: any) => s + Number(c.groomer_pay), 0);
  const totalStudioShare = commissions.reduce((s: number, c: any) => s + Number(c.studio_share), 0);

  // Projected income from upcoming
  const projectedGross = upcoming.reduce((s: number, b: any) => s + Number(b.total_price), 0);
  const projectedGroomerPay = upcoming.reduce((s: number, b: any) => {
    const rate = b.is_groomers_own_customer ? 0.5 : 0.4;
    return s + Number(b.total_price) * rate;
  }, 0);
  const projectedSalonTake = projectedGross - projectedGroomerPay;

  // No-show savings
  const noShowSavings = noShows.reduce((s: number, b: any) => s + Number(b.deposit_paid) * 0.5, 0);

  // Capacity
  const groomers = staff.filter((s: any) => s.role === "Groomer");
  const slotsPerGroomerPerDay = 6; // approximate
  const totalWeeklySlots = groomers.length * 5 * slotsPerGroomerPerDay || 30;
  const bookedSlots = weekBookings.length;
  const capacityPct = Math.min(100, Math.round((bookedSlots / totalWeeklySlots) * 100));

  // Customer retention
  const allEmails = bookings.map((b: any) => b.customer_email?.toLowerCase()).filter(Boolean);
  const prevEmails = new Set(prevBookings.map((b: any) => b.customer_email?.toLowerCase()).filter(Boolean));
  const repeatCustomers = new Set(allEmails.filter((e: string) => prevEmails.has(e)));
  const uniqueCurrentEmails = new Set(allEmails);
  const retentionRate = uniqueCurrentEmails.size > 0 ? Math.round((repeatCustomers.size / uniqueCurrentEmails.size) * 100) : 0;
  const newCustomers = uniqueCurrentEmails.size - repeatCustomers.size;

  // Source pie
  const sourceCounts: Record<string, number> = {};
  bookings.forEach((b: any) => {
    const src = b.referral_source || "direct";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  const sourceData = Object.entries(sourceCounts)
    .map(([name, value]) => ({ name, value, label: SOURCE_LABELS[name] || name, fill: SOURCE_COLORS[name] || SOURCE_COLORS.other }))
    .sort((a, b) => b.value - a.value);
  const sourceChartConfig: ChartConfig = Object.fromEntries(sourceData.map((s) => [s.name, { label: s.label, color: s.fill }]));

  // Top services bar
  const serviceRevenue: Record<string, number> = {};
  completed.forEach((b: any) => {
    const svc = b.services?.name || "Other";
    serviceRevenue[svc] = (serviceRevenue[svc] || 0) + Number(b.total_price);
  });
  const serviceData = Object.entries(serviceRevenue)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
  const serviceChartConfig: ChartConfig = { revenue: { label: "Revenue", color: "hsl(var(--accent))" } };

  // Revenue trend (daily for <=31 days, weekly for year)
  const revenueTrend = useMemo(() => {
    const map = new Map<string, number>();
    completed.forEach((b: any) => {
      const key = b.booking_date;
      map.set(key, (map.get(key) || 0) + Number(b.total_price));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date: format(parseISO(date), "dd MMM"), revenue }));
  }, [completed]);
  const trendConfig: ChartConfig = { revenue: { label: "Revenue", color: "hsl(var(--accent))" } };

  // Groomer leaderboard
  const groomerStats = useMemo(() => {
    const map = new Map<string, { name: string; ownCustomers: number; salonCustomers: number; totalRevenue: number }>();
    groomers.forEach((g: any) => map.set(g.id, { name: g.name, ownCustomers: 0, salonCustomers: 0, totalRevenue: 0 }));
    commissions.forEach((c: any) => {
      const entry = map.get(c.staff_id);
      if (entry) {
        entry.totalRevenue += Number(c.total_price);
        if (c.commission_type === "own_customer") entry.ownCustomers++;
        else entry.salonCustomers++;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [commissions, groomers]);

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Director";

  const rangeButtons: { key: RangeKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7days", label: "7 Days" },
    { key: "month", label: "This Month" },
    { key: "year", label: "This Year" },
    { key: "custom", label: "Custom" },
  ];

  // ── Delta Badge helper ────────────────────────
  const DeltaBadge = ({ delta }: { delta: number }) => {
    if (delta === 0) return null;
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", delta > 0 ? "text-success" : "text-destructive")}>
        {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(delta)}%
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading">Welcome back, {displayName}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Business Command Center</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {rangeButtons.map((rb) =>
              rb.key === "custom" ? (
                <Popover key={rb.key}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={rangeKey === "custom" ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-8"
                    >
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
        </div>

        {/* ── 1. Finance Header — Big Numbers ─────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue */}
          <Card className="rounded-xl border-l-4 border-l-accent">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Total Revenue</span>
                <PoundSterling className="h-4 w-4 text-accent" />
              </div>
              <p className="text-2xl font-bold font-heading">£{totalRevenue.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-1">
                <DeltaBadge delta={revenueDelta} />
                <span className="text-xs text-muted-foreground">vs previous period</span>
              </div>
            </CardContent>
          </Card>

          {/* Salon Net Profit */}
          <Card className="rounded-xl border-l-4 border-l-success cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/finance")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Salon Net Profit</span>
                <Wallet className="h-4 w-4 text-success" />
              </div>
              <p className="text-2xl font-bold font-heading">£{totalStudioShare.toLocaleString()}</p>
              <span className="text-xs text-muted-foreground">After groomer payouts</span>
            </CardContent>
          </Card>

          {/* Total Payroll */}
          <Card className="rounded-xl border-l-4 border-l-primary cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/finance")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Total Payroll</span>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold font-heading">£{totalGroomerPay.toLocaleString()}</p>
              <span className="text-xs text-muted-foreground">40%/50% commissions</span>
            </CardContent>
          </Card>

          {/* Projected Income */}
          <Card className="rounded-xl border-l-4 border-l-warm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Projected Income</span>
                <TrendingUp className="h-4 w-4 text-warm" />
              </div>
              <p className="text-2xl font-bold font-heading">£{projectedSalonTake.toLocaleString()}</p>
              <span className="text-xs text-muted-foreground">
                £{projectedGross.toLocaleString()} gross – £{Math.round(projectedGroomerPay).toLocaleString()} pay
              </span>
            </CardContent>
          </Card>
        </div>

        {/* ── 2. Charts Row ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue Trend Line */}
          <Card className="lg:col-span-2 rounded-xl">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-body font-semibold">Revenue Trend</CardTitle>
                <DeltaBadge delta={revenueDelta} />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {revenueTrend.length > 1 ? (
                <ChartContainer config={trendConfig} className="h-[220px] w-full">
                  <LineChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" tickFormatter={(v) => `£${v}`} tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  Not enough data for trend chart
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Services */}
          <Card className="rounded-xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-body font-semibold">Top Services</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {serviceData.length > 0 ? (
                <ChartContainer config={serviceChartConfig} className="h-[220px] w-full">
                  <BarChart data={serviceData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `£${v}`} className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={90} className="text-xs" tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  No completed services yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── 3. Middle Row: Leaderboard + Source + Retention ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Groomer Leaderboard */}
          <Card className="lg:col-span-2 rounded-xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-body font-semibold">Groomer Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {groomerStats.length > 0 ? (
                <div className="space-y-2">
                  {groomerStats.map((g, i) => (
                    <div key={g.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                      <span className="text-lg font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{g.name}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <UserCheck className="h-3 w-3" /> {g.ownCustomers} own
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {g.salonCustomers} salon
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-bold shrink-0">£{g.totalRevenue.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No commission data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Customer Acquisition */}
          <Card className="rounded-xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-body font-semibold">Where Customers Find You</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {sourceData.length > 0 ? (
                <div className="flex flex-col items-center gap-4">
                  <ChartContainer config={sourceChartConfig} className="h-[160px] w-[160px] shrink-0">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie data={sourceData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={40} outerRadius={65} strokeWidth={2}>
                        {sourceData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {sourceData.map((s) => (
                      <div key={s.name} className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                        <span className="text-xs text-muted-foreground">
                          {s.label} <span className="font-semibold text-foreground">{s.value}</span>
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
        </div>

        {/* ── 4. Operations Row: Capacity + Retention + No-Show + Upcoming ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Capacity Gauge */}
          <Card className="rounded-xl">
            <CardContent className="p-4 text-center">
              <Gauge className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground mb-1">Weekly Capacity</p>
              <p className="text-3xl font-bold font-heading">{capacityPct}%</p>
              <Progress value={capacityPct} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">{bookedSlots}/{totalWeeklySlots} slots filled</p>
            </CardContent>
          </Card>

          {/* Retention */}
          <Card className="rounded-xl">
            <CardContent className="p-4 text-center">
              <UserCheck className="h-5 w-5 mx-auto text-success mb-2" />
              <p className="text-xs text-muted-foreground mb-1">Retention Rate</p>
              <p className="text-3xl font-bold font-heading">{retentionRate}%</p>
              <div className="flex justify-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" /> {repeatCustomers.size} repeat</span>
                <span className="flex items-center gap-1"><UserPlus className="h-3 w-3" /> {newCustomers} new</span>
              </div>
            </CardContent>
          </Card>

          {/* No-Show Impact */}
          <Card className="rounded-xl">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-5 w-5 mx-auto text-warm mb-2" />
              <p className="text-xs text-muted-foreground mb-1">No-Show Impact</p>
              <p className="text-3xl font-bold font-heading">{noShows.length}</p>
              <p className="text-xs text-success font-medium mt-1">£{noShowSavings.toLocaleString()} saved via deposits</p>
            </CardContent>
          </Card>

          {/* Upcoming Quick Stat */}
          <Card className="rounded-xl">
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground mb-1">Upcoming</p>
              <p className="text-3xl font-bold font-heading">{upcoming.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                £{projectedGross.toLocaleString()} projected
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── 5. Upcoming Sessions ────────────────────── */}
        <Card className="rounded-xl">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-body font-semibold">Upcoming Sessions</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-accent" onClick={() => navigate("/bookings")}>
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {upcoming.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {upcoming.map((b: any) => (
                  <div key={b.id} className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <p className="text-sm font-medium truncate">{b.services?.name ?? "Service"}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(b.booking_date), "MMM d")} · {b.booking_time?.slice(0, 5)}
                      {b.staff?.name && ` · ${b.staff.name}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{b.customer_name} — {b.dog_name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-semibold">£{Number(b.total_price).toLocaleString()}</span>
                      {b.is_groomers_own_customer && <Badge variant="outline" className="text-[10px] px-1.5">Own</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No upcoming sessions</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Index;
