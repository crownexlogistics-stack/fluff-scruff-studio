import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ExternalLink,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

// Approximate distance from Hornchurch RM11 2DL
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

// Mock data generator — replace with real GA Data API when connected
function getMockData(period: AnalyticsPeriod) {
  const multiplier = period === "today" ? 1 : period === "yesterday" ? 1.1 : period === "this_month" ? 30 : period === "last_month" ? 28 : 365;
  const base = Math.round(12 * multiplier);

  const metrics = {
    totalVisitors: base + Math.round(Math.random() * base * 0.2),
    uniqueVisitors: Math.round(base * 0.72),
    pageViews: Math.round(base * 2.8),
    avgSessionDuration: "2m 34s",
  };

  const visitorTrend = period === "today" || period === "yesterday"
    ? Array.from({ length: 12 }, (_, i) => ({
        label: `${(i * 2).toString().padStart(2, "0")}:00`,
        visitors: Math.round(Math.random() * 8 + 2),
      }))
    : Array.from({ length: period === "this_year" ? 12 : 14 }, (_, i) => ({
        label: period === "this_year"
          ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i]
          : `Day ${i + 1}`,
        visitors: Math.round(Math.random() * 25 + 5),
      }));

  const trafficSources = [
    { name: "Direct", value: Math.round(base * 0.35), fill: "hsl(var(--primary))" },
    { name: "Google", value: Math.round(base * 0.28), fill: "hsl(217, 91%, 60%)" },
    { name: "Instagram", value: Math.round(base * 0.22), fill: "hsl(330, 80%, 55%)" },
    { name: "Facebook", value: Math.round(base * 0.1), fill: "hsl(221, 44%, 41%)" },
    { name: "Other", value: Math.round(base * 0.05), fill: "hsl(220, 10%, 55%)" },
  ];

  const devices = [
    { name: "Mobile", value: 64, icon: "smartphone", fill: "hsl(var(--primary))" },
    { name: "Desktop", value: 28, icon: "monitor", fill: "hsl(217, 91%, 60%)" },
    { name: "Tablet", value: 8, icon: "tablet", fill: "hsl(145, 60%, 40%)" },
  ];

  const topPages = [
    { page: "/", name: "Home", views: Math.round(base * 1.2) },
    { page: "/book", name: "Book Now", views: Math.round(base * 0.8) },
    { page: "/services", name: "Services", views: Math.round(base * 0.5) },
    { page: "/my-account", name: "My Account", views: Math.round(base * 0.3) },
    { page: "/terms", name: "Terms & Conditions", views: Math.round(base * 0.15) },
  ];

  const locations = [
    { country: "United Kingdom", city: "Romford", visitors: Math.round(base * 0.18) },
    { country: "United Kingdom", city: "Hornchurch", visitors: Math.round(base * 0.15) },
    { country: "United Kingdom", city: "Upminster", visitors: Math.round(base * 0.1) },
    { country: "United Kingdom", city: "Dagenham", visitors: Math.round(base * 0.08) },
    { country: "United Kingdom", city: "Barking", visitors: Math.round(base * 0.06) },
    { country: "United Kingdom", city: "Ilford", visitors: Math.round(base * 0.05) },
    { country: "United Kingdom", city: "Havering", visitors: Math.round(base * 0.04) },
    { country: "United Kingdom", city: "Rainham", visitors: Math.round(base * 0.03) },
    { country: "United Kingdom", city: "Redbridge", visitors: Math.round(base * 0.03) },
    { country: "United Kingdom", city: "East Ham", visitors: Math.round(base * 0.02) },
    { country: "United Kingdom", city: "Stratford", visitors: Math.round(base * 0.02) },
    { country: "United Kingdom", city: "Newham", visitors: Math.round(base * 0.015) },
    { country: "United Kingdom", city: "Walthamstow", visitors: Math.round(base * 0.01) },
    { country: "United Kingdom", city: "Manchester", visitors: Math.round(base * 0.04) },
    { country: "United Kingdom", city: "Birmingham", visitors: Math.round(base * 0.03) },
    { country: "United Kingdom", city: "Leeds", visitors: Math.round(base * 0.02) },
    { country: "United States", city: "New York", visitors: Math.round(base * 0.01) },
    { country: "Ireland", city: "Dublin", visitors: Math.round(base * 0.008) },
  ];

  return { metrics, visitorTrend, trafficSources, devices, topPages, locations };
}

const trendConfig: ChartConfig = {
  visitors: { label: "Visitors", color: "hsl(var(--primary))" },
};

const sourceConfig: ChartConfig = {
  Direct: { label: "Direct", color: "hsl(var(--primary))" },
  Google: { label: "Google", color: "hsl(217, 91%, 60%)" },
  Instagram: { label: "Instagram", color: "hsl(330, 80%, 55%)" },
  Facebook: { label: "Facebook", color: "hsl(221, 44%, 41%)" },
  Other: { label: "Other", color: "hsl(220, 10%, 55%)" },
};

const deviceConfig: ChartConfig = {
  value: { label: "Percentage", color: "hsl(var(--primary))" },
};

const DeviceIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "smartphone": return <Smartphone className="h-4 w-4" />;
    case "monitor": return <Monitor className="h-4 w-4" />;
    case "tablet": return <Tablet className="h-4 w-4" />;
    default: return null;
  }
};

export function WebsiteAnalyticsSection() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("this_month");
  const data = useMemo(() => getMockData(period), [period]);

  return (
    <Card className="rounded-xl">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Website Analytics</CardTitle>
            <Badge variant="outline" className="text-[10px] px-1.5">GA4</Badge>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(Object.entries(PERIOD_LABELS) as [AnalyticsPeriod, string][]).map(([key, label]) => (
              <Button
                key={key}
                variant={period === key ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-3"
                onClick={() => setPeriod(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-6">
        {/* Row 1 — Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-muted/50 text-center">
            <Users className="h-5 w-5 mx-auto mb-1.5 text-primary" />
            <p className="text-2xl font-bold font-heading">{data.metrics.totalVisitors.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Visitors</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/50 text-center">
            <Users className="h-5 w-5 mx-auto mb-1.5 text-blue-500" />
            <p className="text-2xl font-bold font-heading">{data.metrics.uniqueVisitors.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Unique Visitors</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/50 text-center">
            <Eye className="h-5 w-5 mx-auto mb-1.5 text-green-600" />
            <p className="text-2xl font-bold font-heading">{data.metrics.pageViews.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Page Views</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/50 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1.5 text-amber-500" />
            <p className="text-2xl font-bold font-heading">{data.metrics.avgSessionDuration}</p>
            <p className="text-xs text-muted-foreground">Avg Session Duration</p>
          </div>
        </div>

        {/* Row 2 — Visitors Trend + Traffic Sources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/50 p-4">
            <h4 className="text-sm font-semibold mb-3">Visitors Over Time</h4>
            <ChartContainer config={trendConfig} className="h-[250px] w-full">
              <LineChart data={data.visitorTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-xs" />
                <YAxis tick={{ fontSize: 10 }} className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="visitors" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ChartContainer>
          </div>
          <div className="rounded-xl border border-border/50 p-4">
            <h4 className="text-sm font-semibold mb-3">Traffic Sources</h4>
            <div className="flex flex-col items-center gap-4">
              <ChartContainer config={sourceConfig} className="h-[180px] w-[180px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie data={data.trafficSources} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} strokeWidth={2}>
                    {data.trafficSources.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="flex flex-wrap gap-3 justify-center">
                {data.trafficSources.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                    <span className="text-xs text-muted-foreground">{s.name} <strong className="text-foreground">{s.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 3 — Devices + Top Pages */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/50 p-4">
            <h4 className="text-sm font-semibold mb-3">Device Breakdown</h4>
            <ChartContainer config={deviceConfig} className="h-[250px] w-full">
              <BarChart data={data.devices} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                  {data.devices.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <div className="flex gap-4 mt-2 justify-center">
              {data.devices.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <DeviceIcon type={d.icon} />
                  <span>{d.name} <strong className="text-foreground">{d.value}%</strong></span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border/50 p-4">
            <h4 className="text-sm font-semibold mb-3">Top Pages Visited</h4>
            <div className="space-y-2">
              {data.topPages.map((p, i) => (
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
          </div>
        </div>

        {/* Row 4 — Catchment Summary + Visitor Locations */}
        {(() => {
          const londonLocs = data.locations.filter(l => isLondonArea(l.city));
          const nonLondonLocs = data.locations.filter(l => !isLondonArea(l.city));
          const totalLondon = londonLocs.reduce((s, l) => s + l.visitors, 0);
          const totalAll = data.locations.reduce((s, l) => s + l.visitors, 0);

          const within5 = londonLocs.filter(l => getDistance(l.city) <= 5).reduce((s, l) => s + l.visitors, 0);
          const within10 = londonLocs.filter(l => { const d = getDistance(l.city); return d > 5 && d <= 10; }).reduce((s, l) => s + l.visitors, 0);
          const outside10 = londonLocs.filter(l => getDistance(l.city) > 10).reduce((s, l) => s + l.visitors, 0) + nonLondonLocs.reduce((s, l) => s + l.visitors, 0);
          const catchmentPct = totalAll > 0 ? Math.round(((within5 + within10) / totalAll) * 100) : 0;

          return (
            <>
              {/* Catchment Summary Card */}
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
                    <p className="text-lg font-bold font-heading">{within5}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-xs text-muted-foreground">5–10 miles</span>
                    </div>
                    <p className="text-lg font-bold font-heading">{within10}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <div className="h-2 w-2 rounded-full bg-destructive" />
                      <span className="text-xs text-muted-foreground">Outside 10 miles</span>
                    </div>
                    <p className="text-lg font-bold font-heading">{outside10}</p>
                  </div>
                </div>
                <div className="text-center">
                  <span className={cn(
                    "text-sm font-semibold",
                    catchmentPct >= 70 ? "text-green-600" : catchmentPct >= 50 ? "text-amber-500" : "text-destructive"
                  )}>
                    {catchmentPct}% of visitors are in your target catchment area 🎯
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {catchmentPct >= 70 ? "Great local reach" : catchmentPct >= 50 ? "Good but improvable — consider local SEO" : "Consider investing in local SEO"}
                  </p>
                </div>
              </div>

              {/* Visitor Locations */}
              <div className="rounded-xl border border-border/50 p-4">
                <h4 className="text-sm font-semibold mb-3">Visitor Locations</h4>

                {/* London area section */}
                {londonLocs.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 mb-1">
                      <span className="text-sm">🇬🇧</span>
                      <span className="text-sm font-semibold">London area</span>
                      <span className="text-xs text-muted-foreground ml-auto">{totalLondon} visitors total</span>
                    </div>
                    <div className="ml-4 border-l-2 border-border/50 pl-3 space-y-0.5">
                      {londonLocs
                        .sort((a, b) => b.visitors - a.visitors)
                        .map((loc, i) => {
                          const dist = getDistance(loc.city);
                          const isLast = i === londonLocs.length - 1;
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

                {/* Non-London locations */}
                {nonLondonLocs.length > 0 && (
                  <div className="space-y-0.5">
                    {nonLondonLocs
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
          );
        })()}

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Data shown is sample data. Connect Google Analytics Data API for live metrics.
        </p>
      </CardContent>
    </Card>
  );
}
