import { useEffect, useMemo, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GroomerLayout } from "@/components/GroomerLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Inbox, Phone, MessageSquare, PhoneForwarded, Clock, Briefcase, AlertTriangle, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import { ChevronDown } from "lucide-react";

function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="list-none cursor-pointer flex items-center gap-2 mb-3 select-none">
        <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-0 -rotate-90 text-muted-foreground" />
        <h2 className="text-lg font-semibold">
          {title}{" "}
          <span className="text-muted-foreground font-normal text-sm">({count})</span>
        </h2>
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}

type CaseType = "missed_opportunity" | "message" | "callback_requested" | "running_late" | "ai_booking_notification" | "cancellation_waitlist";
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
  waitlist: "cancellation_waitlist",
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
  cancellation_waitlist: [
    "Called — earlier slot offered",
    "Called — no earlier slots available",
    "Customer no longer needs earlier slot",
    "No answer — will try again",
    "Other",
  ],
};

// Per-tab/case-type color theming (mobile + cards)
const CASE_THEME: Record<string, {
  tabActive: string;
  tabIdle: string;
  border: string;
  bg: string;
  badge: string;
}> = {
  missed_opportunity: {
    tabActive: "bg-amber-500 text-white border-amber-600",
    tabIdle: "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100",
    border: "border-l-[4px] border-l-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    badge: "bg-amber-500 text-white",
  },
  message: {
    tabActive: "bg-blue-500 text-white border-blue-600",
    tabIdle: "bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100",
    border: "border-l-[4px] border-l-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    badge: "bg-blue-500 text-white",
  },
  callback_requested: {
    tabActive: "bg-violet-500 text-white border-violet-600",
    tabIdle: "bg-violet-50 text-violet-900 border-violet-200 hover:bg-violet-100",
    border: "border-l-[4px] border-l-violet-500",
    bg: "bg-violet-50 dark:bg-violet-950/20",
    badge: "bg-violet-500 text-white",
  },
  running_late: {
    tabActive: "bg-red-500 text-white border-red-600 animate-pulse",
    tabIdle: "bg-red-50 text-red-900 border-red-200 hover:bg-red-100 animate-pulse",
    border: "border-l-[4px] border-l-red-500",
    bg: "bg-red-50 dark:bg-red-950/20",
    badge: "bg-red-500 text-white",
  },
  ai_booking_notification: {
    tabActive: "bg-slate-500 text-white border-slate-600",
    tabIdle: "bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100",
    border: "border-l-[4px] border-l-slate-500",
    bg: "bg-slate-50 dark:bg-slate-950/20",
    badge: "bg-slate-500 text-white",
  },
  cancellation_waitlist: {
    tabActive: "bg-teal-500 text-white border-teal-600",
    tabIdle: "bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100",
    border: "border-l-[4px] border-l-teal-500",
    bg: "bg-teal-50 dark:bg-teal-950/20",
    badge: "bg-teal-500 text-white",
  },
};

const MINE_THEME = {
  tabActive: "bg-emerald-500 text-white border-emerald-600",
  tabIdle: "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100",
  border: "border-l-[4px] border-l-emerald-500",
  bg: "bg-emerald-50 dark:bg-emerald-950/20",
  badge: "bg-emerald-500 text-white",
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

function cardTheme(c: InboxCase, contextMine?: boolean) {
  const urgent = c.case_type === "running_late" && c.status !== "resolved";
  if (urgent) {
    return {
      cls: "border-l-[4px] border-l-red-500 bg-red-50 dark:bg-red-950/20 animate-pulse",
    };
  }
  if (c.status === "resolved") {
    return { cls: "border-l-[4px] border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20" };
  }
  if (contextMine || c.status === "assigned") {
    return { cls: "border-l-[4px] border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20" };
  }
  // Cancellation waitlist gets teal border per spec
  if (c.case_type === "cancellation_waitlist") {
    return { cls: "border-l-[4px] border-l-teal-500 bg-teal-50 dark:bg-teal-950/20" };
  }
  // unassigned: tint by case_type background, amber border per spec
  const t = CASE_THEME[c.case_type] ?? CASE_THEME.ai_booking_notification;
  return { cls: `border-l-[4px] border-l-amber-500 ${t.bg}` };
}

function assignedAgeInfo(assignedAt: string | null | undefined) {
  if (!assignedAt) return { label: null as string | null, level: null as "amber" | "red" | null };
  const ms = Date.now() - new Date(assignedAt).getTime();
  if (!isFinite(ms) || ms < 0) return { label: null, level: null };
  const mins = Math.floor(ms / 60000);
  let label: string;
  if (mins < 60) label = `Assigned ${mins} minute${mins === 1 ? "" : "s"} ago`;
  else if (mins < 60 * 24) {
    const hours = Math.floor(mins / 60);
    label = `Assigned ${hours} hour${hours === 1 ? "" : "s"} ago`;
  } else {
    const days = Math.floor(mins / (60 * 24));
    label = `Assigned ${days} day${days === 1 ? "" : "s"} ago`;
  }
  const hours = mins / 60;
  const level: "amber" | "red" | null = hours >= 24 ? "red" : hours >= 2 ? "amber" : null;
  return { label, level };
}

function CaseCard({
  c,
  onClaim,
  onResolve,
  showResolver,
  isMine,
  showAssignedAge,
}: {
  c: InboxCase;
  onClaim?: (c: InboxCase) => void;
  onResolve?: (c: InboxCase) => void;
  showResolver?: boolean;
  isMine?: boolean;
  showAssignedAge?: boolean;
}) {
  const urgent = c.case_type === "running_late" && c.status !== "resolved";
  const baseTheme = cardTheme(c, isMine);
  const age = showAssignedAge ? assignedAgeInfo(c.assigned_at) : { label: null, level: null };
  const themeCls =
    age.level === "red"
      ? "border-l-[4px] border-l-red-500 bg-red-50/60 dark:bg-red-950/20"
      : age.level === "amber"
      ? "border-l-[4px] border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20"
      : baseTheme.cls;
  const [expanded, setExpanded] = useState(false);
  const resolvedAfterLabel = (() => {
    if (c.status !== "resolved" || !c.resolved_at) return null;
    const ms = new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime();
    if (!isFinite(ms) || ms < 0) return null;
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `Resolved ${mins} minute${mins === 1 ? "" : "s"} after case opened`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `Resolved ${hours} hour${hours === 1 ? "" : "s"} after case opened`;
    const days = Math.round(hours / 24);
    return `Resolved ${days} day${days === 1 ? "" : "s"} after case opened`;
  })();
  return (
    <motion.div
      drag={onClaim ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.4}
      onDragEnd={(_, info) => {
        if (!onClaim) return;
        if (info.offset.x > 120) onClaim(c);
      }}
      className="w-full"
    >
      <Card className={cn("w-full p-4 flex flex-col gap-3", themeCls)}>
        {showAssignedAge && age.label && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{age.label}</span>
            {age.level === "red" && (
              <Badge className="bg-red-600 text-white border-0 text-xs">🚨 Waiting 24h+</Badge>
            )}
            {age.level === "amber" && (
              <Badge className="bg-amber-500 text-white border-0 text-xs">⏰ Waiting 2h+</Badge>
            )}
          </div>
        )}
        {/* Line 1: name + number */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-base sm:text-lg font-semibold text-foreground truncate">
              {c.caller_name || "Unknown caller"}
              {c.dog_name && <span className="text-muted-foreground"> · {c.dog_name}</span>}
            </p>
            {c.caller_number ? (
              <a
                href={`tel:${formatTel(c.caller_number)}`}
                className="text-base text-primary underline-offset-4 hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                <Phone className="h-4 w-4" />
                {c.caller_number}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                <Phone className="h-4 w-4" />
                Number not captured
              </p>
            )}
          </div>
          {urgent && (
            <Badge variant="destructive" className="text-sm shrink-0">
              {c.minutes_late ?? "?"} min late
            </Badge>
          )}
          {c.status === "resolved" && (
            <Badge className="text-sm shrink-0 bg-emerald-600 text-white border-0">
              ✅ Resolved
            </Badge>
          )}
        </div>

        {c.case_type === "running_late" && c.appointment_time && (
          <p className="text-base">
            Appointment at <span className="font-semibold">{c.appointment_time}</span>
            {c.staff?.name && <> with <span className="font-semibold">{c.staff.name}</span></>}
          </p>
        )}

        {/* Line 2: summary truncated */}
        {c.summary && (
          <div>
            <p className={cn("text-base leading-relaxed", !expanded && "line-clamp-2")}>
              {c.summary}
            </p>
            {c.summary.length > 120 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-sm text-primary underline-offset-4 hover:underline mt-1"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {showResolver && c.resolution_note && (
          <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-sm space-y-1">
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              Resolved{c.resolver?.name && ` by ${c.resolver.name}`}
            </p>
            <p>{c.resolution_note}</p>
            {c.resolved_at && (
              <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
                Resolved at {formatTime(c.resolved_at)}
                {resolvedAfterLabel ? ` · ${resolvedAfterLabel}` : ""}
              </p>
            )}
          </div>
        )}

        {/* Footer: timestamp + full-width action */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground">{formatTime(c.created_at)}</p>
        </div>
        {onClaim && (
          <Button onClick={() => onClaim(c)} className="w-full h-12 text-base" size="lg">
            Claim this case
          </Button>
        )}
        {onResolve && isMine && (
          <Button onClick={() => onResolve(c)} className="w-full h-12 text-base" size="lg">
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
  const isManager = role === "manager";
  const isAllCasesView = isDirector || isManager;
  const Layout = isGroomer ? GroomerLayout : AppLayout;

  const [tab, setTab] = useState<string>(isGroomer ? "mine" : "missed");
  const [cases, setCases] = useState<InboxCase[]>([]);
  const [resolvedCases, setResolvedCases] = useState<InboxCase[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const [resolveTarget, setResolveTarget] = useState<InboxCase | null>(null);
  const [resolveOption, setResolveOption] = useState<string>("");
  const [resolveNote, setResolveNote] = useState<string>("");

  const fetchCases = useCallback(async () => {
    const [activeRes, resolvedRes] = await Promise.all([
      supabase
        .from("ai_inbox_cases")
        .select("*, staff:assigned_to(id, name), resolver:resolved_by(id, name)")
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("ai_inbox_cases")
        .select("*, staff:assigned_to(id, name), resolver:resolved_by(id, name)")
        .eq("status", "resolved")
        .order("resolved_at", { ascending: false })
        .limit(300),
    ]);
    if (activeRes.error) console.error("Failed to load active inbox cases", activeRes.error);
    if (resolvedRes.error) console.error("Failed to load resolved inbox cases", resolvedRes.error);
    setCases((activeRes.data as unknown as InboxCase[]) || []);
    setResolvedCases((resolvedRes.data as unknown as InboxCase[]) || []);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    fetchCases();
    if (isAllCasesView) {
      supabase
        .from("staff")
        .select("id, name")
        .eq("role", "Groomer")
        .neq("account_blocked", true)
        .is("employment_end_date", null)
        .order("name", { ascending: true })
        .then(({ data }) => setStaffList((data as any) || []));
    }
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
  }, [fetchCases, isAllCasesView]);

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
    for (const c of resolvedCases) {
      (map[c.case_type] = map[c.case_type] || []).push(c);
    }
    for (const k of Object.keys(map)) map[k] = map[k].slice(0, 20);
    return map;
  }, [resolvedCases]);

  const resolvedTodayCount = useCallback((type: CaseType) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return resolvedCases.filter(
      (c) => c.case_type === type && c.resolved_at && new Date(c.resolved_at) >= today,
    ).length;
  }, [resolvedCases]);

  const myResolvedCases = useMemo(() => {
    if (!staff) return [];
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return resolvedCases.filter(
      (c) => c.resolver?.id === staff.id && c.resolved_at && new Date(c.resolved_at).getTime() >= cutoff,
    );
  }, [resolvedCases, staff]);

  const myCases = useMemo(() => {
    if (isAllCasesView) return cases.filter((c) => c.status === "assigned");
    if (!staff) return [];
    return cases.filter((c) => c.status === "assigned" && c.assigned_to === staff.id);
  }, [cases, staff, isAllCasesView]);

  const myUrgent = useMemo(
    () => myCases.filter((c) => c.case_type === "running_late"),
    [myCases],
  );

  const unassignedCount = (type: CaseType) => (unassignedByType[type] || []).length;

  const TabButton = ({
    value,
    label,
    icon: Icon,
    count,
    theme,
  }: {
    value: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
    theme: { tabActive: string; tabIdle: string; badge: string };
  }) => {
    const active = tab === value;
    return (
      <button
        type="button"
        onClick={() => setTab(value)}
        className={cn(
          "relative w-full min-h-[60px] rounded-lg border-2 px-3 py-2 text-base font-semibold transition-colors flex items-center justify-center gap-2",
          active ? theme.tabActive : theme.tabIdle,
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="truncate">{label}</span>
        {count > 0 && (
          <Badge
            className={cn(
              "h-6 min-w-6 px-1.5 text-xs font-bold rounded-full border-0",
              active ? "bg-white/25 text-white" : theme.badge,
            )}
          >
            {count}
          </Badge>
        )}
      </button>
    );
  };

  const renderTab = (type: CaseType, label: string) => {
    const unassigned = unassignedByType[type] || [];
    const resolved = resolvedByType[type] || [];
    const activeCount = unassigned.length;
    const resolvedToday = resolvedTodayCount(type);
    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{activeCount}</span> active ·{" "}
          <span className="font-semibold text-foreground">{resolvedToday}</span> resolved today
        </div>
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
        <CollapsibleSection title="Recently Resolved" count={resolved.length}>
          {resolved.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing resolved yet.</p>
          ) : (
            <div className="space-y-3">
              {resolved.map((c) => (
                <CaseCard key={c.id} c={c} showResolver />
              ))}
            </div>
          )}
        </CollapsibleSection>
        {isDirector && (
          <CollapsibleSection
            title="All Resolved (Director view)"
            count={resolvedCases.filter((c) => c.case_type === type).length}
          >
            {resolvedCases.filter((c) => c.case_type === type).length === 0 ? (
              <p className="text-muted-foreground text-sm">No resolved cases on record.</p>
            ) : (
              <div className="space-y-3">
                {resolvedCases
                  .filter((c) => c.case_type === type)
                  .map((c) => (
                    <CaseCard key={`all-${c.id}`} c={c} showResolver />
                  ))}
              </div>
            )}
          </CollapsibleSection>
        )}
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

        {(() => {
          const lateCount = (unassignedByType.running_late?.length || 0) + myUrgent.length;
          if (lateCount === 0) return null;
          return (
            <Card className="p-4 border-l-[4px] border-l-red-500 bg-red-50 dark:bg-red-950/20 animate-pulse">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-base text-red-900 dark:text-red-100">
                    ⚠️ {lateCount} customer{lateCount === 1 ? "" : "s"} running late
                  </p>
                  {myUrgent.slice(0, 3).map((c) => (
                    <p key={c.id} className="text-sm text-red-900/80 dark:text-red-100/80">
                      {c.caller_name || "Customer"}
                      {c.dog_name ? ` · ${c.dog_name}` : ""} ·{" "}
                      <span className="font-semibold">{c.minutes_late} min late</span> for {c.appointment_time}
                    </p>
                  ))}
                </div>
              </div>
            </Card>
          );
        })()}

        <Tabs value={tab} onValueChange={setTab}>
          {/* Mobile: 2-column grid of large tappable buttons. Desktop: keep horizontal row. */}
          <div className="grid grid-cols-2 sm:hidden gap-2">
            <TabButton value="missed" label="Missed" icon={Briefcase} count={unassignedCount("missed_opportunity")} theme={CASE_THEME.missed_opportunity} />
            <TabButton value="messages" label="Messages" icon={MessageSquare} count={unassignedCount("message")} theme={CASE_THEME.message} />
            <TabButton value="callbacks" label="Callbacks" icon={PhoneForwarded} count={unassignedCount("callback_requested")} theme={CASE_THEME.callback_requested} />
            <TabButton value="late" label="Late" icon={Clock} count={unassignedCount("running_late")} theme={CASE_THEME.running_late} />
            <div className="col-span-2">
              <TabButton value="mine" label={isAllCasesView ? "All Cases" : "My Cases"} icon={Inbox} count={myCases.length} theme={MINE_THEME} />
            </div>
          </div>
          <div className="hidden sm:block overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-max min-w-full">
              <TabsTrigger value="missed" className="h-11">
                <Briefcase className="h-4 w-4 mr-1" />
                Missed
                {unassignedCount("missed_opportunity") > 0 && (
                  <Badge className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full bg-amber-500 text-white border-0">
                    {unassignedCount("missed_opportunity")}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="messages" className="h-11">
                <MessageSquare className="h-4 w-4 mr-1" />
                Messages
                {unassignedCount("message") > 0 && (
                  <Badge className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full bg-blue-500 text-white border-0">
                    {unassignedCount("message")}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="callbacks" className="h-11">
                <PhoneForwarded className="h-4 w-4 mr-1" />
                Callbacks
                {unassignedCount("callback_requested") > 0 && (
                  <Badge className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full bg-violet-500 text-white border-0">
                    {unassignedCount("callback_requested")}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="late" className="h-11">
                <Clock className="h-4 w-4 mr-1" />
                Late
                {unassignedCount("running_late") > 0 && (
                  <Badge className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full bg-red-500 text-white border-0 animate-pulse">
                    {unassignedCount("running_late")}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="mine" className="h-11">
                {isAllCasesView ? "All Cases" : "My Cases"}
                {myCases.length > 0 && (
                  <Badge className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] rounded-full bg-emerald-500 text-white border-0">
                    {myCases.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="missed" className="mt-4">{renderTab("missed_opportunity", "Missed Opportunities")}</TabsContent>
          <TabsContent value="messages" className="mt-4">{renderTab("message", "Messages")}</TabsContent>
          <TabsContent value="callbacks" className="mt-4">{renderTab("callback_requested", "Callbacks")}</TabsContent>
          <TabsContent value="late" className="mt-4">{renderTab("running_late", "Running Late")}</TabsContent>
          <TabsContent value="mine" className="mt-4">
            {isAllCasesView ? (
              (() => {
                const total = myCases.length;
                let over2 = 0;
                let over24 = 0;
                for (const c of myCases) {
                  const { level } = assignedAgeInfo(c.assigned_at);
                  if (level === "red") over24++;
                  else if (level === "amber") over2++;
                }
                // Build groups: every active groomer + any assignee not in the list
                const byStaffId = new Map<string, InboxCase[]>();
                for (const c of myCases) {
                  const key = c.assigned_to || "unassigned";
                  if (!byStaffId.has(key)) byStaffId.set(key, []);
                  byStaffId.get(key)!.push(c);
                }
                const knownIds = new Set(staffList.map((s) => s.id));
                const extraGroups: { id: string; name: string }[] = [];
                for (const c of myCases) {
                  if (c.assigned_to && !knownIds.has(c.assigned_to)) {
                    if (!extraGroups.find((g) => g.id === c.assigned_to)) {
                      extraGroups.push({ id: c.assigned_to, name: c.staff?.name || "Unknown staff" });
                    }
                  }
                }
                const groups = [...staffList, ...extraGroups];
                return (
                  <div className="space-y-6">
                    <Card className="p-4 grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-2xl font-bold">{total}</p>
                        <p className="text-xs text-muted-foreground">Open cases</p>
                      </div>
                      <div>
                        <p className={cn("text-2xl font-bold", over2 > 0 && "text-amber-600")}>{over2}</p>
                        <p className="text-xs text-muted-foreground">Waiting 2h+</p>
                      </div>
                      <div>
                        <p className={cn("text-2xl font-bold", over24 > 0 && "text-red-600")}>{over24}</p>
                        <p className="text-xs text-muted-foreground">Waiting 24h+</p>
                      </div>
                    </Card>
                    {groups.map((g) => {
                      const list = (byStaffId.get(g.id) || []).sort(
                        (a, b) =>
                          new Date(a.assigned_at || a.created_at).getTime() -
                          new Date(b.assigned_at || b.created_at).getTime(),
                      );
                      return (
                        <section key={g.id}>
                          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            {g.name}
                            <Badge className={cn("border-0", list.length === 0 ? "bg-muted text-muted-foreground" : "bg-emerald-500 text-white")}>
                              {list.length} open case{list.length === 1 ? "" : "s"}
                            </Badge>
                          </h2>
                          {list.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No open cases</p>
                          ) : (
                            <div className="space-y-3">
                              {list.map((c) => (
                                <CaseCard key={c.id} c={c} showAssignedAge isMine />
                              ))}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{myCases.length}</span> active ·{" "}
                <span className="font-semibold text-foreground">
                  {myResolvedCases.filter((c) => {
                    const t = new Date(); t.setHours(0, 0, 0, 0);
                    return c.resolved_at && new Date(c.resolved_at) >= t;
                  }).length}
                </span> resolved today
              </div>
              <section>
                <h2 className="text-lg font-semibold mb-3">Active ({myCases.length})</h2>
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
              </section>
              <CollapsibleSection title="My Resolved Cases (last 30 days)" count={myResolvedCases.length}>
                {myResolvedCases.length === 0 ? (
                  <p className="text-muted-foreground text-sm">You haven't resolved any cases in the last 30 days.</p>
                ) : (
                  <div className="space-y-3">
                    {myResolvedCases.map((c) => (
                      <CaseCard key={`mine-resolved-${c.id}`} c={c} showResolver />
                    ))}
                  </div>
                )}
              </CollapsibleSection>
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