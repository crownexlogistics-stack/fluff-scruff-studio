import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface AssessmentItem {
  id: string;
  item_number: number;
  hazard: string;
  who_harmed: string;
  existing_controls: string;
  additional_actions: string | null;
  who_responsible: string | null;
  from_when: string | null;
}

interface Assessment {
  id: string;
  company_name: string;
  assessed_by: string;
  assessment_date: string;
  status: string;
}

interface Props {
  assessmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function RiskAssessmentDetail({ assessmentId, open, onOpenChange, onUpdated }: Props) {
  const { toast } = useToast();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assessmentId) return;
    const fetch = async () => {
      setLoading(true);
      const [aRes, iRes] = await Promise.all([
        supabase.from("risk_assessments").select("*").eq("id", assessmentId).single(),
        supabase.from("risk_assessment_items").select("*").eq("assessment_id", assessmentId).order("item_number"),
      ]);
      if (aRes.error) {
        toast({ title: "Error loading assessment", variant: "destructive" });
      } else {
        setAssessment(aRes.data);
      }
      setItems(iRes.data || []);
      setLoading(false);
    };
    fetch();
  }, [assessmentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading text-destructive">Risk Assessment</DialogTitle>
          <DialogDescription>View risk assessment details</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : assessment && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 rounded-xl p-4">
              <div>
                <p className="text-xs text-muted-foreground">Company Name</p>
                <p className="font-medium text-foreground">{assessment.company_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Assessment Carried Out By</p>
                <p className="font-medium text-foreground">{assessment.assessed_by}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date Assessment Carried Out</p>
                <p className="font-medium text-foreground">{format(new Date(assessment.assessment_date), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 mt-1">
                  {assessment.status === "active" ? "Active" : assessment.status}
                </Badge>
              </div>
            </div>

            {/* Hazards table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border p-2 text-left font-semibold text-foreground w-[18%]">What are the hazards?<br/><span className="font-normal text-xs text-muted-foreground">(Something that could cause harm)</span></th>
                    <th className="border border-border p-2 text-left font-semibold text-foreground w-[15%]">Who might be harmed and how?</th>
                    <th className="border border-border p-2 text-left font-semibold text-foreground w-[20%]">What are you currently doing?<br/><span className="font-normal text-xs text-muted-foreground">(Existing Controls)</span></th>
                    <th className="border border-border p-2 text-left font-semibold text-foreground w-[22%]">What else needs to be done?</th>
                    <th className="border border-border p-2 text-left font-semibold text-foreground w-[12%]">Who will do it?</th>
                    <th className="border border-border p-2 text-left font-semibold text-foreground w-[13%]">From when?</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="border border-border p-2 font-medium text-foreground">{item.item_number}. {item.hazard}</td>
                      <td className="border border-border p-2 text-foreground whitespace-pre-wrap">{item.who_harmed}</td>
                      <td className="border border-border p-2 text-foreground whitespace-pre-wrap">{item.existing_controls}</td>
                      <td className="border border-border p-2 text-foreground whitespace-pre-wrap">{item.additional_actions || "—"}</td>
                      <td className="border border-border p-2 text-foreground">{item.who_responsible || "—"}</td>
                      <td className="border border-border p-2 text-foreground">{item.from_when ? format(new Date(item.from_when), "dd/MM/yyyy") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
