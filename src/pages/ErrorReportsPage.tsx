import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

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
}

const statusColors: Record<string, string> = {
  new: "bg-red-500 text-white",
  in_progress: "bg-orange-500 text-white",
  resolved: "bg-emerald-500 text-white",
};

export default function ErrorReportsPage() {
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  const fetchReports = async () => {
    let query = supabase.from("error_reports" as any).select("*").order("created_at", { ascending: false });
    if (filter !== "all") {
      query = query.eq("status", filter);
    }
    const { data } = await query;
    setReports((data as any as ErrorReport[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("error_reports" as any).update({ status } as any).eq("id", id);
    fetchReports();
  };

  const saveNotes = async (id: string) => {
    await supabase.from("error_reports" as any).update({ admin_notes: editingNotes[id] } as any).eq("id", id);
    fetchReports();
  };

  const newCount = reports.filter(r => r.status === "new").length;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Error Reports</h1>
            <p className="text-sm text-muted-foreground">Customer-reported issues</p>
          </div>
          {newCount > 0 && (
            <Badge className="bg-red-500 text-white text-sm px-3 py-1">{newCount} New</Badge>
          )}
        </div>

        <div className="flex gap-2">
          {["all", "new", "in_progress", "resolved"].map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
              className="capitalize"
            >
              {s.replace("_", " ")}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No reports found.</div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const expanded = expandedId === report.id;
              return (
                <div key={report.id} className="bg-card border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expanded ? null : report.id)}
                    className="w-full p-4 flex items-start justify-between text-left"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={statusColors[report.status] || "bg-gray-500 text-white"}>
                          {report.status.replace("_", " ").toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(report.created_at), "dd MMM yyyy, HH:mm")}
                        </span>
                        {report.customer_email && (
                          <span className="text-xs text-muted-foreground truncate">
                            — {report.customer_email}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">{report.error_description}</p>
                      <p className="text-xs text-muted-foreground truncate">{report.page_url}</p>
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 shrink-0 mt-1" />}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 space-y-4 border-t pt-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">What they were doing</p>
                          <p className="text-sm">{report.steps_to_reproduce}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">What went wrong</p>
                          <p className="text-sm">{report.error_description}</p>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">Browser</p>
                          <p className="break-all">{report.browser_info || "N/A"}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">Device</p>
                          <p>{report.device_info || "N/A"}</p>
                        </div>
                      </div>

                      {report.customer_email && (
                        <div className="text-xs">
                          <p className="font-semibold text-muted-foreground mb-1">Customer</p>
                          <p>{report.customer_name || "Unknown"} — {report.customer_email}</p>
                        </div>
                      )}

                      {report.screenshot_url && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Screenshot</p>
                          <a href={report.screenshot_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" /> View Screenshot
                          </a>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground">Status:</p>
                        <Select value={report.status} onValueChange={(v) => updateStatus(report.id, v)}>
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Admin Notes</p>
                        <Textarea
                          value={editingNotes[report.id] ?? report.admin_notes ?? ""}
                          onChange={(e) => setEditingNotes({ ...editingNotes, [report.id]: e.target.value })}
                          rows={2}
                          placeholder="Add internal notes..."
                          className="text-sm"
                        />
                        <Button size="sm" className="mt-2" onClick={() => saveNotes(report.id)}>
                          Save Notes
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
