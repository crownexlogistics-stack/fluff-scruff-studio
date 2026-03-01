import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, ShieldCheck, FileText } from "lucide-react";
import { format } from "date-fns";
import { NewRiskAssessmentDialog } from "@/components/risk-assessments/NewRiskAssessmentDialog";
import { RiskAssessmentDetail } from "@/components/risk-assessments/RiskAssessmentDetail";

interface RiskAssessment {
  id: string;
  company_name: string;
  assessed_by: string;
  assessment_date: string;
  status: string;
  created_at: string;
}

const RiskAssessmentsPage = () => {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAssessments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("risk_assessments")
      .select("id, company_name, assessed_by, assessment_date, status, created_at")
      .order("assessment_date", { ascending: false });

    if (error) {
      console.error(error);
      toast({ title: "Error loading assessments", description: error.message, variant: "destructive" });
    } else {
      setAssessments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading text-foreground">Risk Assessments</h1>
            <p className="text-muted-foreground text-sm mt-1">Workplace risk assessment records</p>
          </div>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Assessment
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : assessments.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground font-body">No risk assessments yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assessments.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className="w-full text-left rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">Risk Assessment</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(a.assessment_date), "EEE d MMM yyyy")} — Assessed by {a.assessed_by}
                    </p>
                    <p className="text-sm text-muted-foreground">{a.company_name}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={a.status === "active"
                      ? "border-green-300 text-green-700 bg-green-50"
                      : "border-muted text-muted-foreground"}
                  >
                    {a.status === "active" ? "Active" : a.status}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <NewRiskAssessmentDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={() => {
          setShowNew(false);
          fetchAssessments();
        }}
      />

      {selectedId && (
        <RiskAssessmentDetail
          assessmentId={selectedId}
          open={!!selectedId}
          onOpenChange={(open) => { if (!open) setSelectedId(null); }}
          onUpdated={fetchAssessments}
        />
      )}
    </AppLayout>
  );
};

export default RiskAssessmentsPage;
