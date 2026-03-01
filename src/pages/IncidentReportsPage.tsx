import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { NewIncidentReportDialog } from "@/components/incident-reports/NewIncidentReportDialog";
import { IncidentReportDetail } from "@/components/incident-reports/IncidentReportDetail";

interface IncidentReport {
  id: string;
  person_name: string;
  reporter_name: string;
  accident_date: string;
  accident_description: string;
  status: string;
  created_at: string;
  riddor_reportable: boolean;
}

const IncidentReportsPage = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("incident_reports")
      .select("id, person_name, reporter_name, accident_date, accident_description, status, created_at, riddor_reportable")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast({ title: "Error loading reports", description: error.message, variant: "destructive" });
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "completed":
        return <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading text-foreground">Incident Reports</h1>
            <p className="text-muted-foreground text-sm mt-1">Accident & incident report forms</p>
          </div>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Report
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground font-body">No incident reports yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className="w-full text-left rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-foreground">{r.person_name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(r.accident_date), "EEE d MMM yyyy")} — Reported by {r.reporter_name}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-1">{r.accident_description}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {r.riddor_reportable && (
                      <Badge variant="destructive" className="text-xs">RIDDOR</Badge>
                    )}
                    {statusBadge(r.status)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <NewIncidentReportDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={() => {
          setShowNew(false);
          fetchReports();
        }}
      />

      {selectedId && (
        <IncidentReportDetail
          reportId={selectedId}
          open={!!selectedId}
          onOpenChange={(open) => { if (!open) setSelectedId(null); }}
          onUpdated={fetchReports}
        />
      )}
    </AppLayout>
  );
};

export default IncidentReportsPage;
