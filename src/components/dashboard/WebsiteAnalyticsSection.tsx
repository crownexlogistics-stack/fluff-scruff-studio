import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  Globe,
  Users,
  Eye,
  Clock,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  RefreshCw,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// London boroughs/areas list
const LONDON_AREAS = new Set([
  "Romford", "Hornchurch", "Upminster", "Barking", "Dagenham", "Ilford",
  "Stratford", "Hackney", "Islington", "Camden", "Westminster", "Southwark",
  "Lewisham", "Greenwich", "Woolwich", "Bromley", "Croydon", "Sutton",
  "Merton", "Wimbledon", "Kingston", "Richmond", "Hounslow", "Ealing",
  "Acton", "Hammersmith", "Fulham", "Chelsea", "Kensington", "Paddington",
  "Brent", "Harrow", "Wembley", "Barnet", "Enfield", "Haringey",
  "Tottenham", "Walthamstow", "Leyton", "Newham", "Canning Town",
  "Forest Gate", "Manor Park", "Plaistow", "East Ham", "West Ham",
  "Havering", "Redbridge", "Tower Hamlets", "Bethnal Green", "Bow",
  "Stepney", "Poplar", "Canary Wharf", "Bermondsey", "Peckham",
  "Deptford", "Catford", "Eltham", "Bexley", "Sidcup", "Erith",
  "Thamesmead", "Rainham",
]);

const DISTANCE_MAP: Record<string, number> = {
  "Hornchurch": 0, "Upminster": 2, "Romford": 3, "Havering": 3,
  "Rainham": 4, "Dagenham": 5, "Barking": 7, "Ilford": 8,
  "Redbridge": 9, "East Ham": 9, "Forest Gate": 9, "Newham": 10,
  "Stratford": 11, "Walthamstow": 10, "Leyton": 11, "Manor Park": 9,
  "Plaistow": 10, "West Ham": 10, "Canning Town": 11,
  "Bexley": 7, "Sidcup": 9, "Erith": 8, "Thamesmead": 10,
  "Greenwich": 13, "Woolwich": 11, "Eltham": 11, "Lewisham": 14,
  "Bromley": 13, "Catford": 14, "Deptford": 15, "Bermondsey": 15,
  "Southwark": 16, "Peckham": 15, "Tower Hamlets": 14,
  "Bethnal Green": 14, "Bow": 12, "Stepney": 14, "Poplar": 13,
  "Canary Wharf": 13, "Hackney": 13, "Islington": 15, "Camden": 17,
  "Westminster": 17, "Kensington": 18, "Chelsea": 19, "Paddington": 17,
  "Hammersmith": 19, "Fulham": 19, "Acton": 19, "Ealing": 19,
  "Brent": 17, "Wembley": 18, "Harrow": 19, "Barnet": 16,
  "Enfield": 14, "Haringey": 14, "Tottenham": 14,
  "Hounslow": 22, "Richmond": 22, "Kingston": 23, "Wimbledon": 21,
  "Merton": 21, "Sutton": 20, "Croydon": 18,
};

function isLondonArea(city: string): boolean {
  if (LONDON_AREAS.has(city)) return true;
  if (city.toLowerCase().includes("london")) return true;
  return false;
}

function getDistance(city: string): number {
  return DISTANCE_MAP[city] ?? 15;
}

function getDistanceColor(miles: number): string {
  if (miles <= 5) return "text-green-600";
  if (miles <= 10) return "text-amber-500";
  return "text-destructive";
}

function getDistanceDot(miles: number): string {
  if (miles <= 5) return "bg-green-500";
  if (miles <= 10) return "bg-amber-500";
  return "bg-destructive";
}

type AnalyticsPeriod = "today" | "yesterday" | "this_month" | "last_month" | "this_year";

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_month: "This Month",
  last_month: "Last Month",
  this_year: "This Year",
};

function getDateRange(period: AnalyticsPeriod): { startDate: string; endDate: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  switch (period) {
    case "today":
      return { startDate: fmt(now), endDate: fmt(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { startDate: fmt(y), endDate: fmt(y) };
    }
    case "this_month":
      return { startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, endDate: fmt(now) };
    case "last_month": {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: fmt(lm), endDate: fmt(lmEnd) };
    }
    case "this_year":
      return { startDate: `${now.getFullYear()}-01-01`, endDate: fmt(now) };
  }
}

// Page name mapping
const PAGE_NAMES: Record<string, string> = {
  "/": "Home",
  "/book": "Book Now",
  "/services": "Services",
  "/my-account": "My Account",
  "/terms": "Terms & Conditions",
  "/auth": "Login / Register",
  "/admin": "Admin Dashboard",
  "/welcome": "Welcome",
};

// Traffic source colors
const SOURCE_COLORS: Record<string, string> = {
  "Direct": "hsl(var(--primary))",
  "Organic Search": "hsl(217, 91%, 60%)",
  "Organic Social": "hsl(330, 80%, 55%)",
  "Paid Search": "hsl(145, 60%, 40%)",
  "Referral": "hsl(35, 90%, 55%)",
  "Email": "hsl(260, 60%, 55%)",
};

function getSourceColor(name: string): string {
  return SOURCE_COLORS[name] || "hsl(220, 10%, 55%)";
}

const DEVICE_COLORS: Record<string, string> = {
  "Mobile": "hsl(var(--primary))",
  "Desktop": "hsl(217, 91%, 60%)",
  "Tablet": "hsl(145, 60%, 40%)",
};

interface AnalyticsData {
  summary: {
    totalVisitors: number;
    uniqueVisitors: number;
    pageViews: number;
    avgSessionDuration: string;
  };
  dailyUsers: { date: string; users: number; pageViews: number }[];
  trafficSources: { name: string; value: number }[];
  devices: { name: string; value: number; count: number }[];
  locations: { city: string; country: string; visitors: number }[];
  topPages: { page: string; views: number }[];
}

const trendConfig: ChartConfig = {
  users: { label: "Visitors", color: "hsl(var(--primary))" },
};

const deviceConfig: ChartConfig = {
  value: { label: "Percentage", color: "hsl(var(--primary))" },
};

const DeviceIcon = ({ type }: { type: string }) => {
  const t = type.toLowerCase();
  if (t === "mobile") return <Smartphone className="h-4 w-4" />;
  if (t === "desktop") return <Monitor className="h-4 w-4" />;
  if (t === "tablet") return <Tablet className="h-4 w-4" />;
  return null;
};

function formatDate(dateStr: string, period: AnalyticsPeriod): string {
  // dateStr is YYYYMMDD from GA
  if (dateStr.length === 8) {
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    if (period === "this_year") {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return months[parseInt(m, 10) - 1] || m;
    }
    return `${d}/${m}`;
  }
  return dateStr;
}

export function WebsiteAnalyticsSection() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("this_month");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConfigError(null);
    try {
      const { startDate, endDate } = getDateRange(period);
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "get-analytics-data",
        { body: { startDate, endDate } }
      );
      if (fnError) throw new Error(fnError.message);
      if (result?.error) {
        if (result.error.includes("GA_NUMERIC_PROPERTY_ID")) {
          setConfigError(result.hint || result.error);
          setData(null);
        } else {
          throw new Error(result.error);
        }
      } else {
        setData(result);
      }
    } catch (err: any) {
      console.error("Analytics fetch error:", err);
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build chart-ready data
  const chartData = useMemo(() => {
    if (!data) return null;

    const visitorTrend = data.dailyUsers.map((d) => ({
      label: formatDate(d.date, period),
      users: d.users,
    }));

    const trafficSources = data.trafficSources.map((s) => ({
      ...s,
      fill: getSourceColor(s.name),
    }));

    const sourceConfig: ChartConfig = Object.fromEntries(
      trafficSources.map((s) => [s.name, { label: s.name, color: s.fill }])
    );

    const devices = data.devices.map((d) => ({
      ...d,
      icon: d.name.toLowerCase(),
      fill: DEVICE_COLORS[d.name] || "hsl(220, 10%, 55%)",
    }));

    const topPages = data.topPages.map((p) => ({
      ...p,
      name: PAGE_NAMES[p.page] || p.page,
    }));

    return { visitorTrend, trafficSources, sourceConfig, devices, topPages };
  }, [data, period]);

  // Location analysis
  const locationData = useMemo(() => {
    if (!data?.locations) return null;
    const londonLocs = data.locations.filter((l) => isLondonArea(l.city));
    const nonLondonLocs = data.locations.filter((l) => !isLondonArea(l.city));
    const totalLondon = londonLocs.reduce((s, l) => s + l.visitors, 0);
    const totalAll = data.locations.reduce((s, l) => s + l.visitors, 0);

    const within5 = londonLocs.filter((l) => getDistance(l.city) <= 5).reduce((s, l) => s + l.visitors, 0);
    const within10 = londonLocs.filter((l) => { const d = getDistance(l.city); return d > 5 && d <= 10; }).reduce((s, l) => s + l.visitors, 0);
    const outside10 = londonLocs.filter((l) => getDistance(l.city) > 10).reduce((s, l) => s + l.visitors, 0) + nonLondonLocs.reduce((s, l) => s + l.visitors, 0);
    const catchmentPct = totalAll > 0 ? Math.round(((within5 + within10) / totalAll) * 100) : 0;

    return { londonLocs, nonLondonLocs, totalLondon, within5, within10, outside10, catchmentPct };
  }, [data]);

  return (
    <Card className="rounded-xl">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Website Analytics</CardTitle>
            <Badge variant="outline" className="text-[10px] px-1.5">GA4 Live</Badge>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(Object.entries(PERIOD_LABELS) as [AnalyticsPeriod, string][]).map(([key, label]) => (
              <Button
                key={key}
                variant={period === key ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-3"
                onClick={() => setPeriod(key)}
                disabled={loading}
              >
                {label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-6">
        {/* Config error — missing property ID */}
        {configError && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-5 text-center space-y-2">
            <Settings className="h-8 w-8 mx-auto text-amber-500" />
            <p className="font-semibold text-sm">⚙️ Almost there</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Add your numeric GA Property ID as a backend secret named <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">GA_NUMERIC_PROPERTY_ID</code> to see live data.
              <br />Find it in Google Analytics → Admin → Property Settings.
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !configError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-sm font-medium text-destructive">Failed to load analytics</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        )}

        {/* Loading state */}
        {loading && !data && !error && !configError && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Skeleton className="h-[280px] rounded-xl" />
              <Skeleton className="h-[280px] rounded-xl" />
            </div>
          </div>
        )}

        {/* Data loaded */}
        {data && chartData && !configError && (
          <>
            {/* Row 1 — Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <Users className="h-5 w-5 mx-auto mb-1.5 text-primary" />
                <p className="text-2xl font-bold font-heading">{data.summary.totalVisitors.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Visitors</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <Users className="h-5 w-5 mx-auto mb-1.5 text-blue-500" />
                <p className="text-2xl font-bold font-heading">{data.summary.uniqueVisitors.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">New Visitors</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <Eye className="h-5 w-5 mx-auto mb-1.5 text-green-600" />
                <p className="text-2xl font-bold font-heading">{data.summary.pageViews.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Page Views</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <Clock className="h-5 w-5 mx-auto mb-1.5 text-amber-500" />
                <p className="text-2xl font-bold font-heading">{data.summary.avgSessionDuration}</p>
                <p className="text-xs text-muted-foreground">Avg Session Duration</p>
              </div>
            </div>

            {/* Row 2 — Visitors Trend + Traffic Sources */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/50 p-4">
                <h4 className="text-sm font-semibold mb-3">Visitors Over Time</h4>
                {chartData.visitorTrend.length > 0 ? (
                  <ChartContainer config={trendConfig} className="h-[250px] w-full">
                    <LineChart data={chartData.visitorTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-xs" />
                      <YAxis tick={{ fontSize: 10 }} className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-16">No data for this period</p>
                )}
              </div>
              <div className="rounded-xl border border-border/50 p-4">
                <h4 className="text-sm font-semibold mb-3">Traffic Sources</h4>
                {chartData.trafficSources.length > 0 ? (
                  <div className="flex flex-col items-center gap-4">
                    <ChartContainer config={chartData.sourceConfig} className="h-[180px] w-[180px]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                        <Pie data={chartData.trafficSources} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} strokeWidth={2}>
                          {chartData.trafficSources.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="flex flex-wrap gap-3 justify-center">
                      {chartData.trafficSources.map((s) => (
                        <div key={s.name} className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                          <span className="text-xs text-muted-foreground">{s.name} <strong className="text-foreground">{s.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-16">No data for this period</p>
                )}
              </div>
            </div>

            {/* Row 3 — Devices + Top Pages */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/50 p-4">
                <h4 className="text-sm font-semibold mb-3">Device Breakdown</h4>
                {chartData.devices.length > 0 ? (
                  <>
                    <ChartContainer config={deviceConfig} className="h-[250px] w-full">
                      <BarChart data={chartData.devices} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                          {chartData.devices.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                    <div className="flex gap-4 mt-2 justify-center">
                      {chartData.devices.map((d) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <DeviceIcon type={d.icon} />
                          <span>{d.name} <strong className="text-foreground">{d.value}%</strong></span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-16">No data for this period</p>
                )}
              </div>
              <div className="rounded-xl border border-border/50 p-4">
                <h4 className="text-sm font-semibold mb-3">Top Pages Visited</h4>
                {chartData.topPages.length > 0 ? (
                  <div className="space-y-2">
                    {chartData.topPages.map((p, i) => (
                      <div key={p.page} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.page}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">{p.views} views</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-16">No data for this period</p>
                )}
              </div>
            </div>

            {/* Row 4 — Catchment + Locations */}
            {locationData && data.locations.length > 0 && (
              <>
                <div className="rounded-xl border border-border/50 p-5 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">Local Catchment Analysis</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="text-center p-3 rounded-lg bg-background">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-xs text-muted-foreground">Within 5 miles</span>
                      </div>
                      <p className="text-lg font-bold font-heading">{locationData.within5}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-xs text-muted-foreground">5–10 miles</span>
                      </div>
                      <p className="text-lg font-bold font-heading">{locationData.within10}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <div className="h-2 w-2 rounded-full bg-destructive" />
                        <span className="text-xs text-muted-foreground">Outside 10 miles</span>
                      </div>
                      <p className="text-lg font-bold font-heading">{locationData.outside10}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className={cn(
                      "text-sm font-semibold",
                      locationData.catchmentPct >= 70 ? "text-green-600" : locationData.catchmentPct >= 50 ? "text-amber-500" : "text-destructive"
                    )}>
                      {locationData.catchmentPct}% of visitors are in your target catchment area 🎯
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {locationData.catchmentPct >= 70 ? "Great local reach" : locationData.catchmentPct >= 50 ? "Good but improvable — consider local SEO" : "Consider investing in local SEO"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 p-4">
                  <h4 className="text-sm font-semibold mb-3">Visitor Locations</h4>
                  {locationData.londonLocs.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 mb-1">
                        <span className="text-sm">🇬🇧</span>
                        <span className="text-sm font-semibold">London area</span>
                        <span className="text-xs text-muted-foreground ml-auto">{locationData.totalLondon} visitors total</span>
                      </div>
                      <div className="ml-4 border-l-2 border-border/50 pl-3 space-y-0.5">
                        {locationData.londonLocs
                          .sort((a, b) => b.visitors - a.visitors)
                          .map((loc, i) => {
                            const dist = getDistance(loc.city);
                            const isLast = i === locationData.londonLocs.length - 1;
                            return (
                              <div key={loc.city} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">{isLast ? "└" : "├"}</span>
                                  <div className={cn("h-2 w-2 rounded-full shrink-0", getDistanceDot(dist))} />
                                  <span className="font-medium">{loc.city}</span>
                                  <span className={cn("text-xs", getDistanceColor(dist))}>
                                    {dist === 0 ? "🏠 your area" : `${dist} mi`}
                                  </span>
                                </div>
                                <span className="font-semibold text-sm">{loc.visitors}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                  {locationData.nonLondonLocs.length > 0 && (
                    <div className="space-y-0.5">
                      {locationData.nonLondonLocs
                        .sort((a, b) => b.visitors - a.visitors)
                        .map((loc) => (
                          <div key={loc.city} className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-muted/30 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{loc.country === "United Kingdom" ? "🇬🇧" : loc.country === "United States" ? "🇺🇸" : loc.country === "Ireland" ? "🇮🇪" : "🌍"}</span>
                              <span className="font-medium">{loc.city}</span>
                            </div>
                            <span className="font-semibold">{loc.visitors}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {data.locations.length === 0 && (
              <div className="rounded-xl border border-border/50 p-4">
                <h4 className="text-sm font-semibold mb-3">Visitor Locations</h4>
                <p className="text-sm text-muted-foreground text-center py-8">No location data for this period</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
