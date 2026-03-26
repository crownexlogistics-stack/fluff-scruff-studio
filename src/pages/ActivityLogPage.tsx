import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, subDays } from "date-fns";
import { Activity } from "lucide-react";

const actionTypeLabels: Record<string, string> = {
  booking_created: "Booking Created",
  checkout_complete: "Checkout Complete",
  checkout_noshow: "No Show",
  reschedule: "Rescheduled",
  cancel: "Cancelled",
  payment_link: "Payment Link Sent",
  sms_sent: "SMS Sent",
  package_created: "Package Created",
  note_added: "Note Added",
};

export default function ActivityLogPage() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [groomerFilter, setGroomerFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("id, name").eq("is_active", true) as any;
      return (data || []) as { id: string; name: string }[];
    },
  });

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["all-activity-log", dateFrom, dateTo, groomerFilter, actionFilter, search],
    queryFn: async () => {
      let query = supabase
        .from("groomer_activity_log" as any)
        .select("*")
        .gte("performed_at", `${dateFrom}T00:00:00`)
        .lte("performed_at", `${dateTo}T23:59:59`)
        .order("performed_at", { ascending: false })
        .limit(500);

      if (groomerFilter !== "all") {
        query = query.eq("staff_id", groomerFilter);
      }
      if (actionFilter !== "all") {
        query = query.eq("action_type", actionFilter);
      }
      if (search.trim()) {
        query = query.ilike("action_summary", `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const staffMap = Object.fromEntries(staff.map((s: any) => [s.id, s.name]));

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Activity Log
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Complete audit trail of all groomer actions</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Groomer</label>
                <Select value={groomerFilter} onValueChange={setGroomerFilter}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groomers</SelectItem>
                    {staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Action Type</label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {Object.entries(actionTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Search</label>
                <Input placeholder="Customer name..." value={search} onChange={(e) => setSearch(e.target.value)} className="text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{activities.length} entries found</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : activities.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">No activity found for these filters</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Time</TableHead>
                    <TableHead className="w-28">Groomer</TableHead>
                    <TableHead className="w-32">Action</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(a.performed_at), "dd MMM HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {staffMap[a.staff_id] || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {actionTypeLabels[a.action_type] || a.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{a.action_summary}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
