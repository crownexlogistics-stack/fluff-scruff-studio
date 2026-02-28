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
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, isAfter, parseISO, subMonths } from "date-fns";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

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
  google: "Google Search",
  instagram: "Instagram",
  facebook: "Facebook",
  referral: "Referral",
  walk_in: "Walk-in",
  direct: "Direct",
  other: "Other",
};

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");
  const prevMonthStart = format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd");
  const prevMonthEnd = format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd");

  // All bookings this month
  const { data: monthBookings } = useQuery({
    queryKey: ["dashboard-month-bookings", monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .gte("booking_date", monthStart)
        .lte("booking_date", monthEnd);
      return data ?? [];
    },
  });

  // Previous month bookings for comparison
  const { data: prevMonthBookings } = useQuery({
    queryKey: ["dashboard-prev-month-bookings", prevMonthStart, prevMonthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, total_price, deposit_paid")
        .gte("booking_date", prevMonthStart)
        .lte("booking_date", prevMonthEnd);
      return data ?? [];
    },
  });

  // Upcoming bookings (today and future)
  const { data: upcomingBookings } = useQuery({
    queryKey: ["dashboard-upcoming", todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, staff(name), services(name)")
        .gte("booking_date", todayStr)
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true })
        .limit(8);
      return data ?? [];
    },
  });

  // Profile for welcome
  const { data: profile } = useQuery({
    queryKey: ["dashboard-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Computed stats
  const bookings = monthBookings ?? [];
  const prev = prevMonthBookings ?? [];
  const upcoming = upcomingBookings ?? [];

  const totalBookings = bookings.length;
  const prevTotalBookings = prev.length;
  const bookingsDelta = prevTotalBookings > 0 ? Math.round(((totalBookings - prevTotalBookings) / prevTotalBookings) * 100) : 0;

  const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.total_price), 0);
  const prevRevenue = prev.reduce((sum, b) => sum + Number(b.total_price), 0);
  const revenueDelta = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;

  const totalPaid = bookings.reduce((sum, b) => sum + Number(b.deposit_paid), 0);

  const upcomingCount = upcoming.length;
  const upcomingRevenue = upcoming.reduce((sum, b) => sum + Number(b.total_price), 0);

  // Booking sources
  const sourceCounts: Record<string, number> = {};
  bookings.forEach((b) => {
    const src = (b as any).referral_source || "direct";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  const sourceData = Object.entries(sourceCounts)
    .map(([name, value]) => ({ name, value, label: SOURCE_LABELS[name] || name, fill: SOURCE_COLORS[name] || SOURCE_COLORS.other }))
    .sort((a, b) => b.value - a.value);

  const sourceChartConfig: ChartConfig = Object.fromEntries(
    sourceData.map((s) => [s.name, { label: s.label, color: s.fill }])
  );

  // Monthly revenue chart (simple: this month vs last month)
  const revenueChartData = [
    { month: format(subMonths(today, 1), "MMM"), revenue: prevRevenue },
    { month: format(today, "MMM"), revenue: totalRevenue },
  ];
  const revenueChartConfig: ChartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--accent))" },
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Director";

  const stats = [
    {
      label: "Total Bookings",
      value: totalBookings,
      delta: bookingsDelta,
      icon: Calendar,
      sub: `This month`,
    },
    {
      label: "Total Revenue",
      value: `£${totalRevenue.toLocaleString()}`,
      delta: revenueDelta,
      icon: PoundSterling,
      sub: `This month`,
    },
    {
      label: "Amount Paid",
      value: `£${totalPaid.toLocaleString()}`,
      delta: null,
      icon: PoundSterling,
      sub: "Deposits collected",
    },
    {
      label: "Upcoming",
      value: upcomingCount,
      delta: null,
      icon: Clock,
      sub: `£${upcomingRevenue.toLocaleString()} projected`,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-heading">Welcome back, {displayName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here's what's happening with your business
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-1 p-4">
                <CardTitle className="text-xs font-medium text-muted-foreground font-body">
                  {stat.label}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold font-heading">{stat.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  {stat.delta !== null && stat.delta !== 0 && (
                    <span
                      className={`flex items-center text-xs font-medium ${
                        stat.delta > 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {stat.delta > 0 ? (
                        <TrendingUp className="h-3 w-3 mr-0.5" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-0.5" />
                      )}
                      {Math.abs(stat.delta)}%
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{stat.sub}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main grid: Charts + Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Charts */}
          <div className="lg:col-span-2 space-y-4">
            {/* Revenue Overview */}
            <Card className="rounded-xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-body font-semibold">
                  Revenue Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ChartContainer config={revenueChartConfig} className="h-[200px] w-full">
                  <BarChart data={revenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `£${v}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Booking Sources */}
            <Card className="rounded-xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-body font-semibold">
                  Where Customers Find You
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {sourceData.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <ChartContainer config={sourceChartConfig} className="h-[180px] w-[180px] shrink-0">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                        <Pie
                          data={sourceData}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          strokeWidth={2}
                        >
                          {sourceData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="flex flex-wrap gap-3">
                      {sourceData.map((s) => (
                        <div key={s.name} className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: s.fill }}
                          />
                          <span className="text-sm text-muted-foreground">
                            {s.label}{" "}
                            <span className="font-semibold text-foreground">{s.value}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No booking data yet this month
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Upcoming Sessions */}
          <div>
            <Card className="rounded-xl h-full">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-body font-semibold">
                  Upcoming Sessions
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-accent"
                  onClick={() => navigate("/bookings")}
                >
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {upcoming.length > 0 ? (
                  upcoming.map((b) => {
                    const svcName = (b as any).services?.name ?? "Service";
                    const staffName = (b as any).staff?.name ?? "";
                    return (
                      <div
                        key={b.id}
                        className="flex items-start justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{svcName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(b.booking_date), "MMM d")} · {b.booking_time?.slice(0, 5)}
                            {staffName && ` · ${staffName}`}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {b.customer_name} — {b.dog_name}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-foreground shrink-0 ml-2">
                          £{Number(b.total_price).toLocaleString()}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No upcoming sessions
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
