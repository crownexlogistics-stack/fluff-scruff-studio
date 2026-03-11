import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";

const ANOMALY_LABELS: Record<string, string> = {
  undercharged: "Under",
  overcharged: "Over",
  zero_when_balance_due: "Zero — Balance Due",
  large_discrepancy: "Large Discrepancy",
};

export default function AnomaliesTab() {
  const queryClient = useQueryClient();
  const [groomerFilter, setGroomerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-list-anomaly"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name, role").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: anomalies = [] } = useQuery({
    queryKey: ["anomaly-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, customer_name, booking_date, total_price, deposit_paid, final_charge, payment_anomaly, anomaly_type, anomaly_reviewed, anomaly_review_note, staff_id, service_id, services:service_id(name), staff:staff_id(name)")
        .eq("payment_anomaly", true)
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // All bookings this month for integrity scores
  const { data: allBookingsThisMonth = [] } = useQuery({
    queryKey: ["all-bookings-this-month"],
    queryFn: async () => {
      const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date()), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("bookings")
        .select("id, staff_id, payment_anomaly, total_price, deposit_paid, final_charge")
        .gte("booking_date", start)
        .lte("booking_date", end)
        .eq("status", "Completed");
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    let items = anomalies;
    if (groomerFilter !== "all") {
      items = items.filter(a => a.staff_id === groomerFilter);
    }
    if (typeFilter !== "all") {
      items = items.filter(a => a.anomaly_type === typeFilter);
    }
    if (statusFilter === "unreviewed") {
      items = items.filter(a => !a.anomaly_reviewed);
    } else if (statusFilter === "reviewed") {
      items = items.filter(a => a.anomaly_reviewed);
    }
    if (periodFilter !== "all") {
      const now = new Date();
      let start: Date, end: Date;
      if (periodFilter === "this_week") {
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
      } else if (periodFilter === "this_month") {
        start = startOfMonth(now);
        end = endOfMonth(now);
      } else {
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
      }
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");
      items = items.filter(a => a.booking_date >= startStr && a.booking_date <= endStr);
    }
    return items;
  }, [anomalies, groomerFilter, typeFilter, periodFilter, statusFilter]);

  const totalAnomalies = anomalies.length;
  const unreviewedCount = anomalies.filter(a => !a.anomaly_reviewed).length;
  const totalShortfall = anomalies.reduce((s, a) => {
    const diff = Number(a.final_charge || 0) - (Number(a.total_price) - Number(a.deposit_paid));
    return diff < 0 ? s + Math.abs(diff) : s;
  }, 0);
  const thisMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const thisMonthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const thisMonthShortfall = anomalies
    .filter(a => a.booking_date >= thisMonthStart && a.booking_date <= thisMonthEnd)
    .reduce((s, a) => {
      const diff = Number(a.final_charge || 0) - (Number(a.total_price) - Number(a.deposit_paid));
      return diff < 0 ? s + Math.abs(diff) : s;
    }, 0);

  const markReviewedMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase.from("bookings").update({
        anomaly_reviewed: true,
        anomaly_review_note: note || null,
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ Marked as reviewed");
      setReviewingId(null);
      setReviewNote("");
      queryClient.invalidateQueries({ queryKey: ["anomaly-bookings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Integrity scores
  const groomers = staff.filter(s => s.role === "Groomer" && !s.name.includes("Nails"));
  const integrityScores = groomers.map(g => {
    const totalAppts = allBookingsThisMonth.filter(b => b.staff_id === g.id).length;
    const anomalyAppts = allBookingsThisMonth.filter(b => b.staff_id === g.id && b.payment_anomaly).length;
    const rate = totalAppts > 0 ? (anomalyAppts / totalAppts) * 100 : 0;
    const shortfall = allBookingsThisMonth
      .filter(b => b.staff_id === g.id && b.payment_anomaly)
      .reduce((s, b) => {
        const diff = Number(b.final_charge || 0) - (Number(b.total_price) - Number(b.deposit_paid));
        return diff < 0 ? s + Math.abs(diff) : s;
      }, 0);
    return { name: g.name, totalAppts, anomalyAppts, rate, shortfall };
  });

  const getDiffColor = (diff: number | null) => {
    if (diff === null) return "";
    if (Math.abs(diff) <= 2) return "text-emerald-600";
    if (diff < 0) return "text-destructive";
    return "text-amber-600";
  };

  const getAnomalyBadge = (type: string | null, reviewed: boolean) => {
    if (!type) return <Badge variant="secondary" className="text-xs">Pending</Badge>;
    const label = ANOMALY_LABELS[type] || type;
    if (type === "zero_when_balance_due") return <Badge variant="destructive" className="text-xs">🚨 {label}</Badge>;
    if (type === "undercharged" || type === "large_discrepancy") return <Badge variant="destructive" className="text-xs">🔴 {label}</Badge>;
    if (type === "overcharged") return <Badge className="bg-amber-500 text-white text-xs">🟡 {label}</Badge>;
    return <Badge variant="secondary" className="text-xs">{label}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Anomalies</p><p className="text-2xl font-bold">{totalAnomalies}</p></CardContent></Card>
        <Card className={unreviewedCount > 0 ? "bg-amber-50 border-amber-200" : ""}><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Unreviewed</p><p className="text-2xl font-bold">{unreviewedCount}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Shortfall</p><p className="text-2xl font-bold">£{totalShortfall.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">This Month Shortfall</p><p className="text-2xl font-bold">£{thisMonthShortfall.toFixed(2)}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={groomerFilter} onValueChange={setGroomerFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Groomer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groomers</SelectItem>
            {staff.filter(s => s.role === "Groomer").map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="undercharged">Undercharged</SelectItem>
            <SelectItem value="overcharged">Overcharged</SelectItem>
            <SelectItem value="zero_when_balance_due">Zero when due</SelectItem>
            <SelectItem value="large_discrepancy">Large Discrepancy</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Period" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unreviewed">Unreviewed Only</SelectItem>
            <SelectItem value="reviewed">Reviewed Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Anomaly Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Groomer</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Balance Due</TableHead>
                <TableHead>Charged</TableHead>
                <TableHead>Difference</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reviewed</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No anomalies found</TableCell></TableRow>
              )}
              {filtered.map(a => {
                const balanceDue = Number(a.total_price) - Number(a.deposit_paid);
                const charged = a.final_charge != null ? Number(a.final_charge) : null;
                const diff = charged != null ? charged - balanceDue : null;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">{format(new Date(a.booking_date + "T00:00:00"), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-sm">{(a.staff as any)?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{a.customer_name}</TableCell>
                    <TableCell className="text-sm">{(a.services as any)?.name || "—"}</TableCell>
                    <TableCell className="text-sm">£{Number(a.total_price).toFixed(2)}</TableCell>
                    <TableCell className="text-sm">£{Number(a.deposit_paid).toFixed(2)}</TableCell>
                    <TableCell className="text-sm">£{balanceDue.toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{charged != null ? `£${charged.toFixed(2)}` : <span className="text-muted-foreground italic">Not entered</span>}</TableCell>
                    <TableCell className={`text-sm font-medium ${getDiffColor(diff)}`}>
                      {diff != null ? `£${diff.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>{getAnomalyBadge(a.anomaly_type, a.anomaly_reviewed)}</TableCell>
                    <TableCell>{a.anomaly_reviewed ? <Badge className="bg-emerald-600 text-white text-xs">✅ Reviewed</Badge> : <span className="text-amber-500">⏳</span>}</TableCell>
                    <TableCell>
                      {!a.anomaly_reviewed ? (
                        reviewingId === a.id ? (
                          <div className="flex flex-col gap-1">
                            <Input
                              placeholder="Add note (optional)"
                              value={reviewNote}
                              onChange={e => setReviewNote(e.target.value)}
                              className="text-xs h-7"
                            />
                            <Button
                              size="sm"
                              className="text-xs h-7 rounded-[30px]"
                              style={{ backgroundColor: "#2D1B0E", color: "white" }}
                              onClick={() => markReviewedMutation.mutate({ id: a.id, note: reviewNote })}
                              disabled={markReviewedMutation.isPending}
                            >
                              Confirm
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="text-xs h-7 rounded-[30px]"
                            style={{ backgroundColor: "#2D1B0E", color: "white" }}
                            onClick={() => { setReviewingId(a.id); setReviewNote(""); }}
                          >
                            Mark Reviewed
                          </Button>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground italic">{a.anomaly_review_note || ""}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Groomer Integrity Scores */}
      <div>
        <h3 className="text-base font-semibold mb-3">Groomer Integrity Scores</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {integrityScores.map(g => {
            const barColor = g.rate < 5 ? "bg-emerald-500" : g.rate <= 15 ? "bg-amber-500" : "bg-destructive";
            return (
              <Card key={g.name}>
                <CardContent className="p-4">
                  <p className="font-semibold text-sm">{g.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This month: {g.anomalyAppts} anomalies / {g.totalAppts} appointments
                  </p>
                  <p className="text-xs text-muted-foreground">Anomaly rate: {g.rate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Potential shortfall: £{g.shortfall.toFixed(2)}</p>
                  <div className="mt-2 h-2 w-full rounded-full bg-muted">
                    <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(g.rate, 100)}%` }} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
