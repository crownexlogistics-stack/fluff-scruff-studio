import { useEffect, useMemo, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GroomerLayout } from "@/components/GroomerLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Inbox, Phone, MessageSquare, PhoneForwarded, Clock, Briefcase, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";

type CaseType = "missed_opportunity" | "message" | "callback_requested" | "running_late" | "ai_booking_notification";
type Status = "unassigned" | "assigned" | "resolved";

interface InboxCase {
  id: string;
  case_type: CaseType;
  status: Status;
  caller_number: string | null;
  caller_name: string | null;
  dog_name: string | null;
  summary: string | null;
  full_transcript: any;
  call_duration_seconds: number | null;
  assigned_to: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  appointment_time: string | null;
  minutes_late: number | null;
  created_at: string;
  staff?: { id: string; name: string } | null;
  resolver?: { id: string; name: string } | null;
}

const TAB_TYPES: Record<string, CaseType> = {
  missed: "missed_opportunity",
  messages: "message",
  callbacks: "callback_requested",
  late: "running_late",
};

const RESOLUTION_OPTIONS: Record<CaseType, string[]> = {
  missed_opportunity: [
    "Called customer back — booked",
    "Called customer back — no answer",
    "Called customer back — not needed",
    "Other",
  ],
  message: [
    "Called customer back — booked",
    "Called customer back — no answer",
    "Called customer back — not needed",
    "Message noted — no action required",
    "Other",
  ],
  callback_requested: [
    "Called back — resolved",
    "Called back — no answer",
    "Called back — booked appointment",
    "Not needed",
    "Other",
  ],
  running_late: [
    "Customer arrived",
    "Appointment rescheduled",
    "Customer did not arrive",
    "Other",
  ],
  ai_booking_notification: ["Acknowledged", "Other"],
};

function formatTel(num: string | null) {
  if (!num) return "";
  let p = num.replace(/[\s\-\(\)]/g, "");
  if (p.startsWith("+44")) return p;
  if (p.startsWith("0")) return "+44" + p.slice(1);
  if (p.startsWith("44")) return "+" + p;
  return p;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

function borderClass(status: Status, urgent: boolean) {
  if (urgent) return "border-l-4 border-destructive animate-pulse";
  if (status === "unassigned") return "border-l-4 border-amber-500";
  if (status === "assigned") return "border-l-4 border-blue-500";
  return "border-l-4 border-emerald-500";
}

function CaseCard({
  c,
  onClaim,
  onResolve,
  showResolver,
  isMine,
}: {
  c: InboxCase;
  onClaim?: (c: InboxCase) => void;
  onResolve?: (c: InboxCase) => void;
  showResolver?: boolean;
  isMine?: boolean;
}) {
  const urgent = c.case_type === "running_late" && c.status !== "resolved";
  return (
    <motion.div
      drag={onClaim ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.4}
      onDragEnd={(_, info) => {
        if (!onClaim) return;
        if (info.offset.x > 120) onClaim(c);
      }}
    >
      <Card className={`p-4 sm:p-5 ${borderClass(c.status, urgent)}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-0">
            {(c.caller_name || c.dog_name) && (
              <p className="text-lg font-semibold text-foreground">
                {c.caller_name || "Unknown caller"}
                {c.dog_name && <span className="text-muted-foreground"> · {c.dog_name}</span>}
              </p>
            )}
            {c.caller_number && (
              <a
                href={`tel:${formatTel(c.caller_number)}`}
                className="text-base text-primary underline-offset-4 hover:underline inline-flex items-center gap-1"
              >
                <Phone className="h-4 w-4" />
                {c.caller_number}
              </a>
            )}
            <p className="text-sm text-muted-foreground">{formatTime(c.created_at)}</p>
          </div>
          {urgent && (
            <Badge variant="destructive" className="text-sm">
              {c.minutes_late ?? "?"} min late
            </Badge>
          )}
        </div>

        {c.case_type === "running_late" && c.appointment_time && (
          <p className="mt-2 text-base">
            Appointment at <span className="font-semibold">{c.appointment_time}</span>
            {c.staff?.name && <> with <span className="font-semibold">{c.staff.name}</span></>}
          </p>
        )}

        {c.summary && <p className="mt-3 text-base leading-relaxed">{c.summary}</p>}

        {showResolver && c.resolution_note && (
          <div className="mt-3 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-sm">
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              Resolved{c.resolver?.name && ` by ${c.resolver.name}`}
            </p>
            <p>{c.resolution_note}</p>
          </div>
        )}

        {onClaim && (
          <Button
            onClick={() => onClaim(c)}
            className="mt-4 w-full h-12 text-base"
            size="lg"
          >
            Claim this case
          </Button>
        )}
        {onResolve && isMine && (
          <Button
            onClick={() => onResolve(c)}
            variant="default"
            className="mt-4 w-full h-12 text-base"
            size="lg"
          >
            Mark as resolved
          </Button>
        )}
      </Card>
    </motion.div>
  );
}

export default function AIInboxPage() {
  const { user } = useAuth();
  const { role } = useUserRole(user?.id);
  const { staff } = useCurrentStaff();
  const { toast } = useToast();
  const isGroomer = role === "groomer";
  const isDirector = role === "director";
  const Layout = isGroomer ? GroomerLayout : AppLayout;

  const [tab, setTab] = useState<string>(isGroomer ? "mine" : "missed");
  const [cases, setCases] = useState<InboxCase[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const [resolveTarget, setResolveTarget] = useState<InboxCase | null>(null);
  const [resolveOption, setResolveOption] = useState<string>("");
  const [resolveNote, setResolveNote] = useState<string>("");

  const fetchCases = useCallback(async () => {
    const { data, error } = await supabase
      .from("ai_inbox_cases")
      .select("*, staff:assigned_to(id, name), resolver:resolved_by(id, name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("Failed to load inbox cases", error);
      return;
    }
    setCases((data as unknown as InboxCase[]) || []);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    fetchCases();
    const channel = supabase
      .channel("ai_inbox_cases_page")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_inbox_cases" }, fetchCases)
      .subscribe();
    const interval = setInterval(fetchCases, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCases();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchCases]);

  const claimCase = async (c: InboxCase) => {
    if (!staff) {
      toast({ title: "No staff profile", description: "Your account isn't linked to a staff record.", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("ai_inbox_cases")
      .update({ assigned_to: staff.id, assigned_at: new Date().toISOString(), status: "assigned" })
      .eq("id", c.id)
      .eq("status", "unassigned");
    if (error) {
      toast({ title: "Could not claim", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("ai_inbox_notifications").insert({
      staff_id: staff.id,
      case_id: c.id,
      message: `You claimed a case from ${c.caller_name || c.caller_number || "an unknown caller"}`,
    });
    toast({ title: "Case claimed", description: "It now appears in My Cases." });
    fetchCases();
  };

  const submitResolution = async () => {
    if (!resolveTarget) return;
    const note = resolveNote.trim() || resolveOption;
    if (!note) {
      toast({ title: "Please choose a resolution", variant: "destructive" });
      return;
    }
    const fullNote = resolveOption && resolveNote ? `${resolveOption} — ${resolveNote}` : note;
    const { error } = await supabase
      .from("ai_inbox_cases")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolution_note: fullNote,
        resolved_by: staff?.id ?? null,
      })
      .eq("id", resolveTarget.id);
    if (error) {
      toast({ title: "Could not resolve", description: error.message, variant: "destructive" });
      return;
    }
    setResolveTarget(null);
    setResolveOption("");
    setResolveNote("");
    fetchCases();
    toast({ title: "Resolved" });
  };

  const unassignedByType = useMemo(() => {
    const map: Record<string, InboxCase[]> = {};
    for (const c of cases) {
      if (c.status === "unassigned") {
        (map[c.case_type] = map[c.case_type] || []).push(c);
      }
    }
    return map;
  }, [cases]);

  const resolvedByType = useMemo(() => {
    const map: Record<string, InboxCase[]> = {};
    for (const c of cases) {
      if (c.status === "resolved") {
        (map[c.case_type] = map[c.case_type] || []).push(c);
      }
    }
    for (const k of Object.keys(map)) map[k] = map[k].slice(0, 10);
    return map;
  }, [cases]);

  const myCases = useMemo(() => {
    if (isDirector) return cases.filter((c) => c.status === "assigned");
    if (!staff) return [];
    return cases.filter((c) => c.status === "assigned" && c.assigned_to === staff.id);
  }, [cases, staff, isDirector]);

  const myUrgent = useMemo(
    () => myCases.filter((c) => c.case_type === "running_late"),
    [myCases],
  );

  const tabBadge = (type: CaseType) => {
    const n = (unassignedByType[type] || []).length;
    if (!n) return null;
    return (
      <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full">
        {n}
      </Badge>
    );
  };

  const renderTab = (type: CaseType, label: string) => {
    const unassigned = unassignedByType[type] || [];
    const resolved = resolvedByType[type] || [];
    return (
      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-3">Unassigned ({unassigned.length})</h2>
          {unassigned.length === 0 ? (
            <p className="text-muted-foreground">Nothing in the pool right now.</p>
          ) : (
            <div className="space-y-3">
              {unassigned.map((c) => (
                <CaseCard key={c.id} c={c} onClaim={claimCase} />
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-3">Recently resolved</h2>
          {resolved.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing resolved yet.</p>
          ) : (
            <div className="space-y-3">
              {resolved.map((c) => (
                <CaseCard key={c.id} c={c} showResolver />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Inbox className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">AI Inbox</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Last updated {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </p>

        {myUrgent.length > 0 && (
          <Card className="p-4 border-l-4 border-destructive bg-destructive/10 animate-pulse">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-base">
                  {myUrgent.length === 1
                    ? "A customer is running late"
                    : `${myUrgent.length} customers are running late`}
                </p>
                {myUrgent.slice(0, 3).map((c) => (
                  <p key={c.id} className="text-sm">
                    {c.caller_name || "Customer"} · {c.dog_name || ""} ·{" "}
                    <span className="font-semibold">{c.minutes_late} min late</span> for {c.appointment_time}
                  </p>
                ))}
              </div>
            </div>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-max min-w-full">
              <TabsTrigger value="missed" className="h-11">
                <Briefcase className="h-4 w-4 mr-1" />
                Missed{tabBadge("missed_opportunity")}
              </TabsTrigger>
              <TabsTrigger value="messages" className="h-11">
                <MessageSquare className="h-4 w-4 mr-1" />
                Messages{tabBadge("message")}
              </TabsTrigger>
              <TabsTrigger value="callbacks" className="h-11">
                <PhoneForwarded className="h-4 w-4 mr-1" />
                Callbacks{tabBadge("callback_requested")}
              </TabsTrigger>
              <TabsTrigger value="late" className="h-11">
                <Clock className="h-4 w-4 mr-1" />
                Late{tabBadge("running_late")}
              </TabsTrigger>
              <TabsTrigger value="mine" className="h-11">
                My Cases{myCases.length > 0 && (
                  <Badge className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] rounded-full">{myCases.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="missed" className="mt-4">{renderTab("missed_opportunity", "Missed Opportunities")}</TabsContent>
          <TabsContent value="messages" className="mt-4">{renderTab("message", "Messages")}</TabsContent>
          <TabsContent value="callbacks" className="mt-4">{renderTab("callback_requested", "Callbacks")}</TabsContent>
          <TabsContent value="late" className="mt-4">{renderTab("running_late", "Running Late")}</TabsContent>
          <TabsContent value="mine" className="mt-4">
            {myCases.length === 0 ? (
              <p className="text-muted-foreground">No assigned cases. Claim some from the other tabs.</p>
            ) : (
              <div className="space-y-3">
                {myCases.map((c) => (
                  <CaseCard
                    key={c.id}
                    c={c}
                    onResolve={(x) => {
                      setResolveTarget(x);
                      setResolveOption("");
                      setResolveNote("");
                    }}
                    isMine
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!resolveTarget} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as resolved</DialogTitle>
          </DialogHeader>
          {resolveTarget && (
            <div className="space-y-3">
              <Select value={resolveOption} onValueChange={setResolveOption}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an outcome" />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTION_OPTIONS[resolveTarget.case_type].map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Add a note (optional unless 'Other')"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                rows={4}
                className="text-base"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>Cancel</Button>
            <Button onClick={submitResolution}>Resolve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}