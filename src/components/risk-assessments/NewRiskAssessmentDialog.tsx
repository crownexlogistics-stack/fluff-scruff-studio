import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

interface HazardItem {
  hazard: string;
  who_harmed: string;
  existing_controls: string;
  additional_actions: string;
  who_responsible: string;
  from_when: string;
}

const emptyItem: HazardItem = {
  hazard: "", who_harmed: "", existing_controls: "",
  additional_actions: "", who_responsible: "", from_when: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewRiskAssessmentDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [assessedBy, setAssessedBy] = useState("");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [companyName, setCompanyName] = useState("Fluff and Scruff Studio");
  const [items, setItems] = useState<HazardItem[]>([{ ...emptyItem }]);

  const updateItem = (idx: number, field: keyof HazardItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems(prev => [...prev, { ...emptyItem }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!assessedBy || !assessmentDate || items.length === 0) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    const validItems = items.filter(i => i.hazard.trim());
    if (validItems.length === 0) {
      toast({ title: "Add at least one hazard", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data: assessment, error } = await supabase
      .from("risk_assessments")
      .insert({
        company_name: companyName,
        assessed_by: assessedBy,
        assessment_date: assessmentDate,
        created_by: user!.id,
      })
      .select("id")
      .single();

    if (error || !assessment) {
      toast({ title: "Error creating assessment", description: error?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const itemRows = validItems.map((item, idx) => ({
      assessment_id: assessment.id,
      item_number: idx + 1,
      hazard: item.hazard,
      who_harmed: item.who_harmed,
      existing_controls: item.existing_controls,
      additional_actions: item.additional_actions || null,
      who_responsible: item.who_responsible || null,
      from_when: item.from_when || null,
    }));

    const { error: itemsError } = await supabase.from("risk_assessment_items").insert(itemRows);
    if (itemsError) {
      toast({ title: "Error saving hazard items", description: itemsError.message, variant: "destructive" });
    } else {
      toast({ title: "Risk assessment created" });
      onCreated();
      // Reset
      setAssessedBy("");
      setAssessmentDate("");
      setItems([{ ...emptyItem }]);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading text-destructive">Risk Assessment</DialogTitle>
          <DialogDescription>Create a new workplace risk assessment</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Assessment Carried Out By *</Label>
              <Input value={assessedBy} onChange={e => setAssessedBy(e.target.value)} placeholder="Name (Role)" />
            </div>
            <div className="space-y-2">
              <Label>Date Assessment Carried Out *</Label>
              <Input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} />
            </div>
          </div>

          {/* Hazard items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Hazards</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Add Hazard
              </Button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">Hazard #{idx + 1}</span>
                  {items.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">What are the hazards? *</Label>
                  <Input value={item.hazard} onChange={e => updateItem(idx, "hazard", e.target.value)} placeholder="Something that could cause harm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Who might be harmed and how? *</Label>
                  <Textarea value={item.who_harmed} onChange={e => updateItem(idx, "who_harmed", e.target.value)} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">What are you currently doing? (Existing Controls) *</Label>
                  <Textarea value={item.existing_controls} onChange={e => updateItem(idx, "existing_controls", e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">What else needs to be done?</Label>
                  <Textarea value={item.additional_actions} onChange={e => updateItem(idx, "additional_actions", e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Who will do it?</Label>
                    <Input value={item.who_responsible} onChange={e => updateItem(idx, "who_responsible", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">From when?</Label>
                    <Input type="date" value={item.from_when} onChange={e => updateItem(idx, "from_when", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving…" : "Save Assessment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
