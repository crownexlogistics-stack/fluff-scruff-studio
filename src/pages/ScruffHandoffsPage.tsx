import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInHours } from "date-fns";
import { Clock, User, Phone, MessageSquare, CheckCircle2, X } from "lucide-react";

type Handoff = {
  id: string;
  conversation_id: string;
  customer_name: string | null;
  customer_contact: string | null;
  customer_message: string | null;
  status: string;
  assigned_to: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
};

type ScruffMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  pending: { label: "NEW", color: "bg-red-100 text-red-700 border-red-200", emoji: "🔴" },
  assigned: { label: "ASSIGNED", color: "bg-amber-100 text-amber-700 border-amber-200", emoji: "🟡" },
  resolved: { label: "RESOLVED", color: "bg-green-100 text-green-700 border-green-200", emoji: "🟢" },
};

const RESOLUTION_OPTIONS = [
  "Booked appointment",
  "Answered query",
  "Customer will call back",
];

export default function ScruffHandoffsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedHandoff, setSelectedHandoff] = useState<Handoff | null>(null);
  const [chatViewId, setChatViewId] = useState<string | null>(null);
  const [resolveHandoff, setResolveHandoff] = useState<Handoff | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [customNote, setCustomNote] = useState("");

  const { data: handoffs = [] } = useQuery({
    queryKey: ["scruff-handoffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scruff_handoffs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Handoff[];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["active-groomers-for-handoff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, name, role")
        .eq("is_accepting_bookings", true)
        .in("role", ["groomer", "manager", "director"]);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: chatMessages = [] } = useQuery({
    queryKey: ["scruff-handoff-chat", chatViewId],
    queryFn: async () => {
      if (!chatViewId) return [];
      const { data, error } = await supabase
        .from("scruff_messages")
        .select("*")
        .eq("conversation_id", chatViewId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ScruffMessage[];
    },
    enabled: !!chatViewId,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ handoffId, staffId }: { handoffId: string; staffId: string }) => {
      const { error } = await supabase
        .from("scruff_handoffs")
        .update({ assigned_to: staffId, status: "assigned", assigned_at: new Date().toISOString() })
        .eq("id", handoffId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scruff-handoffs"] });
      toast({ title: "Groomer assigned", description: "The handoff has been assigned." });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ handoffId, notes }: { handoffId: string; notes: string }) => {
      const { error } = await supabase
        .from("scruff_handoffs")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolution_notes: notes })
        .eq("id", handoffId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scruff-handoffs"] });
      setResolveHandoff(null);
      setResolutionNote("");
      setCustomNote("");
      toast({ title: "Handoff resolved ✅" });
    },
  });

  const filtered = handoffs.filter(h => statusFilter === "all" || h.status === statusFilter);

  // Stats
  const pendingCount = handoffs.filter(h => h.status === "pending").length;
  const resolvedToday = handoffs.filter(h => {
    if (h.status !== "resolved" || !h.resolved_at) return false;
    return format(new Date(h.resolved_at), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  }).length;
  const avgResolutionHours = (() => {
    const resolved = handoffs.filter(h => h.resolved_at && h.created_at);
    if (resolved.length === 0) return 0;
    const totalHours = resolved.reduce((s, h) => s + differenceInHours(new Date(h.resolved_at!), new Date(h.created_at)), 0);
    return Math.round(totalHours / resolved.length);
  })();

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">🚨 Scruff Handoffs</h1>
          <p className="text-sm text-muted-foreground">Customer requests needing human follow-up</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{pendingCount}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{resolvedToday}</div>
              <div className="text-xs text-muted-foreground">Resolved Today</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{avgResolutionHours}h</div>
              <div className="text-xs text-muted-foreground">Avg Resolution</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">🔴 Pending</SelectItem>
            <SelectItem value="assigned">🟡 Assigned</SelectItem>
            <SelectItem value="resolved">🟢 Resolved</SelectItem>
          </SelectContent>
        </Select>

        {/* Handoff cards */}
        <div className="space-y-4">
          {filtered.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No handoffs found</CardContent></Card>
          )}
          {filtered.map(h => {
            const cfg = STATUS_CONFIG[h.status] || STATUS_CONFIG.pending;
            const assignedStaff = staff.find(s => s.id === h.assigned_to);
            return (
              <Card key={h.id} className="border-l-4" style={{ borderLeftColor: h.status === "pending" ? "#ef4444" : h.status === "assigned" ? "#f59e0b" : "#22c55e" }}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={cfg.color}>{cfg.emoji} {cfg.label}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(h.created_at), "dd MMM HH:mm")}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {h.customer_name || "Unknown"}
                    </div>
                    {h.customer_contact && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        {h.customer_contact}
                      </div>
                    )}
                    {h.customer_message && (
                      <p className="text-sm bg-muted/50 rounded-lg p-3 italic">"{h.customer_message}"</p>
                    )}
                  </div>
                  {h.resolution_notes && (
                    <p className="text-xs text-green-700 bg-green-50 rounded p-2">✅ {h.resolution_notes}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {h.status !== "resolved" && (
                      <Select
                        value={h.assigned_to || ""}
                        onValueChange={(staffId) => assignMutation.mutate({ handoffId: h.id, staffId })}
                      >
                        <SelectTrigger className="w-48 h-8 text-xs">
                          <SelectValue placeholder="Assign to groomer..." />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setChatViewId(h.conversation_id)}>
                      <MessageSquare className="w-3.5 h-3.5 mr-1" /> View Chat
                    </Button>
                    {h.status !== "resolved" && (
                      <Button size="sm" variant="default" onClick={() => setResolveHandoff(h)}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Resolve
                      </Button>
                    )}
                  </div>
                  {assignedStaff && h.status === "assigned" && (
                    <p className="text-xs text-muted-foreground">Assigned to {assignedStaff.name}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Chat replay dialog */}
        <Dialog open={!!chatViewId} onOpenChange={open => { if (!open) setChatViewId(null); }}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>🐶 Full Conversation</DialogTitle>
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
            </div>
          </DialogContent>
        </Dialog>

        {/* Resolve dialog */}
        <Dialog open={!!resolveHandoff} onOpenChange={open => { if (!open) setResolveHandoff(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>How was this resolved?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {RESOLUTION_OPTIONS.map(opt => (
                <Button
                  key={opt}
                  variant={resolutionNote === opt ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => { setResolutionNote(opt); setCustomNote(""); }}
                >
                  {opt}
                </Button>
              ))}
              <Textarea
                placeholder="Other — describe resolution..."
                value={customNote}
                onChange={e => { setCustomNote(e.target.value); setResolutionNote(""); }}
              />
              <Button
                className="w-full"
                disabled={!resolutionNote && !customNote}
                onClick={() => {
                  if (resolveHandoff) {
                    resolveMutation.mutate({
                      handoffId: resolveHandoff.id,
                      notes: resolutionNote || customNote,
                    });
                  }
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Resolved
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
