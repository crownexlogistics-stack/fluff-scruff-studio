import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Sparkles, Dog, X, Check } from "lucide-react";

const ICON_OPTIONS = [
  { label: "Sparkles", value: "Sparkles", icon: Sparkles },
  { label: "Dog", value: "Dog", icon: Dog },
];

export default function AddOnsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", price: "", icon: "Sparkles", description: "", serviceIds: [] as string[] });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", price: "", icon: "Sparkles", description: "", serviceIds: [] as string[] });

  const { data: addOns, isLoading } = useQuery({
    queryKey: ["add_ons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("add_ons").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: addOnServices } = useQuery({
    queryKey: ["add_on_services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("add_on_services").select("add_on_id, service_id");
      if (error) throw error;
      return data;
    },
  });

  const getLinkedServiceIds = (addOnId: string) =>
    addOnServices?.filter((r) => r.add_on_id === addOnId).map((r) => r.service_id) ?? [];

  const getLinkedServiceNames = (addOnId: string) => {
    const ids = getLinkedServiceIds(addOnId);
    if (!services || ids.length === 0) return "No services";
    if (ids.length === services.length) return "All services";
    return ids.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean).join(", ");
  };

  const saveServiceLinks = async (addOnId: string, serviceIds: string[]) => {
    // Delete existing links
    await supabase.from("add_on_services").delete().eq("add_on_id", addOnId);
    // Insert new links
    if (serviceIds.length > 0) {
      const rows = serviceIds.map((service_id) => ({ add_on_id: addOnId, service_id }));
      await supabase.from("add_on_services").insert(rows);
    }
  };

  const upsertMutation = useMutation({
    mutationFn: async (vals: { id?: string; name: string; price: number; icon: string; description: string; serviceIds: string[] }) => {
      let addOnId = vals.id;
      if (vals.id) {
        const { error } = await supabase.from("add_ons").update({ name: vals.name, price: vals.price, icon: vals.icon, description: vals.description || null } as any).eq("id", vals.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("add_ons").insert({ name: vals.name, price: vals.price, icon: vals.icon, description: vals.description || null } as any).select("id").single();
        if (error) throw error;
        addOnId = data.id;
      }
      await saveServiceLinks(addOnId!, vals.serviceIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["add_ons"] });
      queryClient.invalidateQueries({ queryKey: ["add_on_services"] });
      setEditingId(null);
      setShowAdd(false);
      setAddForm({ name: "", price: "", icon: "Sparkles", description: "", serviceIds: [] });
      toast.success("Saved!");
    },
    onError: () => toast.error("Failed to save"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("add_ons").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["add_ons"] }),
    onError: () => toast.error("Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("add_ons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["add_ons"] });
      queryClient.invalidateQueries({ queryKey: ["add_on_services"] });
      toast.success("Deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const getIcon = (iconName: string) => {
    const found = ICON_OPTIONS.find(i => i.value === iconName);
    return found ? found.icon : Sparkles;
  };

  const toggleServiceInForm = (form: { serviceIds: string[] }, setForm: Function, serviceId: string) => {
    const ids = form.serviceIds.includes(serviceId)
      ? form.serviceIds.filter((id) => id !== serviceId)
      : [...form.serviceIds, serviceId];
    setForm({ ...form, serviceIds: ids });
  };

  const ServiceCheckboxes = ({ selectedIds, onToggle }: { selectedIds: string[]; onToggle: (id: string) => void }) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">Show for services</label>
      <div className="flex flex-wrap gap-3 pt-1">
        {services?.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={selectedIds.includes(s.id)}
              onCheckedChange={() => onToggle(s.id)}
            />
            {s.name}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Add-Ons</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage extras customers can add to bookings</p>
          </div>
          <Button onClick={() => setShowAdd(true)} disabled={showAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Add-On
          </Button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-fade-in">
            <div className="grid grid-cols-[1fr_100px_100px] gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g. Teeth Cleaning" className="h-10" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Price (£)</label>
                <NumericInput value={addForm.price} onValueChange={(v) => setAddForm({ ...addForm, price: String(v) })} className="h-10" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Icon</label>
                <select value={addForm.icon} onChange={e => setAddForm({ ...addForm, icon: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                  {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Description (shown to customers)</label>
              <Input value={addForm.description} onChange={e => setAddForm({ ...addForm, description: e.target.value })} placeholder="What does this include?" className="h-10" />
            </div>
            <ServiceCheckboxes
              selectedIds={addForm.serviceIds}
              onToggle={(id) => toggleServiceInForm(addForm, setAddForm, id)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" disabled={!addForm.name.trim() || !addForm.price} onClick={() => upsertMutation.mutate({ name: addForm.name, price: parseFloat(addForm.price), icon: addForm.icon, description: addForm.description, serviceIds: addForm.serviceIds })}>
                <Check className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {addOns?.map((addon) => {
            const Icon = getIcon(addon.icon ?? "Sparkles");
            const isEditing = editingId === addon.id;

            if (isEditing) {
              return (
                <div key={addon.id} className="rounded-xl border border-accent bg-accent/5 p-4 space-y-3">
                  <div className="grid grid-cols-[1fr_100px_100px] gap-3 items-end">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Name</label>
                      <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-10" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Price (£)</label>
                      <NumericInput value={editForm.price} onValueChange={(v) => setEditForm({ ...editForm, price: String(v) })} className="h-10" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Icon</label>
                      <select value={editForm.icon} onChange={e => setEditForm({ ...editForm, icon: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                        {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Description (shown to customers)</label>
                    <Input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="What does this include?" className="h-10" />
                  </div>
                  <ServiceCheckboxes
                    selectedIds={editForm.serviceIds}
                    onToggle={(id) => toggleServiceInForm(editForm, setEditForm, id)}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                    <Button size="sm" onClick={() => upsertMutation.mutate({ id: addon.id, name: editForm.name, price: parseFloat(editForm.price), icon: editForm.icon, description: editForm.description, serviceIds: editForm.serviceIds })}>
                      <Check className="h-4 w-4 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={addon.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 transition-all hover:shadow-sm">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${addon.is_active ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{addon.name}</p>
                  <p className="text-sm text-muted-foreground">£{Number(addon.price).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground/70 truncate">{getLinkedServiceNames(addon.id)}</p>
                </div>
                <Switch checked={addon.is_active} onCheckedChange={(checked) => toggleMutation.mutate({ id: addon.id, is_active: checked })} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingId(addon.id); setEditForm({ name: addon.name, price: String(addon.price), icon: addon.icon ?? "Sparkles", description: (addon as any).description ?? "", serviceIds: getLinkedServiceIds(addon.id) }); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this add-on?")) deleteMutation.mutate(addon.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
