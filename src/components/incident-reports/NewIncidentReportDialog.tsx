import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface Staff {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewIncidentReportDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [personName, setPersonName] = useState("");
  const [personAddress, setPersonAddress] = useState("");
  const [personOccupation, setPersonOccupation] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterOccupation, setReporterOccupation] = useState("");
  const [accidentDate, setAccidentDate] = useState("");
  const [accidentTime, setAccidentTime] = useState("");
  const [accidentLocation, setAccidentLocation] = useState("");
  const [accidentDescription, setAccidentDescription] = useState("");
  const [injuryDescription, setInjuryDescription] = useState("");
  const [riddorReportable, setRiddorReportable] = useState(false);
  const [riddorReference, setRiddorReference] = useState("");
  const [involvedStaffId, setInvolvedStaffId] = useState("");
  const [witnessStaffIds, setWitnessStaffIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      supabase.from("staff").select("id, name").order("name").then(({ data }) => {
        setStaff(data || []);
      });
    }
  }, [open]);

  const resetForm = () => {
    setPersonName(""); setPersonAddress(""); setPersonOccupation("");
    setReporterName(""); setReporterOccupation("");
    setAccidentDate(""); setAccidentTime(""); setAccidentLocation("");
    setAccidentDescription(""); setInjuryDescription("");
    setRiddorReportable(false); setRiddorReference("");
    setInvolvedStaffId(""); setWitnessStaffIds([]);
  };

  const handleSubmit = async () => {
    if (!user || !personName || !reporterName || !accidentDate || !accidentDescription) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (!involvedStaffId) {
      toast({ title: "Please select the person involved from staff", variant: "destructive" });
      return;
    }

    setSaving(true);

    const { data: report, error } = await supabase
      .from("incident_reports")
      .insert({
        created_by: user.id,
        person_name: personName,
        person_address: personAddress || null,
        person_occupation: personOccupation || null,
        reporter_name: reporterName,
        reporter_occupation: reporterOccupation || null,
        accident_date: accidentDate,
        accident_time: accidentTime || null,
        accident_location: accidentLocation || null,
        accident_description: accidentDescription,
        injury_description: injuryDescription || null,
        riddor_reportable: riddorReportable,
        riddor_reference: riddorReference || null,
      })
      .select("id")
      .single();

    if (error || !report) {
      toast({ title: "Error creating report", description: error?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Add involved person as recipient
    const recipients = [
      { report_id: report.id, staff_id: involvedStaffId, recipient_type: "involved" },
      ...witnessStaffIds.map((sid) => ({
        report_id: report.id, staff_id: sid, recipient_type: "witness",
      })),
    ];

    const { error: recError } = await supabase.from("incident_report_recipients").insert(recipients);
    if (recError) {
      toast({ title: "Report created but error adding recipients", description: recError.message, variant: "destructive" });
    } else {
      toast({ title: "Incident report created successfully" });
    }

    setSaving(false);
    resetForm();
    onCreated();
  };

  const toggleWitness = (staffId: string) => {
    setWitnessStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading flex items-center gap-2">
            Accident / Incident Report Form
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Fluff & Scruff Studio — Health & Safety</p>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Section 1: Person Involved */}
          <div className="space-y-3">
            <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider">
              Section 1 — Person Involved
            </h3>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Occupation</Label>
                <Input value={personOccupation} onChange={(e) => setPersonOccupation(e.target.value)} placeholder="e.g. Groomer" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={personAddress} onChange={(e) => setPersonAddress(e.target.value)} placeholder="Address" />
            </div>
            <div className="space-y-1.5">
              <Label>Link to Staff Record *</Label>
              <Select value={involvedStaffId} onValueChange={setInvolvedStaffId}>
                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 2: Reporter */}
          <div className="space-y-3">
            <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider">
              Section 2 — Reporter Details
            </h3>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Reporter Name *</Label>
                <Input value={reporterName} onChange={(e) => setReporterName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-1.5">
                <Label>Occupation</Label>
                <Input value={reporterOccupation} onChange={(e) => setReporterOccupation(e.target.value)} placeholder="e.g. Director" />
              </div>
            </div>
          </div>

          {/* Section 3: Accident Details */}
          <div className="space-y-3">
            <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider">
              Section 3 — Accident / Incident Details
            </h3>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={accidentDate} onChange={(e) => setAccidentDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input type="time" value={accidentTime} onChange={(e) => setAccidentTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={accidentLocation} onChange={(e) => setAccidentLocation(e.target.value)} placeholder="Where it happened" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description of what happened *</Label>
              <Textarea value={accidentDescription} onChange={(e) => setAccidentDescription(e.target.value)} placeholder="Describe the incident in detail..." rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Details of any injuries</Label>
              <Textarea value={injuryDescription} onChange={(e) => setInjuryDescription(e.target.value)} placeholder="Describe any injuries sustained..." rows={3} />
            </div>
          </div>

          {/* Section 4: Witnesses */}
          <div className="space-y-3">
            <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider">
              Witnesses
            </h3>
            <Separator />
            <p className="text-sm text-muted-foreground">Select any staff members who witnessed the incident:</p>
            <div className="grid grid-cols-2 gap-2">
              {staff.filter((s) => s.id !== involvedStaffId).map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={witnessStaffIds.includes(s.id)}
                    onCheckedChange={() => toggleWitness(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          {/* Section 5: RIDDOR */}
          <div className="space-y-3">
            <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider">
              RIDDOR Reporting
            </h3>
            <Separator />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={riddorReportable} onCheckedChange={(v) => setRiddorReportable(!!v)} />
              This incident is RIDDOR reportable
            </label>
            {riddorReportable && (
              <div className="space-y-1.5">
                <Label>RIDDOR Reference Number</Label>
                <Input value={riddorReference} onChange={(e) => setRiddorReference(e.target.value)} placeholder="Reference number" />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : "Create & Send to Recipients"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
