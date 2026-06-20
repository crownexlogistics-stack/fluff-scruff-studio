import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfYear } from "date-fns";

export default function PayoutHistoryTab() {
  const { data: payoutHistory = [] } = useQuery({
    queryKey: ["groomer-payout-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groomer_payout_history")
        .select("*")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const totalAllTime = useMemo(() => payoutHistory.reduce((s, p) => s + Number(p.payout_amount), 0), [payoutHistory]);
  const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");
  const totalThisYear = useMemo(() =>
    payoutHistory
      .filter(p => p.paid_at >= yearStart)
      .reduce((s, p) => s + Number(p.payout_amount), 0),
    [payoutHistory, yearStart]
  );

  const totalTransfer = useMemo(() => payoutHistory.filter(p => p.payment_method !== "cash").reduce((s, p) => s + Number(p.payout_amount), 0), [payoutHistory]);
  const totalCash = useMemo(() => payoutHistory.filter(p => p.payment_method === "cash").reduce((s, p) => s + Number(p.payout_amount), 0), [payoutHistory]);

  const perGroomer = useMemo(() => {
    const map = new Map<string, number>();
    payoutHistory.forEach(p => {
      map.set(p.groomer_name, (map.get(p.groomer_name) || 0) + Number(p.payout_amount));
    });
    return Array.from(map.entries());
  }, [payoutHistory]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-3 items-center">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">All-Time Paid</p><p className="text-2xl font-bold">£{totalAllTime.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">This Year</p><p className="text-2xl font-bold">£{totalThisYear.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Paid by Transfer</p><p className="text-2xl font-bold">£{totalTransfer.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Paid in Cash</p><p className="text-2xl font-bold">£{totalCash.toFixed(2)}</p></CardContent></Card>
      </div>
      {perGroomer.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {perGroomer.map(([name, total]) => (
            <Badge key={name} variant="secondary" className="text-xs">
              {name}: £{total.toFixed(2)}
            </Badge>
          ))}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Paid</TableHead>
                <TableHead>Groomer</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>Paid By</TableHead>
                <TableHead>Anomalies</TableHead>
                <TableHead>Shortfall</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payoutHistory.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No payout history yet</TableCell></TableRow>
              )}
              {payoutHistory.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{format(new Date(p.paid_at), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-sm font-medium">{p.groomer_name}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(p.period_start + "T00:00:00"), "dd MMM")} – {format(new Date(p.period_end + "T00:00:00"), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-sm">£{Number(p.total_revenue).toFixed(2)}</TableCell>
                  <TableCell className="text-sm">{(Number(p.commission_rate) * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-sm font-medium">£{Number(p.payout_amount).toFixed(2)}</TableCell>
                  <TableCell className="text-sm">{p.paid_by}</TableCell>
                  <TableCell>
                    {Number(p.anomaly_count) > 0 ? (
                      <Badge className="bg-amber-500 text-white text-xs">{p.anomaly_count}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">£{Number(p.anomaly_shortfall).toFixed(2)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
