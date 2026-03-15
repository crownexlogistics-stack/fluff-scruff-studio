import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, UserCog } from "lucide-react";

interface CouponUsage {
  id: string;
  customer_email: string;
  used_at: string;
  booking_id: string | null;
  applied_by_staff_id: string | null;
  applied_by_staff_name: string | null;
}

export function CouponUsageHistory({ couponId, couponCode }: { couponId: string; couponCode: string }) {
  const { data: usages, isLoading } = useQuery({
    queryKey: ["coupon-usages", couponId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupon_usages")
        .select("*")
        .eq("coupon_id", couponId)
        .order("used_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CouponUsage[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!usages?.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No one has used <span className="font-mono font-semibold">{couponCode}</span> yet.
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Used At</TableHead>
            <TableHead>Applied By</TableHead>
            <TableHead>Booking</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usages.map((u, idx) => (
            <TableRow key={u.id}>
              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{u.customer_email}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(u.used_at), "dd MMM yyyy, HH:mm")}
              </TableCell>
              <TableCell>
                {u.applied_by_staff_name ? (
                  <Badge variant="outline" className="gap-1 font-normal">
                    <UserCog className="h-3 w-3" />
                    {u.applied_by_staff_name}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Customer</span>
                )}
              </TableCell>
              <TableCell>
                {u.booking_id ? (
                  <code className="text-xs text-muted-foreground font-mono">
                    {u.booking_id.slice(0, 8)}…
                  </code>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
