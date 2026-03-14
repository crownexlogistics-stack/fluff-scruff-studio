import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { toast } from "sonner";

export function PurchaseHistoryTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["purchases-history"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("purchases" as any) as any)
        .select("*, assigned_staff:assigned_to(id, name), requested_groomer:requested_by_groomer(id, name)")
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const toggleReturnMutation = useMutation({
    mutationFn: async ({ id, is_returned }: { id: string; is_returned: boolean }) => {
      const { error } = await (supabase.from("purchases" as any) as any)
        .update({ is_returned, returned_at: is_returned ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases-history"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = purchases.filter((p: any) => {
    if (filter === "all") return true;
    if (filter === "salon") return p.assignment_type === "salon";
    return p.assigned_to === filter;
  });

  const totalSpend = purchases.reduce((sum: number, p: any) => sum + (Number(p.total_price) || 0), 0);

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm font-medium text-foreground">
          Total purchases to date: <span className="text-primary font-bold">£{totalSpend.toFixed(2)}</span>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Purchases</SelectItem>
            <SelectItem value="salon">Salon — Shared</SelectItem>
            {staffList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No purchases found</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Returned?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(p.purchased_at), "d MMM yyyy")}</TableCell>
                    <TableCell>{p.quantity}</TableCell>
                    <TableCell>{p.total_price ? `£${Number(p.total_price).toFixed(2)}` : "—"}</TableCell>
                    <TableCell>
                      {p.assignment_type === "salon" ? (
                        <Badge variant="secondary">Salon</Badge>
                      ) : (
                        <Badge variant="default">{p.assigned_staff?.name || "—"}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{p.supplier || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.requested_groomer?.name
                        ? `${p.requested_groomer.name} (${p.request_method || "verbal"})`
                        : p.request_id ? "Formal request" : "Admin"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={!!p.is_returned}
                        onCheckedChange={(checked) => toggleReturnMutation.mutate({ id: p.id, is_returned: checked })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
