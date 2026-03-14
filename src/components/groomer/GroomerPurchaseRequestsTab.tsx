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
import { Plus, ShoppingCart, CheckCircle2, XCircle, Clock, AlertTriangle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export function GroomerPurchaseRequestsTab({ staffId }: { staffId: string }) {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "normal", product_link: "" });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["groomer-purchase-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("purchase_requests" as any) as any)
        .select("*, staff:requested_by(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("purchase_requests" as any) as any).insert({
        requested_by: staffId,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        product_link: form.product_link || null,
      });
      if (error) throw error;
      // Fire email notification
      try {
        await supabase.functions.invoke("notify-purchase-request", {
          body: { staff_id: staffId, title: form.title, description: form.description, priority: form.priority, product_link: form.product_link },
        });
      } catch { /* non-blocking */ }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groomer-purchase-requests"] });
      setShowNew(false);
      setForm({ title: "", description: "", priority: "normal", product_link: "" });
      toast.success("Request submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusIcon = (status: string) => {
    if (status === "purchased") return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    if (status === "declined") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  };

  const statusColor = (status: string) => {
    if (status === "purchased") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (status === "declined") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  };

  // Group by status: pending first, then purchased, then declined
  const statusOrder: Record<string, number> = { pending: 0, purchased: 1, declined: 2 };
  const sorted = [...requests].sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{requests.length} request{requests.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> New Request</Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="py-12 text-center">
          <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No purchase requests yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((req) => (
            <Card key={req.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{req.title}</span>
                      {req.priority === "urgent" && <Badge variant="destructive" className="text-[10px] px-1.5 py-0"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Urgent</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {req.staff?.name || "Unknown"} · {format(new Date(req.created_at), "d MMM yyyy")}
                    </p>
                    {req.description && <p className="text-xs text-muted-foreground mt-1">{req.description}</p>}
                    {req.product_link && (
                      <a href={req.product_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                        <ExternalLink className="h-3 w-3" /> Link
                      </a>
                    )}
                    {req.status === "declined" && req.decline_reason && (
                      <p className="text-xs text-destructive mt-1">Reason: {req.decline_reason}</p>
                    )}
                  </div>
                  <Badge className={`text-xs shrink-0 ${statusColor(req.status)}`}>
                    {statusIcon(req.status)}
                    <span className="ml-1 capitalize">{req.status}</span>
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Request Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Item Name *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What do you need?" /></div>
            <div className="space-y-1"><Label>Description / Why needed</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details" /></div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">🔴 Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Product Link</Label><Input value={form.product_link} onChange={(e) => setForm({ ...form, product_link: e.target.value })} placeholder="https://..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={() => submitMutation.mutate()} disabled={!form.title || submitMutation.isPending}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
