import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, ExternalLink, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export function PendingRequestsTab() {
  const queryClient = useQueryClient();
  const [purchaseDialog, setPurchaseDialog] = useState<any>(null);
  const [declineDialog, setDeclineDialog] = useState<any>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [purchaseForm, setPurchaseForm] = useState({ quantity: 1, unit_price: "", supplier: "", assigned_to: "", assignment_type: "salon", notes: "" });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["purchase-requests-pending"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("purchase_requests" as any) as any)
        .select("*, staff:requested_by(id, name)")
        .in("status", ["pending"])
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const markPurchasedMutation = useMutation({
    mutationFn: async () => {
      const req = purchaseDialog;
      const totalPrice = purchaseForm.unit_price ? Number(purchaseForm.unit_price) * purchaseForm.quantity : null;
      const { error: pErr } = await (supabase.from("purchases" as any) as any).insert({
        request_id: req.id,
        title: req.title,
        description: req.description,
        product_link: req.product_link,
        image_url: req.image_url,
        quantity: purchaseForm.quantity,
        unit_price: purchaseForm.unit_price ? Number(purchaseForm.unit_price) : null,
        total_price: totalPrice,
        supplier: purchaseForm.supplier || null,
        assigned_to: purchaseForm.assignment_type === "groomer" && purchaseForm.assigned_to ? purchaseForm.assigned_to : null,
        assignment_type: purchaseForm.assignment_type,
        notes: purchaseForm.notes || null,
      });
      if (pErr) throw pErr;
      const { error: rErr } = await (supabase.from("purchase_requests" as any) as any)
        .update({ status: "purchased", responded_at: new Date().toISOString() })
        .eq("id", req.id);
      if (rErr) throw rErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requests-pending"] });
      queryClient.invalidateQueries({ queryKey: ["purchases-history"] });
      setPurchaseDialog(null);
      toast.success("Marked as purchased");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("purchase_requests" as any) as any)
        .update({ status: "declined", decline_reason: declineReason || null, responded_at: new Date().toISOString() })
        .eq("id", declineDialog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requests-pending"] });
      setDeclineDialog(null);
      setDeclineReason("");
      toast.success("Request declined");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sort: urgent first
  const sorted = [...requests].sort((a, b) => {
    if (a.priority === "urgent" && b.priority !== "urgent") return -1;
    if (a.priority !== "urgent" && b.priority === "urgent") return 1;
    return 0;
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  if (sorted.length === 0) return (
    <div className="py-12 text-center">
      <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
      <p className="text-muted-foreground text-sm">No pending requests</p>
    </div>
  );

  return (
    <>
      <div className="space-y-3">
        {sorted.map((req) => (
          <Card key={req.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{req.title}</span>
                    <Badge variant={req.priority === "urgent" ? "destructive" : "secondary"} className="text-xs">
                      {req.priority === "urgent" ? <><AlertTriangle className="h-3 w-3 mr-1" />Urgent</> : "Normal"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requested by <strong>{req.staff?.name || "Unknown"}</strong> · {format(new Date(req.created_at), "d MMM yyyy")}
                    {req.request_method && req.request_method !== "app" && (
                      <span className="ml-1 text-muted-foreground/70">({req.request_method})</span>
                    )}
                  </p>
                  {req.description && <p className="text-sm text-muted-foreground">{req.description}</p>}
                  {req.product_link && (
                    <a href={req.product_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Product link
                    </a>
                  )}
                  {req.image_url && (
                    <img src={req.image_url} alt={req.title} className="mt-2 rounded-lg max-h-32 object-cover" />
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => { setPurchaseForm({ quantity: 1, unit_price: "", supplier: "", assigned_to: req.staff?.id || "", assignment_type: "groomer", notes: "" }); setPurchaseDialog(req); }}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Purchased
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeclineDialog(req)}>
                    <XCircle className="h-4 w-4 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mark Purchased Dialog */}
      <Dialog open={!!purchaseDialog} onOpenChange={(o) => !o && setPurchaseDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as Purchased — {purchaseDialog?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Quantity</Label><Input type="number" min={1} value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: parseInt(e.target.value) || 1 })} /></div>
              <div className="space-y-1"><Label>Unit Price (£)</Label><Input type="number" step="0.01" placeholder="Optional" value={purchaseForm.unit_price} onChange={(e) => setPurchaseForm({ ...purchaseForm, unit_price: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Supplier</Label><Input placeholder="e.g. Amazon, Groomers" value={purchaseForm.supplier} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Assign to</Label>
              <Select value={purchaseForm.assignment_type} onValueChange={(v) => setPurchaseForm({ ...purchaseForm, assignment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salon">Salon — Shared</SelectItem>
                  <SelectItem value="groomer">Specific Groomer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {purchaseForm.assignment_type === "groomer" && (
              <div className="space-y-1">
                <Label>Groomer</Label>
                <Select value={purchaseForm.assigned_to} onValueChange={(v) => setPurchaseForm({ ...purchaseForm, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Select groomer" /></SelectTrigger>
                  <SelectContent>{staffList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1"><Label>Notes</Label><Textarea placeholder="Optional notes" value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialog(null)}>Cancel</Button>
            <Button onClick={() => markPurchasedMutation.mutate()} disabled={markPurchasedMutation.isPending}>Confirm Purchase</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={!!declineDialog} onOpenChange={(o) => { if (!o) { setDeclineDialog(null); setDeclineReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Decline Request — {declineDialog?.title}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason for declining (optional)</Label>
            <Textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Optional reason..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => declineMutation.mutate()} disabled={declineMutation.isPending}>Decline Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
