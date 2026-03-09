import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Users, AlertTriangle, BarChart3, Search, Monitor, Smartphone, X } from "lucide-react";
import { format, subDays, subHours, differenceInMinutes } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

type Conversation = {
  id: string;
  session_id: string;
  customer_name: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  was_escalated: boolean;
  device_type: string | null;
  page_started_from: string | null;
};

type ScruffMessage = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
  response_time_ms: number | null;
};

export default function ScruffConversationsPage() {
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("week");
  const [search, setSearch] = useState("");
  const [escalatedFilter, setEscalatedFilter] = useState<"all" | "yes" | "no">("all");
  const [deviceFilter, setDeviceFilter] = useState<"all" | "mobile" | "desktop">("all");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  const periodStart = period === "today" ? subDays(new Date(), 1).toISOString()
    : period === "week" ? subDays(new Date(), 7).toISOString()
    : period === "month" ? subDays(new Date(), 30).toISOString()
    : "2000-01-01T00:00:00Z";

  const { data: conversations = [] } = useQuery({
    queryKey: ["scruff-conversations", period],
    queryFn: async () => {
      const q = supabase
        .from("scruff_conversations")
        .select("*")
        .gte("started_at", periodStart)
        .order("started_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Conversation[];
    },
  });

  const { data: chatMessages = [] } = useQuery({
    queryKey: ["scruff-chat-messages", selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return [];
      const { data, error } = await supabase
        .from("scruff_messages")
        .select("*")
        .eq("conversation_id", selectedConvId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ScruffMessage[];
    },
    enabled: !!selectedConvId,
  });

  // Metrics
  const totalConversations = conversations.length;
  const activeNow = conversations.filter(c => {
    const started = new Date(c.started_at);
    return differenceInMinutes(new Date(), started) <= 30 && !c.ended_at;
  }).length;
  const escalatedCount = conversations.filter(c => c.was_escalated).length;
  const escalationRate = totalConversations > 0 ? (escalatedCount / totalConversations * 100) : 0;
  const avgMessages = totalConversations > 0
    ? Math.round(conversations.reduce((s, c) => s + c.message_count, 0) / totalConversations)
    : 0;

  // Filtered list
  const filtered = conversations.filter(c => {
    if (search && !(c.customer_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (escalatedFilter === "yes" && !c.was_escalated) return false;
    if (escalatedFilter === "no" && c.was_escalated) return false;
    if (deviceFilter !== "all" && c.device_type !== deviceFilter) return false;
    return true;
  });

  // Analytics: daily conversation count (last 30 days)
  const dailyData = (() => {
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM dd");
      days[d] = 0;
    }
    conversations.forEach(c => {
      const d = format(new Date(c.started_at), "MMM dd");
      if (days[d] !== undefined) days[d]++;
    });
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  })();

  // Device split
  const mobileCount = conversations.filter(c => c.device_type === "mobile").length;
  const desktopCount = conversations.filter(c => c.device_type === "desktop").length;
  const deviceData = [
    { name: "Mobile", value: mobileCount },
    { name: "Desktop", value: desktopCount },
  ];
  const DEVICE_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))"];

  // Busiest hours
  const hourData = (() => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;
    conversations.forEach(c => {
      const h = new Date(c.started_at).getHours();
      hours[h]++;
    });
    return Object.entries(hours)
      .filter(([h]) => parseInt(h) >= 8 && parseInt(h) <= 22)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }));
  })();

  const escalationColor = escalationRate < 10 ? "text-green-600" : escalationRate < 20 ? "text-amber-500" : "text-red-500";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">🤖 Scruff Conversations</h1>
            <p className="text-sm text-muted-foreground">Monitor all AI chat interactions</p>
          </div>
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <MessageSquare className="w-4 h-4" /> Total Conversations
              </div>
              <div className="text-2xl font-bold">{totalConversations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="w-4 h-4" /> Active Now
              </div>
              <div className="text-2xl font-bold text-green-600">{activeNow}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <AlertTriangle className="w-4 h-4" /> Escalation Rate
              </div>
              <div className={`text-2xl font-bold ${escalationColor}`}>{escalationRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <BarChart3 className="w-4 h-4" /> Avg Messages
              </div>
              <div className="text-2xl font-bold">{avgMessages}</div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Daily Conversations (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Device Split</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={deviceData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={30}>
                      {deviceData.map((_, i) => (
                        <Cell key={i} fill={DEVICE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-xs space-y-1 ml-2">
                  <div className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> {mobileCount} mobile</div>
                  <div className="flex items-center gap-1"><Monitor className="w-3 h-3" /> {desktopCount} desktop</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Busiest Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={hourData}>
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    <XAxis dataKey="hour" tick={{ fontSize: 8 }} interval={2} />
                    <Tooltip />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={escalatedFilter} onValueChange={(v: any) => setEscalatedFilter(v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Escalated" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Escalated only</SelectItem>
              <SelectItem value="no">Not escalated</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deviceFilter} onValueChange={(v: any) => setDeviceFilter(v)}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Device" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All devices</SelectItem>
              <SelectItem value="mobile">📱 Mobile</SelectItem>
              <SelectItem value="desktop">💻 Desktop</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conversations table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Time</th>
                    <th className="text-left p-3 font-medium">Customer</th>
                    <th className="text-center p-3 font-medium">Messages</th>
                    <th className="text-center p-3 font-medium">Device</th>
                    <th className="text-center p-3 font-medium">Escalated</th>
                    <th className="text-center p-3 font-medium">Duration</th>
                    <th className="text-right p-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted-foreground p-8">No conversations found</td></tr>
                  )}
                  {filtered.map(c => {
                    const duration = c.ended_at
                      ? `${differenceInMinutes(new Date(c.ended_at), new Date(c.started_at))}m`
                      : "ongoing";
                    return (
                      <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 whitespace-nowrap">{format(new Date(c.started_at), "dd MMM HH:mm")}</td>
                        <td className="p-3">{c.customer_name || "Anonymous"}</td>
                        <td className="p-3 text-center">{c.message_count}</td>
                        <td className="p-3 text-center">{c.device_type === "mobile" ? "📱" : "💻"}</td>
                        <td className="p-3 text-center">{c.was_escalated ? "🚨" : "✅"}</td>
                        <td className="p-3 text-center">{duration}</td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedConvId(c.id)}>
                            View Chat
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Chat replay dialog */}
        <Dialog open={!!selectedConvId} onOpenChange={open => { if (!open) setSelectedConvId(null); }}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                🐶 Chat Replay
                <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setSelectedConvId(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-3 p-4" style={{ background: "#FFFAF4", borderRadius: 12 }}>
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-sm shrink-0 mr-2 shadow-sm">🐶</div>
                  )}
                  <div
                    className="max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed"
                    style={msg.role === "user"
                      ? { background: "#FF6B35", color: "#fff", borderRadius: "18px 18px 4px 18px" }
                      : { background: "#fff", color: "#2D1B0E", borderRadius: "18px 18px 18px 4px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }
                    }
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatMessages.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">No messages found</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
