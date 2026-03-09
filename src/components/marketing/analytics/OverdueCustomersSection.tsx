import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, UserX, UserMinus } from "lucide-react";
import { format, parseISO } from "date-fns";

interface OverdueCustomer {
  name: string;
  email: string;
  lastVisit: string;
  dogName: string;
  groomer: string;
  daysOverdue: number;
  category: "overdue" | "at_risk" | "lost";
}

interface Props {
  overdueCustomers: OverdueCustomer[];
}

function categoryBadge(cat: string, days: number) {
  if (days >= 180) return <Badge className="bg-gray-800 text-white">⚫ Lost (6+ mo)</Badge>;
  if (days >= 84) return <Badge variant="destructive">🔴 At Risk</Badge>;
  if (days >= 56) return <Badge className="bg-orange-500 text-white">🟠 Overdue</Badge>;
  return <Badge className="bg-amber-400 text-black">🟡 Getting Overdue</Badge>;
}

export function OverdueCustomersSection({ overdueCustomers }: Props) {
  const overdue = overdueCustomers.filter(c => c.daysOverdue >= 42 && c.daysOverdue < 84);
  const atRisk = overdueCustomers.filter(c => c.daysOverdue >= 84 && c.daysOverdue < 180);
  const lost = overdueCustomers.filter(c => c.daysOverdue >= 180);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Overdue & Lost Customers</h2>

      {/* Retention summary card */}
      <Card>
        <CardHeader><CardTitle className="text-base">Retention Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{overdueCustomers.length === 0 ? "—" : "✓"}</p>
              <p className="text-xs text-muted-foreground">💚 Active (booked in 6 weeks)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">{overdue.length}</p>
              <p className="text-xs text-muted-foreground">🟡 Overdue (6-12 weeks)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{atRisk.length}</p>
              <p className="text-xs text-muted-foreground">🔴 At Risk (12+ weeks)</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{lost.length}</p>
              <p className="text-xs text-muted-foreground">⚫ Lost (6+ months)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {atRisk.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> ⚠️ {atRisk.length} customers haven't been back in 3+ months
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {overdueCustomers.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Customer List</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Dog</TableHead>
                  <TableHead>Groomer</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueCustomers.slice(0, 50).map(c => (
                  <TableRow key={c.email}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{format(parseISO(c.lastVisit), "dd MMM yyyy")}</TableCell>
                    <TableCell>{c.dogName}</TableCell>
                    <TableCell>{c.groomer}</TableCell>
                    <TableCell>{c.daysOverdue}</TableCell>
                    <TableCell>{categoryBadge(c.category, c.daysOverdue)}</TableCell>
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
