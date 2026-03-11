import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, PoundSterling, Dog, TrendingUp, Banknote, CreditCard, Users, History } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { FinanceExplainerButton } from "@/components/dashboard/FinanceExplainerDialog";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths } from "date-fns";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import ExpensesTab from "@/components/finance/ExpensesTab";
import AnomaliesTab from "@/components/finance/AnomaliesTab";
import PayoutHistoryTab from "@/components/finance/PayoutHistoryTab";

type Period = "weekly" | "monthly";

const FinancePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("weekly");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState(0);
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [activeTab, setActiveTab] = useState("payouts");
  const [includeWixHistory, setIncludeWixHistory] = useState(false);
  const [anomalyWarningOpen, setAnomalyWarningOpen] = useState(false);
  const [anomalyWarningData, setAnomalyWarningData] = useState<{ count: number; shortfall: number } | null>(null);

  const now = new Date();
  const periodStart = useMemo(() => {
    if (period === "weekly") return startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
    return startOfMonth(addMonths(now, monthOffset));
  }, [period, weekOffset, monthOffset]);

  const periodEnd = useMemo(() => {
    if (period === "weekly") return endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
    return endOfMonth(addMonths(now, monthOffset));
  }, [period, weekOffset, monthOffset]);

  const periodStartStr = format(periodStart, "yyyy-MM-dd");
  const periodEndStr = format(periodEnd, "yyyy-MM-dd");

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name, role").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["commission-records", periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_records")
        .select("*, bookings(customer_name, dog_name, booking_date, service_id, services:service_id(name)), migrated_bookings(service_name, dog_name, booking_date, migrated_customers(full_name))")
        .gte("created_at", `${periodStartStr}T00:00:00`)
        .lte("created_at", `${periodEndStr}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["payout-records", periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_records")
        .select("*")
        .gte("period_start", periodStartStr)
        .lte("period_end", periodEndStr)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Migrated bookings for the period
  const { data: migratedBookings = [] } = useQuery({
    queryKey: ["finance-migrated", periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("migrated_bookings")
        .select("*, migrated_customers(full_name)")
        .gte("booking_date", periodStartStr)
        .lte("booking_date", periodEndStr);
      if (error) throw error;
      return data as any[];
    },
  });

  // Ad-hoc pay links revenue for the period
  const { data: paidPayLinks = [] } = useQuery({
    queryKey: ["finance-pay-links", periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_pay_links")
        .select("*")
        .eq("status", "paid")
        .gte("paid_at", `${periodStartStr}T00:00:00`)
        .lte("paid_at", `${periodEndStr}T23:59:59`);
      if (error) throw error;
      return data as any[];
    },
  });

  // Wix historical bookings for the period
  const { data: wixHistorical = [] } = useQuery({
    queryKey: ["wix-historical-finance", periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wix_historical_bookings")
        .select("price_charged, revenue_recognised, appointment_date")
        .gte("appointment_date", `${periodStartStr}T00:00:00`)
        .lte("appointment_date", `${periodEndStr}T23:59:59`)
        .eq("revenue_recognised", true);
      if (error) throw error;
      return data as any[];
    },
    enabled: includeWixHistory,
  });

  const wixRevenue = useMemo(() => {
    if (!includeWixHistory) return 0;
    return wixHistorical.reduce((s: number, b: any) => s + Number(b.price_charged || 0), 0);
  }, [wixHistorical, includeWixHistory]);

  const payLinksRevenue = useMemo(() => {
    return paidPayLinks.reduce((s, pl: any) => s + Number(pl.amount || 0), 0);
  }, [paidPayLinks]);

  const migratedRevenue = useMemo(() => {
    return migratedBookings.reduce((s, b: any) => s + Number(b.total_price || 0), 0);
  }, [migratedBookings]);

  const migratedOutstanding = useMemo(() => {
    return migratedBookings
      .filter((b: any) => b.is_future_booking && b.amount_due && Number(b.amount_due) > 0)
      .reduce((s, b: any) => s + Number(b.amount_due || 0), 0);
  }, [migratedBookings]);

  const staffSummaries = useMemo(() => {
    const map = new Map<string, { staffId: string; name: string; totalDogs: number; totalRevenue: number; totalGroomerPay: number; totalStudioShare: number; commissions: any[] }>();
    staff.forEach(s => {
      map.set(s.id, { staffId: s.id, name: s.name, totalDogs: 0, totalRevenue: 0, totalGroomerPay: 0, totalStudioShare: 0, commissions: [] });
    });
    commissions.forEach(c => {
      const entry = map.get(c.staff_id);
      if (entry) {
        entry.totalDogs++;
        entry.totalRevenue += Number(c.total_price);
        entry.totalGroomerPay += Number(c.groomer_pay);
        entry.totalStudioShare += Number(c.studio_share);
        entry.commissions.push(c);
      }
    });
    return Array.from(map.values()).filter(s => s.totalDogs > 0 || staff.find(st => st.id === s.staffId)?.role === "Groomer");
  }, [commissions, staff]);

  const selectedSummary = selectedStaffId ? staffSummaries.find(s => s.staffId === selectedStaffId) : null;
  const selectedPayouts = payouts.filter(p => p.staff_id === selectedStaffId);
  const totalPaidOut = selectedPayouts.reduce((sum, p) => sum + Number(p.amount), 0);

  const processPayoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStaffId || !user) throw new Error("Missing data");
      const { error } = await supabase.from("payout_records").insert({
        staff_id: selectedStaffId,
        amount: payoutAmount,
        payment_method: payoutMethod,
        period_start: periodStartStr,
        period_end: periodEndStr,
        notes: payoutNotes || null,
        processed_by: user.id,
      });
      if (error) throw error;
      logAudit({
        staffId: selectedStaffId,
        action: "PAYOUT_PROCESSED",
        details: `Payout of £${payoutAmount.toFixed(2)} via ${payoutMethod} for period ${periodStartStr} to ${periodEndStr}`,
      });
    },
    onSuccess: () => {
      toast.success("Payout recorded successfully");
      setPayoutOpen(false);
      setPayoutAmount(0);
      setPayoutNotes("");
      queryClient.invalidateQueries({ queryKey: ["payout-records"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const offset = period === "weekly" ? weekOffset : monthOffset;
  const setOffset = period === "weekly" ? setWeekOffset : setMonthOffset;

  // Detail view for individual groomer
  if (selectedStaffId && selectedSummary) {
    const owedRemaining = selectedSummary.totalGroomerPay - totalPaidOut;
    return (
      <AppLayout>
        <div className="space-y-4 max-w-4xl">
          <Button variant="ghost" size="sm" onClick={() => setSelectedStaffId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Finance
          </Button>

          <div>
            <h1 className="text-2xl font-heading font-bold">{selectedSummary.name}</h1>
            <p className="text-sm text-muted-foreground">
              {format(periodStart, "dd MMM yyyy")} — {format(periodEnd, "dd MMM yyyy")}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Dogs Groomed</p><p className="text-2xl font-bold">{selectedSummary.totalDogs}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">£{selectedSummary.totalRevenue.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Groomer Pay</p><p className="text-2xl font-bold text-primary">£{selectedSummary.totalGroomerPay.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Studio Share</p><p className="text-2xl font-bold">£{selectedSummary.totalStudioShare.toFixed(2)}</p></CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Payout Status</p>
                  <p className="text-xs text-muted-foreground">Paid: £{totalPaidOut.toFixed(2)} / Owed: £{selectedSummary.totalGroomerPay.toFixed(2)}</p>
                  {owedRemaining > 0 && <p className="text-sm font-semibold text-destructive mt-1">Remaining: £{owedRemaining.toFixed(2)}</p>}
                  {owedRemaining <= 0 && selectedSummary.totalGroomerPay > 0 && <Badge className="bg-emerald-600 text-white mt-1">Fully Paid</Badge>}
                </div>
                {owedRemaining > 0 && (
                  <Button onClick={() => { setPayoutAmount(owedRemaining); setPayoutOpen(true); }}>
                    <Banknote className="h-4 w-4 mr-1" /> Process Payout
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Revenue Breakdown</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead><TableHead>Dog</TableHead><TableHead>Service</TableHead>
                    <TableHead>Price</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Groomer Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const grouped = new Map<string, any[]>();
                    for (const c of selectedSummary.commissions) {
                      const isMigrated = c.booking_source === "migrated" || c.migrated_booking_id;
                      const dateStr = isMigrated
                        ? c.migrated_bookings?.booking_date
                        : c.bookings?.booking_date;
                      const key = dateStr || "Unknown";
                      if (!grouped.has(key)) grouped.set(key, []);
                      grouped.get(key)!.push(c);
                    }
                    const sortedDays = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));
                    
                    if (sortedDays.length === 0) {
                      return <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No completed appointments this period</TableCell></TableRow>;
                    }
                    
                    return sortedDays.flatMap(([dateKey, items]) => [
                      <TableRow key={`header-${dateKey}`} className="bg-muted/60 hover:bg-muted/60">
                        <TableCell colSpan={6} className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {dateKey !== "Unknown" ? format(new Date(dateKey + "T00:00:00"), "EEEE, d MMMM yyyy") : "Unknown Date"}
                        </TableCell>
                      </TableRow>,
                      ...items.map((c: any) => {
                        const isMigrated = c.booking_source === "migrated" || c.migrated_booking_id;
                        const customerName = isMigrated
                          ? c.migrated_bookings?.migrated_customers?.full_name || "Wix Customer"
                          : c.bookings?.customer_name || "—";
                        const dogName = isMigrated
                          ? c.migrated_bookings?.dog_name || "—"
                          : c.bookings?.dog_name || "—";
                        const serviceName = isMigrated
                          ? c.migrated_bookings?.service_name || "—"
                          : c.bookings?.services?.name || "—";
                        return (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm">
                            {customerName}
                            {isMigrated && <Badge className="ml-1 bg-amber-500 text-white hover:bg-amber-500 text-[8px] px-1 py-0">W</Badge>}
                          </TableCell>
                          <TableCell className="text-sm">{dogName}</TableCell>
                          <TableCell className="text-sm">{serviceName}</TableCell>
                          <TableCell className="text-sm">£{Number(c.total_price).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={c.commission_type === "no_show" ? "destructive" : c.commission_type === "own_customer" ? "default" : "secondary"} className="text-xs">
                              {c.commission_type === "own_customer" ? "Own 50%" : c.commission_type === "no_show" ? "No Show" : "Normal 40%"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">£{Number(c.groomer_pay).toFixed(2)}</TableCell>
                        </TableRow>
                        );
                      }),
                    ]);
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selectedPayouts.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Payout History</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {selectedPayouts.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{format(new Date(p.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                        <TableCell className="text-sm font-medium">£{Number(p.amount).toFixed(2)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{p.payment_method === "cash" ? "Cash" : "Bank Transfer"}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Process Payout — {selectedSummary.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Amount (£)</Label><NumericInput value={payoutAmount} onValueChange={setPayoutAmount} /></div>
              <div>
                <Label>Payment Method</Label>
                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes (optional)</Label><Textarea value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)} placeholder="Reference number, etc." /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayoutOpen(false)}>Cancel</Button>
              <Button onClick={() => processPayoutMutation.mutate()} disabled={payoutAmount <= 0 || processPayoutMutation.isPending}>
                {processPayoutMutation.isPending ? "Processing…" : "Confirm Payout"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    );
  }

  // Main view with tabs
  const totalRevenue = staffSummaries.reduce((sum, s) => sum + s.totalRevenue, 0) + migratedRevenue + payLinksRevenue + wixRevenue;
  const totalGroomerPay = staffSummaries.reduce((sum, s) => sum + s.totalGroomerPay, 0);
  const totalStudioShare = staffSummaries.reduce((sum, s) => sum + s.totalStudioShare, 0);
  const totalDogs = staffSummaries.reduce((sum, s) => sum + s.totalDogs, 0) + migratedBookings.length;

  return (
    <AppLayout>
      <div className="space-y-4 max-w-4xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold">Finance</h1>
            <p className="text-sm text-muted-foreground">Commission tracking, payouts & expenses</p>
          </div>
          <FinanceExplainerButton />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="payouts">Groomer Payouts</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>

          <TabsContent value="payouts" className="space-y-4 mt-4">
            {/* Period selector */}
            <div className="flex items-center justify-between">
              <Tabs value={period} onValueChange={v => { setPeriod(v as Period); setWeekOffset(0); setMonthOffset(0); }}>
                <TabsList>
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={includeWixHistory} onCheckedChange={setIncludeWixHistory} id="wix-toggle" />
              <Label htmlFor="wix-toggle" className="text-sm flex items-center gap-1.5 cursor-pointer">
                <History className="h-3.5 w-3.5" /> Include Historical Wix Data
              </Label>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setOffset(o => o - 1)}>← Previous</Button>
              <p className="text-sm font-medium">{format(periodStart, "dd MMM yyyy")} — {format(periodEnd, "dd MMM yyyy")}</p>
              <Button variant="outline" size="sm" onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}>Next →</Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="p-4 text-center"><Dog className="h-5 w-5 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">Dogs Groomed</p><p className="text-2xl font-bold">{totalDogs}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">£{totalRevenue.toFixed(2)}</p>{migratedRevenue > 0 && <p className="text-xs text-amber-600">incl. £{migratedRevenue.toFixed(2)} Wix migrated</p>}{wixRevenue > 0 && <p className="text-xs text-purple-600">incl. £{wixRevenue.toFixed(2)} Wix historical</p>}{payLinksRevenue > 0 && <p className="text-xs text-emerald-600">incl. £{payLinksRevenue.toFixed(2)} Pay Links</p>}</CardContent></Card>
              <Card><CardContent className="p-4 text-center"><Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">Groomer Pay</p><p className="text-2xl font-bold text-primary">£{totalGroomerPay.toFixed(2)}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><CreditCard className="h-5 w-5 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">Studio Share</p><p className="text-2xl font-bold">£{totalStudioShare.toFixed(2)}</p></CardContent></Card>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {staff.filter(s => s.role === "Groomer").map(s => {
                const summary = staffSummaries.find(ss => ss.staffId === s.id);
                const groomerPayouts = payouts.filter(p => p.staff_id === s.id);
                const paidOut = groomerPayouts.reduce((sum, p) => sum + Number(p.amount), 0);
                const owed = (summary?.totalGroomerPay || 0) - paidOut;
                return (
                  <Card key={s.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedStaffId(s.id)}>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{s.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{summary?.totalDogs || 0} dogs groomed</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Revenue</span><span className="font-medium">£{(summary?.totalRevenue || 0).toFixed(2)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Payout Due</span><span className="font-semibold text-primary">£{(summary?.totalGroomerPay || 0).toFixed(2)}</span></div>
                        {owed > 0 ? (
                          <Badge variant="destructive" className="text-xs mt-1">£{owed.toFixed(2)} unpaid</Badge>
                        ) : (summary?.totalGroomerPay || 0) > 0 ? (
                          <Badge className="bg-emerald-600 text-white text-xs mt-1">Paid</Badge>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {staff.filter(s => s.role === "Groomer").length === 0 && (
              <div className="text-center py-16">
                <PoundSterling className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-medium text-muted-foreground">No groomers found</p>
                <p className="text-xs text-muted-foreground">Add staff with the 'Groomer' role to see finance data.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="expenses" className="mt-4">
            <ExpensesTab
              periodStart={periodStart}
              periodEnd={periodEnd}
              totalRevenue={totalRevenue}
              totalGroomerPay={totalGroomerPay}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default FinancePage;
