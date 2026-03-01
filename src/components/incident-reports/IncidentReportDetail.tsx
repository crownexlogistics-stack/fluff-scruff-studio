import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { CheckCircle, Clock, User, Eye } from "lucide-react";

interface Recipient {
  id: string;
  recipient_type: string;
  has_read: boolean;
  notes: string | null;
  signed_name: string | null;
  signed_at: string | null;
  staff: { name: string } | null;
}

interface Report {
  id: string;
  person_name: string;
  person_address: string | null;
  person_occupation: string | null;
  reporter_name: string;
  reporter_occupation: string | null;
  accident_date: string;
  accident_time: string | null;
  accident_location: string | null;
  accident_description: string;
  injury_description: string | null;
  riddor_reportable: boolean;
  riddor_reference: string | null;
  employer_signed_by: string | null;
  employer_signed_at: string | null;
  status: string;
  created_at: string;
}

interface Props {
  reportId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function IncidentReportDetail({ reportId, open, onOpenChange, onUpdated }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !reportId) return;
    setLoading(true);

    Promise.all([
      supabase.from("incident_reports").select("*").eq("id", reportId).single(),
      supabase.from("incident_report_recipients").select("*, staff(name)").eq("report_id", reportId),
    ]).then(([reportRes, recipientRes]) => {
      if (reportRes.error) console.error(reportRes.error);
      if (recipientRes.error) console.error(recipientRes.error);
      setReport(reportRes.data as Report | null);
      setRecipients((recipientRes.data as unknown as Recipient[]) || []);
      setLoading(false);
    });
  }, [open, reportId]);

  if (!open) return null;

  const field = (label: string, value: string | null | undefined) => (
    value ? (
      <div>
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <p className="text-sm text-foreground mt-0.5">{value}</p>
      </div>
    ) : null
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">Incident Report</DialogTitle>
        </DialogHeader>

        {loading || !report ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Person Involved */}
            <div className="space-y-2">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wider">Person Involved</h3>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                {field("Name", report.person_name)}
                {field("Occupation", report.person_occupation)}
                {field("Address", report.person_address)}
              </div>
            </div>

            {/* Reporter */}
            <div className="space-y-2">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wider">Reporter</h3>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                {field("Name", report.reporter_name)}
                {field("Occupation", report.reporter_occupation)}
              </div>
            </div>

            {/* Accident Details */}
            <div className="space-y-2">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wider">Accident Details</h3>
              <Separator />
              <div className="grid grid-cols-3 gap-3">
                {field("Date", format(new Date(report.accident_date), "d MMM yyyy"))}
                {field("Time", report.accident_time)}
                {field("Location", report.accident_location)}
              </div>
              {field("Description", report.accident_description)}
              {field("Injuries", report.injury_description)}
            </div>

            {/* RIDDOR */}
            {report.riddor_reportable && (
              <div className="space-y-2">
                <h3 className="font-heading text-sm font-semibold uppercase tracking-wider">RIDDOR</h3>
                <Separator />
                <Badge variant="destructive">RIDDOR Reportable</Badge>
                {field("Reference", report.riddor_reference)}
              </div>
            )}

            {/* Recipients / Signatures */}
            <div className="space-y-2">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wider">Recipients & Signatures</h3>
              <Separator />
              <div className="space-y-3">
                {recipients.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border/60 bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{r.staff?.name || "Unknown"}</span>
                        <Badge variant="outline" className="text-xs capitalize">{r.recipient_type}</Badge>
                      </div>
                      {r.signed_name ? (
                        <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                          <CheckCircle className="h-3 w-3 mr-1" /> Signed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                          <Clock className="h-3 w-3 mr-1" /> Awaiting
                        </Badge>
                      )}
                    </div>
                    {r.notes && (
                      <div className="mt-2 text-sm text-muted-foreground bg-background rounded-lg p-3">
                        <Eye className="h-3 w-3 inline mr-1" />Notes: {r.notes}
                      </div>
                    )}
                    {r.signed_name && r.signed_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Signed as "{r.signed_name}" on {format(new Date(r.signed_at), "d MMM yyyy 'at' HH:mm")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
