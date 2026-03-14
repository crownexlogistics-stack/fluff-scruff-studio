import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Package } from "lucide-react";
import { format } from "date-fns";

interface EquipmentTabProps {
  staffId: string;
  isTerminated?: boolean;
}

export function EquipmentTab({ staffId, isTerminated }: EquipmentTabProps) {
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["staff-equipment", staffId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("purchases" as any) as any)
        .select("*")
        .eq("assigned_to", staffId)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const totalItems = purchases.length;
  const returnedCount = purchases.filter((p: any) => p.is_returned).length;
  const outstandingCount = totalItems - returnedCount;
  const outstandingItems = purchases.filter((p: any) => !p.is_returned);

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <span><strong>{totalItems}</strong> items assigned</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-green-600"><strong>{returnedCount}</strong> returned</span>
        <span className="text-muted-foreground">·</span>
        <span className={outstandingCount > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}><strong>{outstandingCount}</strong> outstanding</span>
      </div>

      {/* Termination warning */}
      {isTerminated && outstandingCount > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm">
            <AlertTriangle className="h-4 w-4" />
            {outstandingCount} item{outstandingCount !== 1 ? "s" : ""} outstanding — confirm return before closing account
          </div>
          <ul className="text-sm text-destructive/80 list-disc list-inside">
            {outstandingItems.map((p: any) => <li key={p.id}>{p.title} (x{p.quantity})</li>)}
          </ul>
        </div>
      )}

      {totalItems === 0 ? (
        <div className="py-12 text-center">
          <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No equipment assigned</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Date Purchased</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Returned?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(p.purchased_at), "d MMM yyyy")}</TableCell>
                    <TableCell>{p.quantity}</TableCell>
                    <TableCell>{p.total_price ? `£${Number(p.total_price).toFixed(2)}` : "—"}</TableCell>
                    <TableCell>
                      {p.is_returned ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">Returned</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Outstanding</Badge>
                      )}
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
