import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { toast } from "sonner";

interface Placement {
  id?: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  education_place: string | null;
  start_date: string;
  end_date: string | null;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  existing?: Placement | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function AddPlacementDialog({ open, onOpenChange, onSaved, existing }: Props) {
  const { staff } = useCurrentStaff();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Placement>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    education_place: "",
    start_date: today(),
    end_date: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      if (existing) {
        setForm({
          ...existing,
          email: existing.email ?? "",
          phone: existing.phone ?? "",
          emergency_contact_name: existing.emergency_contact_name ?? "",
          emergency_contact_phone: existing.emergency_contact_phone ?? "",
          education_place: existing.education_place ?? "",
          end_date: existing.end_date ?? "",
          notes: "",
        });
      } else {
        setForm({
          first_name: "", last_name: "", email: "", phone: "",
          emergency_contact_name: "", emergency_contact_phone: "",
          education_place: "", start_date: today(), end_date: "", notes: "",
        });
      }
    }
  }, [open, existing]);

  const update = (k: keyof Placement, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.education_place?.trim() || !form.start_date) {
      toast.error("First name, last name, college/university and start date are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        emergency_contact_name: form.emergency_contact_name?.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone?.trim() || null,
        education_place: form.education_place?.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
      };

      if (existing?.id) {
        const { error } = await supabase.from("work_placements").update(payload).eq("id", existing.id);
        if (error) throw error;
        toast.success("Placement updated");
      } else {
        const { data, error } = await supabase
          .from("work_placements")
          .insert({ ...payload, status: "active", added_by: staff?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;

        if (form.notes?.trim() && data?.id) {
          await supabase.from("placement_logs").insert({
            placement_id: data.id,
            staff_id: staff?.id ?? null,
            staff_name: staff?.name ?? null,
            log_entry: form.notes.trim(),
          });
        }
        toast.success(`${payload.first_name} ${payload.last_name} has been added to active placements`);
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save placement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Placement" : "Add New Placement"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fn">First name *</Label>
              <Input id="fn" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ln">Last name *</Label>
              <Input id="ln" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="edu">College or university *</Label>
            <Input id="edu" value={form.education_place ?? ""} onChange={(e) => update("education_place", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sd">Start date *</Label>
              <Input id="sd" type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ed">End date</Label>
              <Input id="ed" type="date" value={form.end_date ?? ""} onChange={(e) => update("end_date", e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="em">Contact email</Label>
            <Input id="em" type="email" value={form.email ?? ""} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ph">Contact phone</Label>
            <Input id="ph" type="tel" value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ecn">Emergency contact name</Label>
            <Input id="ecn" value={form.emergency_contact_name ?? ""} onChange={(e) => update("emergency_contact_name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ecp">Emergency contact phone</Label>
            <Input id="ecp" type="tel" value={form.emergency_contact_phone ?? ""} onChange={(e) => update("emergency_contact_phone", e.target.value)} />
          </div>
          {!existing && (
            <div>
              <Label htmlFor="nt">Initial notes</Label>
              <Textarea id="nt" rows={3} value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{existing ? "Save changes" : "Add Placement"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}