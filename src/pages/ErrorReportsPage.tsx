import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Bot, Copy, Check, Trash2, RefreshCw, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ErrorReport {
  id: string;
  created_at: string;
  customer_email: string | null;
  customer_name: string | null;
  page_url: string;
  error_description: string;
  steps_to_reproduce: string;
  browser_info: string | null;
  device_info: string | null;
  screenshot_url: string | null;
  status: string;
  admin_notes: string | null;
  plain_english: string | null;
  impact: string | null;
  severity: string | null;
  fix_instruction: string | null;
  lovable_prompt: string | null;
  analysed_at: string | null;
  resolution_method: string | null;
}

interface GroupedError {
  key: string;
  description: string;
  pageUrl: string;
  pageName: string;
  reports: ErrorReport[];
  firstSeen: string;
  lastSeen: string;
  severity: string | null;
  plainEnglish: string | null;
  impact: string | null;
  fixInstruction: string | null;
  lovablePrompt: string | null;
  analysedAt: string | null;
  status: string;
  uniqueUsers: number;
}

function getPageName(url: string): string {
  try {
    const path = new URL(url).pathname;
    if (path === "/" || path === "") return "Homepage";
    const parts = path.split("/").filter(Boolean);
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, " ")).join(" → ");
  } catch {
    return url;
  }
}

function getDeviceType(info: string | null): string {
  if (!info) return "Unknown device";
  if (info.includes("Mobile")) return "Mobile";
  if (info.includes("Tablet")) return "Tablet";
  return "Desktop";
}

function getBrowserName(info: string | null): string {
  if (!info) return "Unknown browser";
  if (info.startsWith("Chrome")) return "Chrome";
  if (info.startsWith("Safari")) return "Safari";
  if (info.startsWith("Firefox")) return "Firefox";
  if (info.startsWith("Edge")) return "Edge";
  return info.split(" — ")[0] || "Unknown";
}

const severityConfig = {
  high: { label: "High", emoji: "🔴", bg: "bg-red-50 dark:bg-red-950", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300", badge: "bg-red-500 text-white" },
  medium: { label: "Medium", emoji: "🟡", bg: "bg-amber-50 dark:bg-amber-950", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-500 text-white" },
  low: { label: "Low", emoji: "🟢", bg: "bg-emerald-50 dark:bg-emerald-950", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-500 text-white" },
};

export default function ErrorReportsPage() {
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [analysingIds, setAnalysingIds] = useState<Set<string>>(new Set());
  const [resolveDialogGroup, setResolveDialogGroup] = useState<GroupedError | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<"errors" | "login">("errors");

  const fetchReports = async () => {
    const { data } = await supabase.from("error_reports" as any).select("*").order("created_at", { ascending: false });
    setReports((data as any as ErrorReport[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const loginEventTypes = ["LOGIN_FAILED", "ACCOUNT_LOCKED", "SESSION_EXPIRED", "PASSWORD_RESET_REQUESTED", "INVITE_LINK_EXPIRED"];

  const loginReports = useMemo(() => {
    return reports.filter(r => loginEventTypes.some(t => r.error_description.startsWith(`[${t}]`)));
  }, [reports]);

  const nonLoginReports = useMemo(() => {
    return reports.filter(r => !loginEventTypes.some(t => r.error_description.startsWith(`[${t}]`)));
  }, [reports]);

  // Group login issues by email
  const loginGrouped = useMemo(() => {
    const map = new Map<string, { email: string; events: ErrorReport[]; failCount24h: number }>();
    const now = Date.now();
    for (const r of loginReports) {
      const email = r.customer_email || r.steps_to_reproduce?.replace("Email: ", "") || "unknown";
      if (!map.has(email)) map.set(email, { email, events: [], failCount24h: 0 });
      const g = map.get(email)!;
      g.events.push(r);
      if (r.error_description.includes("LOGIN_FAILED") && (now - new Date(r.created_at).getTime()) < 24 * 60 * 60 * 1000) {
        g.failCount24h++;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const aLatest = new Date(a.events[0].created_at).getTime();
      const bLatest = new Date(b.events[0].created_at).getTime();
      return bLatest - aLatest;
    });
  }, [loginReports]);

  const sendFreshLoginLink = async (email: string) => {
    try {
      // Extract actual email from masked version - we can't, so use the steps_to_reproduce
      toast.info("Sending fresh login link...");
      await supabase.functions.invoke("send-customer-email", {
        body: {
          customer_email: "info@fluffandscruff.co.uk",
          subject: "🔐 Customer Login Assistance Needed",
          body: `A customer with masked email ${email} has been struggling to log in (3+ failed attempts in 24 hours).\n\nPlease check their account and send them a fresh login link manually from the admin panel.`,
        },
      });
      toast.success("Admin notified — check email to assist this customer");
    } catch {
      toast.error("Failed to send notification");
    }
  };

  const getLoginEventLabel = (desc: string) => {
    if (desc.includes("LOGIN_FAILED")) return "❌ Wrong password";
    if (desc.includes("ACCOUNT_LOCKED")) return "🔒 Account locked";
    if (desc.includes("SESSION_EXPIRED")) return "⏱️ Session expired";
    if (desc.includes("PASSWORD_RESET_REQUESTED")) return "🔑 Password reset requested";
    if (desc.includes("INVITE_LINK_EXPIRED")) return "📨 Expired invite link";
    return "🔐 Login event";
  };

  const grouped = useMemo(() => {
    const map = new Map<string, GroupedError>();
    const sourceReports = nonLoginReports;
    const filtered = filter === "resolved"
      ? sourceReports.filter(r => r.status === "resolved")
      : sourceReports.filter(r => r.status !== "resolved");

    for (const r of filtered) {
      const shortDesc = r.error_description.slice(0, 120);
      const key = `${shortDesc}||${r.page_url}`;
      if (!map.has(key)) {
        const analysed = filtered.find(rr => `${rr.error_description.slice(0, 120)}||${rr.page_url}` === key && rr.analysed_at);
        map.set(key, {
          key,
          description: r.error_description,
          pageUrl: r.page_url,
          pageName: getPageName(r.page_url),
          reports: [],
          firstSeen: r.created_at,
          lastSeen: r.created_at,
          severity: analysed?.severity || null,
          plainEnglish: analysed?.plain_english || null,
          impact: analysed?.impact || null,
          fixInstruction: analysed?.fix_instruction || null,
          lovablePrompt: analysed?.lovable_prompt || null,
          analysedAt: analysed?.analysed_at || null,
          status: r.status,
          uniqueUsers: 0,
        });
      }
      const g = map.get(key)!;
      g.reports.push(r);
      if (r.created_at < g.firstSeen) g.firstSeen = r.created_at;
      if (r.created_at > g.lastSeen) g.lastSeen = r.created_at;
    }

    // Calculate unique users
    for (const g of map.values()) {
      const emails = new Set(g.reports.map(r => r.customer_email).filter(Boolean));
      g.uniqueUsers = Math.max(emails.size, 1);
    }

    return Array.from(map.values()).sort((a, b) => {
      const sev = { high: 0, medium: 1, low: 2 };
      const sa = sev[(a.severity as keyof typeof sev)] ?? 1;
      const sb = sev[(b.severity as keyof typeof sev)] ?? 1;
      if (sa !== sb) return sa - sb;
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });
  }, [nonLoginReports, filter]);

  const summaryCount = useMemo(() => {
    const active = nonLoginReports.filter(r => r.status !== "resolved");
    const groups = new Map<string, string | null>();
    for (const r of active) {
      const key = `${r.error_description.slice(0, 120)}||${r.page_url}`;
      if (!groups.has(key)) groups.set(key, r.severity as string | null);
    }
    let high = 0, medium = 0, low = 0;
    for (const sev of groups.values()) {
      if (sev === "high") high++;
      else if (sev === "low") low++;
      else medium++;
    }
    return { high, medium, low, total: groups.size };
  }, [nonLoginReports]);

  const analyseError = async (reportId: string) => {
    setAnalysingIds(prev => new Set(prev).add(reportId));
    try {
      const { data, error } = await supabase.functions.invoke("analyse-error", {
        body: { error_id: reportId },
      });
      if (error) throw error;
      await fetchReports();
      toast.success("Analysis complete ✅");
    } catch (e: any) {
      toast.error("Analysis failed: " + (e.message || "Unknown error"));
    } finally {
      setAnalysingIds(prev => { const n = new Set(prev); n.delete(reportId); return n; });
    }
  };

  const analyseGroup = async (group: GroupedError) => {
    const unanalysed = group.reports.find(r => !r.analysed_at);
    const target = unanalysed || group.reports[0];
    await analyseError(target.id);
  };

  const copyForLovable = (group: GroupedError) => {
    const text = `Please fix this error that was reported on our website:

Error: ${group.description}
Page: ${group.pageUrl}
First seen: ${format(new Date(group.firstSeen), "dd MMM yyyy, HH:mm")}
Occurrences: ${group.reports.length}

${group.lovablePrompt || `The error "${group.description}" occurs on ${group.pageName}. Please investigate and fix the root cause.`}

Do not modify record-payment or cancel-booking-with-refund.`;

    navigator.clipboard.writeText(text);
    toast.success("Copied! Paste this into Lovable to fix the error ✅");
  };

  const copyAllHighPriority = () => {
    const highGroups = grouped.filter(g => g.severity === "high");
    if (highGroups.length === 0) { toast.info("No high priority errors"); return; }

    const text = highGroups.map((g, i) => `ERROR ${i + 1}:
${g.description}
Page: ${g.pageUrl}
${g.lovablePrompt || `Fix the error "${g.description}" on ${g.pageName}.`}
`).join("\n---\n\n");

    navigator.clipboard.writeText(`Please fix these high priority errors on our website:\n\n${text}\nDo not modify record-payment or cancel-booking-with-refund.`);
    toast.success(`Copied ${highGroups.length} high priority errors for Lovable ✅`);
  };

  const resolveGroup = async (group: GroupedError, method: string) => {
    for (const r of group.reports) {
      await supabase.from("error_reports" as any)
        .update({ status: "resolved", resolution_method: method } as any)
        .eq("id", r.id);
    }
    setResolveDialogGroup(null);
    await fetchReports();
    toast.success("Error marked as resolved ✅");
  };

  const dismissGroup = async (group: GroupedError) => {
    for (const r of group.reports) {
      await supabase.from("error_reports" as any)
        .update({ status: "resolved", resolution_method: "dismissed" } as any)
        .eq("id", r.id);
    }
    await fetchReports();
    toast.success("Error dismissed");
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Error Reports</h1>
          <p className="text-sm text-muted-foreground">AI-powered error analysis for your website</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {(["high", "medium", "low"] as const).map(sev => {
            const cfg = severityConfig[sev];
            const count = summaryCount[sev];
            return (
              <Card key={sev} className={`${cfg.bg} ${cfg.border} border`}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{cfg.emoji} {count}</p>
                  <p className={`text-xs font-medium ${cfg.text}`}>{cfg.label} priority</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {summaryCount.high > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {summaryCount.high} error{summaryCount.high > 1 ? "s" : ""} need{summaryCount.high === 1 ? "s" : ""} your attention
            </p>
            <Button size="sm" variant="destructive" className="ml-auto" onClick={copyAllHighPriority}>
              <Copy className="h-3 w-3 mr-1" /> Fix All High Priority
            </Button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2">
          {[
            { key: "active", label: `Active (${reports.filter(r => r.status !== "resolved").length})` },
            { key: "resolved", label: `Resolved (${reports.filter(r => r.status === "resolved").length})` },
          ].map(t => (
            <Button key={t.key} variant={filter === t.key ? "default" : "outline"} size="sm" onClick={() => setFilter(t.key)}>
              {t.label}
            </Button>
          ))}
        </div>

        {/* Error list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {filter === "resolved" ? "No resolved errors yet." : "No active errors — everything looks good! 🎉"}
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(group => {
              const expanded = expandedKey === group.key;
              const sevCfg = severityConfig[(group.severity as keyof typeof severityConfig)] || severityConfig.medium;
              const isAnalysing = group.reports.some(r => analysingIds.has(r.id));

              return (
                <Card key={group.key} className={`overflow-hidden border ${expanded ? sevCfg.border : ""}`}>
                  <button
                    onClick={() => setExpandedKey(expanded ? null : group.key)}
                    className="w-full p-4 flex items-start justify-between text-left"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {group.severity ? (
                          <Badge className={sevCfg.badge}>{sevCfg.emoji} {sevCfg.label}</Badge>
                        ) : (
                          <Badge variant="outline">⏳ Unanalysed</Badge>
                        )}
                        {group.status === "new" && <Badge className="bg-red-500 text-white">NEW</Badge>}
                        {group.reports.length > 1 && (
                          <Badge variant="secondary">{group.reports.length}× occurrences</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>📍 {group.pageName}</span>
                        <span>·</span>
                        <span>{format(new Date(group.lastSeen), "dd MMM yyyy, HH:mm")}</span>
                        {group.uniqueUsers > 1 && <><span>·</span><span>👤 {group.uniqueUsers} users</span></>}
                      </div>
                      {group.plainEnglish ? (
                        <p className="text-sm">{group.plainEnglish}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground truncate">{group.description}</p>
                      )}
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 shrink-0 mt-1" />}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 space-y-4 border-t pt-4">
                      {/* AI Analysis */}
                      {group.analysedAt ? (
                        <div className="space-y-3">
                          <div className={`p-3 rounded-lg ${sevCfg.bg} border ${sevCfg.border}`}>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">🤖 What happened (plain English)</p>
                            <p className="text-sm">{group.plainEnglish}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">💥 Impact</p>
                            <p className="text-sm">{group.impact}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">🔧 Suggested fix</p>
                            <p className="text-sm">{group.fixInstruction}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-muted/30 text-center">
                          {isAnalysing ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                              <span className="text-sm text-muted-foreground">Analysing with AI...</span>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Not yet analysed. Click below to get an AI explanation.</p>
                          )}
                        </div>
                      )}

                      {/* Details */}
                      <div className="grid sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">👤 Who was affected</p>
                          <p>{group.reports[0].customer_email || "Anonymous"} on {getDeviceType(group.reports[0].device_info)} ({getBrowserName(group.reports[0].browser_info)})</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">🕐 Timeline</p>
                          <p>First: {format(new Date(group.firstSeen), "dd MMM HH:mm")}</p>
                          {group.reports.length > 1 && <p>Last: {format(new Date(group.lastSeen), "dd MMM HH:mm")}</p>}
                        </div>
                      </div>

                      {group.reports[0].screenshot_url && (
                        <div>
                          <a href={group.reports[0].screenshot_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" /> View Screenshot
                          </a>
                        </div>
                      )}

                      {/* Resolution info for resolved */}
                      {group.status === "resolved" && group.reports[0].resolution_method && (
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            ✅ Resolved: {group.reports[0].resolution_method.replace(/_/g, " ")}
                          </p>
                        </div>
                      )}

                      {/* Action buttons */}
                      {group.status !== "resolved" && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          <Button size="sm" variant="outline" onClick={() => analyseGroup(group)} disabled={isAnalysing}>
                            <Bot className="h-3.5 w-3.5 mr-1" />
                            {group.analysedAt ? "Re-analyse" : "Analyse with AI"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => copyForLovable(group)}>
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copy for Lovable
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setResolveDialogGroup(group)}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Mark Resolved
                          </Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => dismissGroup(group)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Dismiss
                          </Button>
                        </div>
                      )}

                      {/* Raw error (collapsible) */}
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show raw error details</summary>
                        <pre className="mt-2 p-3 rounded-lg bg-muted/30 overflow-x-auto whitespace-pre-wrap break-all text-[11px]">
                          {group.description}
                        </pre>
                      </details>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Refresh button */}
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => { setLoading(true); fetchReports(); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Resolve dialog */}
      <Dialog open={!!resolveDialogGroup} onOpenChange={() => setResolveDialogGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How was this resolved?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {[
              { key: "fixed_in_lovable", label: "🔧 Fixed in Lovable" },
              { key: "fixed_itself", label: "✨ Fixed itself" },
              { key: "not_a_real_error", label: "❌ Not a real error" },
              { key: "other", label: "📝 Other" },
            ].map(opt => (
              <Button
                key={opt.key}
                variant="outline"
                className="justify-start h-12"
                onClick={() => resolveDialogGroup && resolveGroup(resolveDialogGroup, opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
