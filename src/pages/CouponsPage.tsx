import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Ticket, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CouponUsageHistory } from "@/components/coupons/CouponUsageHistory";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  times_used: number;
  min_order_amount: number;
  created_at: string;
}

const emptyCoupon = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: 0,
  is_active: true,
  start_date: "",
  end_date: "",
  max_uses: "",
  max_uses_per_customer: "1",
  min_order_amount: "0",
};

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCoupon);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.code.trim()) throw new Error("Code is required");
      if (form.discount_value <= 0) throw new Error("Discount must be greater than 0");
      if (form.discount_type === "percentage" && form.discount_value > 100) throw new Error("Percentage can't exceed 100");

      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        is_active: form.is_active,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        max_uses_per_customer: form.max_uses_per_customer ? Number(form.max_uses_per_customer) : null,
        min_order_amount: Number(form.min_order_amount) || 0,
      };

      if (editingId) {
        const { error } = await supabase.from("coupons").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success(editingId ? "Coupon updated" : "Coupon created");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyCoupon);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Coupon deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("coupons").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const openEdit = (coupon: Coupon) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      is_active: coupon.is_active,
      start_date: coupon.start_date || "",
      end_date: coupon.end_date || "",
      max_uses: coupon.max_uses?.toString() || "",
      max_uses_per_customer: coupon.max_uses_per_customer?.toString() || "1",
      min_order_amount: coupon.min_order_amount?.toString() || "0",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyCoupon);
    setDialogOpen(true);
  };

  const getStatusBadge = (coupon: Coupon) => {
    if (!coupon.is_active) return <Badge variant="secondary">Inactive</Badge>;
    const now = new Date();
    if (coupon.start_date && new Date(coupon.start_date) > now) return <Badge variant="outline">Scheduled</Badge>;
    if (coupon.end_date && new Date(coupon.end_date) < now) return <Badge variant="destructive">Expired</Badge>;
    if (coupon.max_uses && coupon.times_used >= coupon.max_uses) return <Badge variant="destructive">Used up</Badge>;
    return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Active</Badge>;
  };

  return (
    <AppLayout>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Coupons</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage discount codes for your customers</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          New Coupon
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !coupons?.length ? (
        <div className="text-center py-20 space-y-3">
          <Ticket className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground">No coupons yet</p>
          <Button onClick={openNew} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Create your first coupon
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <>
                <TableRow key={coupon.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === coupon.id ? null : coupon.id)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {expandedId === coupon.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      <code className="font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded text-sm">
                        {coupon.code}
                      </code>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(coupon.code); toast.success("Copied!"); }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {coupon.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-5">{coupon.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {coupon.discount_type === "percentage"
                        ? `${coupon.discount_value}%`
                        : `£${Number(coupon.discount_value).toFixed(2)}`}
                    </span>
                    {coupon.min_order_amount > 0 && (
                      <p className="text-xs text-muted-foreground">Min £{Number(coupon.min_order_amount).toFixed(2)}</p>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(coupon)}</TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {coupon.times_used}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                    </span>
                    {coupon.max_uses_per_customer && (
                      <p className="text-xs text-muted-foreground">{coupon.max_uses_per_customer}x per customer</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {coupon.start_date && coupon.end_date
                      ? `${format(new Date(coupon.start_date), "dd MMM")} – ${format(new Date(coupon.end_date), "dd MMM yy")}`
                      : coupon.start_date
                        ? `From ${format(new Date(coupon.start_date), "dd MMM yy")}`
                        : coupon.end_date
                          ? `Until ${format(new Date(coupon.end_date), "dd MMM yy")}`
                          : "Ongoing"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={coupon.is_active}
                        onCheckedChange={(checked) => toggleActive.mutate({ id: coupon.id, active: checked })}
                      />
                      <button onClick={() => openEdit(coupon)} className="p-1.5 hover:bg-muted rounded">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Delete this coupon?")) deleteMutation.mutate(coupon.id); }}
                        className="p-1.5 hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedId === coupon.id && (
                  <TableRow key={`${coupon.id}-usage`}>
                    <TableCell colSpan={6} className="bg-muted/30 p-4">
                      <h4 className="text-sm font-semibold mb-2">Usage History</h4>
                      <CouponUsageHistory couponId={coupon.id} couponCode={coupon.code} />
                    </TableCell>
                  </TableRow>
                )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editingId ? "Edit Coupon" : "New Coupon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER20"
                  className="font-mono uppercase"
                  maxLength={20}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Discount Value *</Label>
                <NumericInput
                  value={form.discount_value}
                  onValueChange={(v) => setForm({ ...form, discount_value: v })}
                  placeholder={form.discount_type === "percentage" ? "20" : "5.00"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Min Order (£)</Label>
                <NumericInput
                  value={form.min_order_amount}
                  onValueChange={(v) => setForm({ ...form, min_order_amount: String(v) })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Summer special discount"
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Leave blank for immediate</p>
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Leave blank for ongoing</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Total Uses Limit</Label>
                <NumericInput
                  value={form.max_uses}
                  onValueChange={(v) => setForm({ ...form, max_uses: String(v) })}
                  allowDecimals={false}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Per Customer Limit</Label>
                <NumericInput
                  value={form.max_uses_per_customer}
                  onValueChange={(v) => setForm({ ...form, max_uses_per_customer: String(v) })}
                  allowDecimals={false}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {editingId ? "Save Changes" : "Create Coupon"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  );
}
