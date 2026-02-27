import { AppLayout } from "@/components/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const BookingsPage = () => {
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, breeds(name), services(name), staff(name)")
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "Confirmed": return "default";
      case "Completed": return "secondary";
      case "Cancelled": return "destructive";
      default: return "outline";
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Bookings</h1>
          <p className="text-muted-foreground mt-1">View and manage appointments</p>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Dog</TableHead>
                  <TableHead>Breed</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Deposit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : bookings?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No bookings yet.</TableCell></TableRow>
                ) : (
                  bookings?.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.customer_name}</TableCell>
                      <TableCell>{b.dog_name}</TableCell>
                      <TableCell>{(b.breeds as any)?.name ?? "—"}</TableCell>
                      <TableCell>{(b.services as any)?.name ?? "—"}</TableCell>
                      <TableCell>{format(new Date(b.booking_date), "dd MMM yyyy")} {b.booking_time?.slice(0, 5)}</TableCell>
                      <TableCell>£{Number(b.total_price).toFixed(2)}</TableCell>
                      <TableCell>£{Number(b.deposit_paid).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={statusColor(b.status) as any}>{b.status}</Badge></TableCell>
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

export default BookingsPage;
