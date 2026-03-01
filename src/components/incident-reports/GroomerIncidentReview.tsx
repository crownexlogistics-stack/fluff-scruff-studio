import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { AlertTriangle, FileText } from "lucide-react";

interface PendingReport {
  id: string;
  recipient_id: string;
  recipient_type: string;
  report: {
    id: string;
    person_name: string;
    reporter_name: string;
    accident_date: string;
    accident_time: string | null;
    accident_location: string | null;
    accident_description: string;
    injury_description: string | null;
    riddor_reportable: boolean;
  };
}

export function GroomerDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PendingReport | null>(null);
  const [notes, setNotes] = useState("");
  const [signedName, setSignedName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPending = async () => {
    if (!user) return;
    setLoading(true);

    // Get staff record for this user
    const { data: staffRecord } = await supabase
      .from("staff")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!staffRecord) {
      setPending([]);
      setLoading(false);
      return;
    }

    // Get unsigned recipient records
    const { data: recipients, error } = await supabase
      .from("incident_report_recipients")
      .select("id, recipient_type, report_id, incident_reports(id, person_name, reporter_name, accident_date, accident_time, accident_location, accident_description, injury_description, riddor_reportable)")
      .eq("staff_id", staffRecord.id)
      .is("signed_at", null);

    if (error) {
      console.error(error);
      setPending([]);
    } else {
      const mapped = (recipients || []).map((r: any) => ({
        id: r.id,
        recipient_id: r.id,
        recipient_type: r.recipient_type,
        report: r.incident_reports,
      })).filter((r: any) => r.report);
      setPending(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, [user]);

  const handleSign = async () => {
    if (!selected || !signedName.trim()) {
      toast({ title: "Please type your full name to sign", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("incident_report_recipients")
      .update({
        has_read: true,
        notes: notes || null,
        signed_name: signedName,
        signed_at: new Date().toISOString(),
      })
      .eq("id", selected.recipient_id);

    if (error) {
      toast({ title: "Error signing", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Report signed successfully" });
      setSelected(null);
      setNotes("");
      setSignedName("");
      fetchPending();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto" />
        <p className="text-muted-foreground text-sm">No documents requiring your attention.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {pending.map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelected(p); setNotes(""); setSignedName(""); }}
            className="w-full text-left rounded-2xl border border-amber-200 bg-amber-50/50 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="font-semibold text-foreground text-sm">Incident Report — {p.report.person_name}</span>
              <Badge variant="outline" className="text-xs capitalize ml-auto">{p.recipient_type}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(p.report.accident_date), "d MMM yyyy")} — Reported by {p.report.reporter_name}
            </p>
          </button>
        ))}
      </div>

      {/* Review & Sign Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Review Incident Report</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-muted/40 p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground text-xs">Person Involved:</span><p className="font-medium">{selected.report.person_name}</p></div>
                  <div><span className="text-muted-foreground text-xs">Date:</span><p className="font-medium">{format(new Date(selected.report.accident_date), "d MMM yyyy")}</p></div>
                  {selected.report.accident_time && <div><span className="text-muted-foreground text-xs">Time:</span><p>{selected.report.accident_time}</p></div>}
                  {selected.report.accident_location && <div><span className="text-muted-foreground text-xs">Location:</span><p>{selected.report.accident_location}</p></div>}
                </div>
                <Separator />
                <div>
                  <span className="text-muted-foreground text-xs">Description:</span>
                  <p className="text-sm mt-1">{selected.report.accident_description}</p>
                </div>
                {selected.report.injury_description && (
                  <div>
                    <span className="text-muted-foreground text-xs">Injuries:</span>
                    <p className="text-sm mt-1">{selected.report.injury_description}</p>
                  </div>
                )}
                {selected.report.riddor_reportable && (
                  <Badge variant="destructive" className="text-xs">RIDDOR Reportable</Badge>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Your Notes (optional)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any additional notes or comments..." rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type your full name to sign *</Label>
                  <Input value={signedName} onChange={(e) => setSignedName(e.target.value)} placeholder="Full name" />
                  {signedName && (
                    <p className="font-['Dancing_Script',cursive] text-2xl text-primary mt-1">{signedName}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleSign} disabled={saving || !signedName.trim()}>
              {saving ? "Signing..." : "Sign & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
