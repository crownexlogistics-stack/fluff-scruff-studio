import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Phone, PhoneCall, PhoneForwarded, PauseCircle, CheckCircle2, AlertTriangle,
  Plus, Pencil, Trash2, BookOpen, Calendar, Clock, Mail, Search, Eye,
  Copy, FileText,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CATEGORIES = ["Location", "Pricing", "Services", "Policies", "Other"] as const;
const TWILIO_NUMBER = "+44 7446 976077";

const OUTCOME_STYLE: Record<string, string> = {
  booking_made: "bg-green-100 text-green-800 border-green-200",
  reschedule: "bg-blue-100 text-blue-800 border-blue-200",
  cancellation: "bg-rose-100 text-rose-800 border-rose-200",
  enquiry: "bg-amber-100 text-amber-800 border-amber-200",
  transferred: "bg-blue-100 text-blue-800 border-blue-200",
  voicemail: "bg-purple-100 text-purple-800 border-purple-200",
  abandoned: "bg-gray-200 text-gray-700 border-gray-300",
};

export default function AIReceptionistPage() {
  const { user } = useAuth();
  const { role } = useUserRole(user?.id);
  const isDirector = role === "director";
  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8 space-y-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <Phone className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-heading text-3xl">AI Receptionist</h1>
            <p className="text-muted-foreground text-sm">
              Control panel for the phone AI that answers calls to the salon
            </p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className={`grid ${isDirector ? "grid-cols-5" : "grid-cols-4"} w-full md:w-auto`}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="hours">Opening Hours</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
            <TabsTrigger value="logs">Call Logs</TabsTrigger>
            {isDirector && <TabsTrigger value="prompt">System Prompt</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="hours" className="space-y-4 mt-6">
            <HoursTab />
          </TabsContent>
          <TabsContent value="knowledge" className="space-y-6 mt-6">
            <KnowledgeTab />
          </TabsContent>
          <TabsContent value="logs" className="mt-6">
            <CallLogsTab />
          </TabsContent>
          {isDirector && (
            <TabsContent value="prompt" className="space-y-4 mt-6">
              <SystemPromptTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ─── OVERVIEW ─────────────────────────────────────────────────

function OverviewTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["ai-receptionist-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_receptionist_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["ai-receptionist-stats"],
    queryFn: async () => {
      const now = new Date();
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [today, week, bookings, transfers] = await Promise.all([
        supabase.from("ai_call_logs").select("*", { count: "exact", head: true }).gte("started_at", startOfDay.toISOString()),
        supabase.from("ai_call_logs").select("*", { count: "exact", head: true }).gte("started_at", startOfWeek.toISOString()),
        supabase.from("ai_call_logs").select("*", { count: "exact", head: true }).eq("outcome", "booking_made").gte("started_at", startOfMonth.toISOString()),
        supabase.from("ai_call_logs").select("*", { count: "exact", head: true }).eq("outcome", "transferred").gte("started_at", startOfMonth.toISOString()),
      ]);

      return {
        today: today.count ?? 0,
        week: week.count ?? 0,
        bookings: bookings.count ?? 0,
        transfers: transfers.count ?? 0,
      };
    },
  });

  const [greeting, setGreeting] = useState("");
  const [transferNumber, setTransferNumber] = useState("");
  const [emailSummaryTo, setEmailSummaryTo] = useState("");
  const [agentId, setAgentId] = useState("");

  // Sync local state when settings load
  useMemo(() => {
    if (settings) {
      setGreeting(settings.greeting);
      setTransferNumber(settings.transfer_number);
      setEmailSummaryTo(settings.email_summary_to);
      setAgentId((settings as any).elevenlabs_agent_id ?? "");
    }
  }, [settings?.id]);

  const toggleActive = useMutation({
    mutationFn: async (newVal: boolean) => {
      if (!settings) return;
      const { error } = await supabase
        .from("ai_receptionist_settings")
        .update({ is_active: newVal })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-receptionist-settings"] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      const { error } = await supabase
        .from("ai_receptionist_settings")
        .update({
          greeting,
          transfer_number: transferNumber,
          email_summary_to: emailSummaryTo,
          elevenlabs_agent_id: agentId || null,
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-receptionist-settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const isActive = settings?.is_active ?? true;

  return (
    <>
      {/* Status toggle */}
      <Card className={isActive ? "border-green-200 bg-green-50/50" : "border-amber-300 bg-amber-50/60"}>
        <CardContent className="p-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {isActive ? (
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            ) : (
              <PauseCircle className="h-10 w-10 text-amber-600" />
            )}
            <div>
              <h2 className="text-xl font-semibold">
                AI Receptionist is {isActive ? "ACTIVE 🟢" : "PAUSED ⏸️"}
              </h2>
              {!isActive && (
                <p className="text-sm text-amber-700 flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-4 w-4" />
                  Calls will not be answered by AI while paused
                </p>
              )}
              {isActive && (
                <p className="text-sm text-muted-foreground mt-1">
                  All incoming calls are being answered automatically
                </p>
              )}
            </div>
          </div>
          <Button
            size="lg"
            variant={isActive ? "outline" : "default"}
            onClick={() => toggleActive.mutate(!isActive)}
            disabled={toggleActive.isPending || !settings}
          >
            {isActive ? "Pause AI" : "Activate AI"}
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Calls today" value={stats?.today} icon={<PhoneCall className="h-5 w-5" />} />
        <StatCard label="Calls this week" value={stats?.week} icon={<Calendar className="h-5 w-5" />} />
        <StatCard label="Bookings made by AI (this month)" value={stats?.bookings} icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} />
        <StatCard label="Transfers to groomer (this month)" value={stats?.transfers} icon={<PhoneForwarded className="h-5 w-5 text-blue-600" />} />
      </div>

      {/* Twilio Number */}
      <Card className="bg-primary/5 border-primary/30">
        <CardContent className="p-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Your AI Receptionist Number
          </p>
          <p className="text-3xl font-mono font-bold text-primary">{TWILIO_NUMBER}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Forward your salon number to this number to activate call answering
          </p>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>How the AI introduces itself and where it routes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="greeting">Greeting message</Label>
            <Input id="greeting" value={greeting} onChange={(e) => setGreeting(e.target.value)} />
            <p className="text-xs text-muted-foreground">First thing the AI says when answering a call</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transfer">Transfer number</Label>
            <Input id="transfer" value={transferNumber} onChange={(e) => setTransferNumber(e.target.value)} placeholder="+441708606655" />
            <p className="text-xs text-muted-foreground">Where the AI transfers calls if it can't help</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email summaries to</Label>
            <Input id="email" type="email" value={emailSummaryTo} onChange={(e) => setEmailSummaryTo(e.target.value)} />
            <p className="text-xs text-muted-foreground">Daily call summaries get emailed here</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agentId">ElevenLabs Agent ID</Label>
            <Input id="agentId" value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="agent_xxx" className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">The ID of the ElevenLabs agent answering calls</p>
          </div>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? "Saving…" : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | undefined; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <p className="text-3xl font-bold mt-2">{value ?? "—"}</p>
      </CardContent>
    </Card>
  );
}

// ─── HOURS ────────────────────────────────────────────────────

function HoursTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: hours } = useQuery({
    queryKey: ["ai-receptionist-hours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_receptionist_hours")
        .select("*")
        .order("day_of_week", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateRow = useMutation({
    mutationFn: async (row: { id: string; is_open: boolean; open_time: string | null; close_time: string | null }) => {
      const { error } = await supabase
        .from("ai_receptionist_hours")
        .update({ is_open: row.is_open, open_time: row.open_time, close_time: row.close_time })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-receptionist-hours"] });
      toast({ title: "Hours updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Opening Hours</CardTitle>
        <CardDescription>
          The AI uses these hours to tell callers when the salon is open. Outside these hours the AI will still answer
          but will say the salon is currently closed and offer to take a message.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hours?.map((row) => (
          <HoursRow key={row.id} row={row} onSave={(p) => updateRow.mutate({ id: row.id, ...p })} />
        ))}
      </CardContent>
    </Card>
  );
}

function HoursRow({
  row,
  onSave,
}: {
  row: { id: string; day_of_week: number; is_open: boolean; open_time: string | null; close_time: string | null };
  onSave: (p: { is_open: boolean; open_time: string | null; close_time: string | null }) => void;
}) {
  const [isOpen, setIsOpen] = useState(row.is_open);
  const [openTime, setOpenTime] = useState(row.open_time ?? "10:00");
  const [closeTime, setCloseTime] = useState(row.close_time ?? "17:00");

  const dirty =
    isOpen !== row.is_open ||
    (isOpen && (openTime !== row.open_time || closeTime !== row.close_time));

  return (
    <div className="flex items-center gap-4 flex-wrap p-3 border rounded-md bg-card">
      <div className="w-32 font-medium">{DAY_NAMES[row.day_of_week]}</div>
      <div className="flex items-center gap-2">
        <Switch checked={isOpen} onCheckedChange={setIsOpen} />
        <span className="text-sm text-muted-foreground w-16">{isOpen ? "Open" : "Closed"}</span>
      </div>
      {isOpen && (
        <div className="flex items-center gap-2">
          <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="w-32" />
          <span className="text-muted-foreground">to</span>
          <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="w-32" />
        </div>
      )}
      <Button
        size="sm"
        variant={dirty ? "default" : "outline"}
        disabled={!dirty}
        className="ml-auto"
        onClick={() =>
          onSave({
            is_open: isOpen,
            open_time: isOpen ? openTime : null,
            close_time: isOpen ? closeTime : null,
          })
        }
      >
        Save
      </Button>
    </div>
  );
}

// ─── KNOWLEDGE ────────────────────────────────────────────────

function KnowledgeTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: entries } = useQuery({
    queryKey: ["ai-receptionist-knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_receptionist_knowledge")
        .select("*")
        .order("category", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["ai-receptionist-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, fixed_price, duration_minutes, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("ai_receptionist_knowledge").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-receptionist-knowledge"] }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_receptionist_knowledge").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-receptionist-knowledge"] });
      toast({ title: "Entry deleted" });
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Knowledge Base</CardTitle>
            <CardDescription>
              The AI uses ALL active entries to answer calls — if a caller asks something matching a question, the AI uses that exact answer.
            </CardDescription>
          </div>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Entry
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Category</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Answer</TableHead>
                <TableHead className="w-20">Active</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><Badge variant="secondary">{e.category}</Badge></TableCell>
                  <TableCell className="font-medium">{e.question}</TableCell>
                  <TableCell
                    className="cursor-pointer text-sm text-muted-foreground"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    {expanded === e.id ? e.answer : (e.answer.length > 80 ? e.answer.slice(0, 80) + "…" : e.answer)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={e.is_active}
                      onCheckedChange={(v) => toggleActive.mutate({ id: e.id, is_active: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { if (confirm("Delete this entry?")) deleteEntry.mutate(e.id); }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {entries?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No entries yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Services & Prices</CardTitle>
          <CardDescription>
            These are pulled automatically from your booking system and the AI always has up-to-date pricing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.fixed_price != null ? `£${Number(s.fixed_price).toFixed(2)}` : <span className="text-muted-foreground italic">Varies by breed</span>}</TableCell>
                  <TableCell>{s.duration_minutes != null ? `${s.duration_minutes} min` : "—"}</TableCell>
                </TableRow>
              ))}
              {services?.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No active services</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <KnowledgeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["ai-receptionist-knowledge"] });
          setDialogOpen(false);
        }}
      />
    </>
  );
}

function KnowledgeDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: any | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState<string>(editing?.category ?? "Other");
  const [question, setQuestion] = useState(editing?.question ?? "");
  const [answer, setAnswer] = useState(editing?.answer ?? "");
  const [isActive, setIsActive] = useState<boolean>(editing?.is_active ?? true);

  // reset on dialog open
  useMemo(() => {
    if (open) {
      setCategory(editing?.category ?? "Other");
      setQuestion(editing?.question ?? "");
      setAnswer(editing?.answer ?? "");
      setIsActive(editing?.is_active ?? true);
    }
  }, [open, editing?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!question.trim() || !answer.trim()) throw new Error("Question and answer required");
      if (editing?.id) {
        const { error } = await supabase
          .from("ai_receptionist_knowledge")
          .update({ category, question, answer, is_active: isActive })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ai_receptionist_knowledge")
          .insert({ category, question, answer, is_active: isActive });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Entry updated" : "Entry added" });
      onSaved();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit entry" : "Add new entry"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Question</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Where are you located?" />
          </div>
          <div className="space-y-2">
            <Label>Answer</Label>
            <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} placeholder="What the AI should say…" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CALL LOGS ─────────────────────────────────────────────────

function CallLogsTab() {
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [searchPhone, setSearchPhone] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [viewing, setViewing] = useState<any | null>(null);

  const { data: logs } = useQuery({
    queryKey: ["ai-call-logs", outcomeFilter, searchPhone, fromDate, toDate],
    queryFn: async () => {
      let q = supabase
        .from("ai_call_logs")
        .select("*")
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (outcomeFilter !== "all") q = q.eq("outcome", outcomeFilter);
      if (searchPhone) q = q.ilike("caller_number", `%${searchPhone}%`);
      if (fromDate) q = q.gte("started_at", new Date(fromDate).toISOString());
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        q = q.lte("started_at", end.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Logs</CardTitle>
        <CardDescription>Every call handled by the AI</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Outcome</Label>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                <SelectItem value="booking_made">Booking made</SelectItem>
                <SelectItem value="reschedule">Reschedule</SelectItem>
                <SelectItem value="cancellation">Cancellation</SelectItem>
                <SelectItem value="enquiry">Enquiry</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
                <SelectItem value="voicemail">Voicemail</SelectItem>
                <SelectItem value="abandoned">Abandoned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Search caller</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} placeholder="Phone number" className="pl-8" />
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & time</TableHead>
              <TableHead>Caller</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="text-right">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs?.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">
                  {log.started_at ? new Date(log.started_at).toLocaleString("en-GB") : "—"}
                </TableCell>
                <TableCell className="text-sm font-mono">{log.caller_number ?? "—"}</TableCell>
                <TableCell className="text-sm">{formatDuration(log.duration_seconds)}</TableCell>
                <TableCell>
                  {log.outcome ? (
                    <Badge variant="outline" className={OUTCOME_STYLE[log.outcome] ?? ""}>
                      {log.outcome.replace(/_/g, " ")}
                    </Badge>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-md">
                  {log.summary ? (log.summary.length > 100 ? log.summary.slice(0, 100) + "…" : log.summary) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setViewing(log)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {logs?.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No calls logged yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <CallDetailSheet log={viewing} onClose={() => setViewing(null)} />
    </Card>
  );
}

function CallDetailSheet({ log, onClose }: { log: any | null; onClose: () => void }) {
  return (
    <Sheet open={!!log} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Call details</SheetTitle>
          <SheetDescription>
            {log?.started_at ? new Date(log.started_at).toLocaleString("en-GB") : ""}
          </SheetDescription>
        </SheetHeader>
        {log && (
          <div className="space-y-5 mt-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-muted-foreground text-xs uppercase">Caller</div><div className="font-mono">{log.caller_number ?? "—"}</div></div>
              <div><div className="text-muted-foreground text-xs uppercase">Name</div><div>{log.caller_name ?? "—"}</div></div>
              <div><div className="text-muted-foreground text-xs uppercase">Duration</div><div>{formatDuration(log.duration_seconds)}</div></div>
              <div>
                <div className="text-muted-foreground text-xs uppercase">Outcome</div>
                {log.outcome ? <Badge variant="outline" className={OUTCOME_STYLE[log.outcome] ?? ""}>{log.outcome.replace(/_/g, " ")}</Badge> : "—"}
              </div>
            </div>

            {log.summary && (
              <div>
                <h4 className="font-semibold mb-1 text-sm">AI summary</h4>
                <p className="text-sm bg-muted/50 rounded-md p-3 leading-relaxed">{log.summary}</p>
              </div>
            )}

            {log.booking_id && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
                <div className="font-semibold text-green-900">Booking created</div>
                <Link to={`/bookings`} className="text-green-700 underline text-xs">View in bookings →</Link>
              </div>
            )}

            {log.transfer_attempted && (
              <div className={`rounded-md p-3 text-sm ${log.transfer_successful ? "bg-blue-50 border border-blue-200" : "bg-rose-50 border border-rose-200"}`}>
                <div className="font-semibold">Transfer {log.transfer_successful ? "succeeded" : "failed"}</div>
                <div className="text-xs text-muted-foreground">Call was forwarded to the salon line</div>
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-2 text-sm">Transcript</h4>
              <div className="space-y-2">
                {Array.isArray(log.transcript) && log.transcript.length > 0 ? (
                  log.transcript.map((m: any, i: number) => {
                    const isAI = m.role === "ai" || m.role === "assistant";
                    return (
                      <div key={i} className={`flex ${isAI ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isAI ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                          <div className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">{isAI ? "AI" : "Caller"}</div>
                          {m.message ?? m.text ?? ""}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground italic">No transcript</p>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// ─── SYSTEM PROMPT (Director only) ──────────────────────────────

function SystemPromptTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { staff } = useCurrentStaff();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["ai-receptionist-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_receptionist_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [prompt, setPrompt] = useState("");
  const [updaterName, setUpdaterName] = useState<string | null>(null);

  useMemo(() => {
    if (settings) {
      setPrompt((settings as any).system_prompt ?? "");
    }
  }, [settings?.id]);

  const updatedAt = (settings as any)?.system_prompt_updated_at as string | null | undefined;
  const updatedBy = (settings as any)?.system_prompt_updated_by as string | null | undefined;

  useMemo(() => {
    if (!updatedBy) { setUpdaterName(null); return; }
    supabase
      .from("staff")
      .select("name")
      .eq("id", updatedBy)
      .maybeSingle()
      .then(({ data }) => setUpdaterName(data?.name ?? null));
  }, [updatedBy]);

  const save = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      const { error } = await supabase
        .from("ai_receptionist_settings")
        .update({
          system_prompt: prompt,
          system_prompt_updated_at: new Date().toISOString(),
          system_prompt_updated_by: staff?.id ?? null,
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-receptionist-settings"] });
      toast({ title: "System prompt saved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast({ title: "Copied to clipboard", description: "Paste into ElevenLabs to apply on live calls." });
    } catch (e: any) {
      toast({ title: "Copy failed", description: e?.message ?? "Browser blocked clipboard access", variant: "destructive" });
    }
  };

  return (
    <>
      <Card className="border-amber-300 bg-amber-50/60">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900">
            Changes saved here are for reference only. You must copy and paste the prompt
            into ElevenLabs for changes to take effect on live calls.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Receptionist System Prompt
          </CardTitle>
          <CardDescription>
            The full instructions the AI follows when answering calls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              <strong>Last updated:</strong>{" "}
              {updatedAt ? new Date(updatedAt).toLocaleString() : "never"}
              {updaterName ? ` by ${updaterName}` : ""}
            </span>
            <span>
              <strong>Character count:</strong> {prompt.length.toLocaleString()}
            </span>
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Paste the full ElevenLabs system prompt here…"
            className="min-h-[480px] font-mono text-sm"
            disabled={isLoading}
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !settings}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={copyToClipboard} disabled={!prompt}>
              <Copy className="h-4 w-4 mr-2" />
              Copy to Clipboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
