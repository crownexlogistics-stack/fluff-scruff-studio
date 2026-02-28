import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const SIZE_CATEGORIES = ["Small", "Medium", "Large", "Extra Large"] as const;

interface BreedForm {
  name: string;
  size_category: string;
  price_bath_brush: number;
  price_full_groom: number;
  duration_minutes: number;
}

const emptyForm: BreedForm = { name: "", size_category: "Medium", price_bath_brush: 0, price_full_groom: 0, duration_minutes: 60 };

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const DURATION_OPTIONS = [60, 90, 120, 150, 180];

const BreedsPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<BreedForm>(emptyForm);
  const [search, setSearch] = useState("");

  const { data: breeds, isLoading } = useQuery({
    queryKey: ["breeds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breeds").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (breed: BreedForm) => {
      const { error } = await supabase.from("breeds").insert(breed);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["breeds"] });
      toast.success("Breed added");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, breed }: { id: string; breed: BreedForm }) => {
      const { error } = await supabase.from("breeds").update(breed).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["breeds"] });
      toast.success("Breed updated");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("breeds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["breeds"] });
      toast.success("Breed deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };

  const openEdit = (breed: any) => {
    setEditId(breed.id);
    setForm({
      name: breed.name,
      size_category: breed.size_category,
      price_bath_brush: breed.price_bath_brush ?? 0,
      price_full_groom: breed.price_full_groom ?? 0,
      duration_minutes: breed.duration_minutes ?? 60,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (editId) {
      updateMutation.mutate({ id: editId, breed: form });
    } else {
      addMutation.mutate(form);
    }
  };

  const filtered = breeds?.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Breeds</h1>
            <p className="text-muted-foreground mt-1">Manage breeds, pricing & duration — Director only</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setForm(emptyForm); setEditId(null); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Breed
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">{editId ? "Edit Breed" : "Add New Breed"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Breed Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cockapoo" />
                </div>
                <div className="space-y-2">
                  <Label>Size Category</Label>
                  <Select value={form.size_category} onValueChange={(v) => setForm({ ...form, size_category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SIZE_CATEGORIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bath & Brush (£)</Label>
                    <Input type="number" min={0} step={1} value={form.price_bath_brush} onChange={(e) => setForm({ ...form, price_bath_brush: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Groom (£)</Label>
                    <Input type="number" min={0} step={1} value={form.price_full_groom} onChange={(e) => setForm({ ...form, price_full_groom: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select value={String(form.duration_minutes)} onValueChange={(v) => setForm({ ...form, duration_minutes: parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{formatDuration(d)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={addMutation.isPending || updateMutation.isPending}>
                  {editId ? "Save Changes" : "Add Breed"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Input placeholder="Search breeds…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Breed</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Bath & Brush</TableHead>
                  <TableHead className="text-right">Full Groom</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No breeds found.</TableCell></TableRow>
                ) : (
                  filtered?.map((breed) => (
                    <TableRow key={breed.id}>
                      <TableCell className="font-medium">{breed.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                          {breed.size_category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">£{breed.price_bath_brush}</TableCell>
                      <TableCell className="text-right">£{breed.price_full_groom}</TableCell>
                      <TableCell className="text-right">{formatDuration(breed.duration_minutes)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(breed)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(breed.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default BreedsPage;
