import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";
import { toast } from "sonner";

const REQUEST_METHODS = [
  { value: "in_person", label: "In Person" },
  { value: "phone", label: "Phone Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "Other" },
];

export function AddPurchaseTab() {
  const queryClient = useQueryClient();
  const [wasRequested, setWasRequested] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", product_link: "", quantity: 1, unit_price: "",
    supplier: "", assigned_to: "", assignment_type: "salon", notes: "",
    requested_by_groomer: "", request_method: "in_person",
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const totalPrice = form.unit_price ? Number(form.unit_price) * form.quantity : null;
      const groomerName = wasRequested && form.requested_by_groomer
        ? staffList.find(s => s.id === form.requested_by_groomer)?.name
        : null;
      const methodLabel = REQUEST_METHODS.find(m => m.value === form.request_method)?.label || form.request_method;
      let notes = form.notes || "";
      if (wasRequested && groomerName) {
        const prefix = `${groomerName} requested this ${methodLabel?.toLowerCase()}`;
        notes = prefix + (notes ? ` — ${notes}` : "");
      }

      const { error } = await (supabase.from("purchases" as any) as any).insert({
        title: form.title,
        description: form.description || null,
        product_link: form.product_link || null,
        quantity: form.quantity,
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        total_price: totalPrice,
        supplier: form.supplier || null,
        assigned_to: form.assignment_type === "groomer" && form.assigned_to ? form.assigned_to : null,
        assignment_type: form.assignment_type,
        notes: notes || null,
        requested_by_groomer: wasRequested && form.requested_by_groomer ? form.requested_by_groomer : null,
        request_method: wasRequested ? form.request_method : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases-history"] });
      setForm({ title: "", description: "", product_link: "", quantity: 1, unit_price: "", supplier: "", assigned_to: "", assignment_type: "salon", notes: "", requested_by_groomer: "", request_method: "in_person" });
      setWasRequested(false);
      toast.success("Purchase saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Log a Direct Purchase</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* Was this requested toggle */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Switch checked={wasRequested} onCheckedChange={setWasRequested} />
          <Label className="text-sm">Was this requested by a groomer?</Label>
        </div>

        {wasRequested && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Requested by</Label>
              <Select value={form.requested_by_groomer} onValueChange={(v) => setForm({ ...form, requested_by_groomer: v })}>
                <SelectTrigger><SelectValue placeholder="Select groomer" /></SelectTrigger>
                <SelectContent>{staffList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>How was this requested?</Label>
              <Select value={form.request_method} onValueChange={(v) => setForm({ ...form, request_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REQUEST_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-1"><Label>Item Name *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Slicker brush, Shampoo" /></div>
        <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details" /></div>
        <div className="space-y-1"><Label>Product Link</Label><Input value={form.product_link} onChange={(e) => setForm({ ...form, product_link: e.target.value })} placeholder="https://..." /></div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1"><Label>Quantity</Label><Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} /></div>
          <div className="space-y-1"><Label>Unit Price (£)</Label><Input type="number" step="0.01" placeholder="Optional" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
          <div className="space-y-1"><Label>Supplier</Label><Input placeholder="e.g. Amazon" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
        </div>

        <div className="space-y-1">
          <Label>Assign to</Label>
          <Select value={form.assignment_type} onValueChange={(v) => setForm({ ...form, assignment_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="salon">Salon — Shared</SelectItem>
              <SelectItem value="groomer">Specific Groomer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.assignment_type === "groomer" && (
          <div className="space-y-1">
            <Label>Groomer</Label>
            <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
              <SelectTrigger><SelectValue placeholder="Select groomer" /></SelectTrigger>
              <SelectContent>{staffList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></div>

        <Button onClick={() => saveMutation.mutate()} disabled={!form.title || saveMutation.isPending}>
          <Save className="h-4 w-4 mr-1" /> Save Purchase
        </Button>
      </CardContent>
    </Card>
  );
}
