import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { GroomerLayout } from "@/components/GroomerLayout";
import { CalendarDays, MessageSquare, Dog, PoundSterling, FileText, ChevronRight, ArrowLeft, ShoppingCart, Package } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GroomerBookingsTab } from "@/components/groomer/GroomerBookingsTab";
import { GroomerMessagesTab } from "@/components/groomer/GroomerMessagesTab";
import { GroomerBreedsTab } from "@/components/groomer/GroomerBreedsTab";
import { GroomerDocumentsTab } from "@/components/groomer/GroomerDocumentsTab";
import { GroomerPurchaseRequestsTab } from "@/components/groomer/GroomerPurchaseRequestsTab";
import { GroomerDailyBriefing } from "@/components/groomer/GroomerDailyBriefing";
import { ActivePackages } from "@/components/packages/ActivePackages";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths } from "date-fns";
import { useLocation, useNavigate } from "react-router-dom";

function GroomerFinanceView({ staffId }: { staffId: string }) {
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

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

  const { data: commissions = [] } = useQuery({
    queryKey: ["groomer-commissions", staffId, periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_records")
        .select("*, bookings(customer_name, dog_name, booking_date, services:service_id(name)), migrated_bookings(service_name, dog_name, booking_date, migrated_customers(full_name))")
        .eq("staff_id", staffId)
        .gte("created_at", `${periodStartStr}T00:00:00`)
        .lte("created_at", `${periodEndStr}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["groomer-payouts", staffId, periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_records")
        .select("*")
        .eq("staff_id", staffId)
        .gte("period_start", periodStartStr)
        .lte("period_end", periodEndStr)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const totalPay = commissions.reduce((sum, c) => sum + Number(c.groomer_pay), 0);
  const totalPaid = payouts.reduce((sum, p) => sum + Number(p.amount), 0);
  const offset = period === "weekly" ? weekOffset : monthOffset;
  const setOffset = period === "weekly" ? setWeekOffset : setMonthOffset;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Tabs value={period} onValueChange={v => { setPeriod(v as any); setWeekOffset(0); setMonthOffset(0); }}>
          <TabsList><TabsTrigger value="weekly">Weekly</TabsTrigger><TabsTrigger value="monthly">Monthly</TabsTrigger></TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset(o => o - 1)} className="text-xs underline">← Prev</button>
          <span className="text-xs font-medium">{format(periodStart, "dd MMM")} — {format(periodEnd, "dd MMM yyyy")}</span>
          <button onClick={() => setOffset(o => o + 1)} disabled={offset >= 0} className="text-xs underline disabled:opacity-30">Next →</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Dogs</p><p className="text-xl font-bold">{commissions.length}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">My Earnings</p><p className="text-xl font-bold text-primary">£{totalPay.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Paid Out</p><p className="text-xl font-bold">£{totalPaid.toFixed(2)}</p></CardContent></Card>
      </div>

      {commissions.length > 0 ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Earnings Breakdown</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Service</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Pay</TableHead></TableRow></TableHeader>
              <TableBody>
                {(() => {
                  const grouped = new Map<string, any[]>();
                  for (const c of commissions) {
                    const isMigrated = c.booking_source === "migrated" || c.migrated_booking_id;
                    const dateStr = isMigrated
                      ? c.migrated_bookings?.booking_date
                      : c.bookings?.booking_date;
                    const key = dateStr || "Unknown";
                    if (!grouped.has(key)) grouped.set(key, []);
                    grouped.get(key)!.push(c);
                  }
                  const sortedDays = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));
                  
                  return sortedDays.flatMap(([dateKey, items]) => [
                    <TableRow key={`header-${dateKey}`} className="bg-muted/60 hover:bg-muted/60">
                      <TableCell colSpan={4} className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {dateKey !== "Unknown" ? format(new Date(dateKey + "T00:00:00"), "EEEE, d MMMM yyyy") : "Unknown Date"}
                      </TableCell>
                    </TableRow>,
                    ...items.map((c: any) => {
                      const isMigrated = c.booking_source === "migrated" || c.migrated_booking_id;
                      const customerName = isMigrated
                        ? c.migrated_bookings?.migrated_customers?.full_name || "Wix Customer"
                        : c.bookings?.customer_name || "—";
                      const serviceName = isMigrated
                        ? c.migrated_bookings?.service_name || "—"
                        : c.bookings?.services?.name || "—";
                      return (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">
                          {customerName}
                          {isMigrated && <Badge className="ml-1 bg-amber-500 text-white hover:bg-amber-500 text-[8px] px-1 py-0">W</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">{serviceName}</TableCell>
                        <TableCell>
                          <Badge variant={c.commission_type === "no_show" ? "destructive" : c.commission_type === "own_customer" ? "default" : "secondary"} className="text-xs">
                            {c.commission_type === "own_customer" ? "Own 50%" : c.commission_type === "no_show" ? "No Show" : "40%"}
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
      ) : (
        <div className="text-center py-8">
          <PoundSterling className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No completed appointments this period</p>
        </div>
      )}
    </div>
  );
}

type Section = "overview" | "bookings" | "messages" | "breeds" | "finance" | "documents" | "purchases" | "packages";

const sectionToRoute: Record<Section, string> = {
  overview: "/portal",
  bookings: "/portal/bookings",
  messages: "/portal/messages",
  packages: "/admin/packages",
  purchases: "/portal/purchases",
  breeds: "/portal/breeds",
  finance: "/portal/finance",
  documents: "/portal/documents",
};

const routeToSection: Record<string, Section> = Object.fromEntries(
  Object.entries(sectionToRoute).map(([k, v]) => [v, k as Section])
);

const sectionCards: { id: Section; icon: React.ElementType; title: string; subtitle: string }[] = [
  { id: "bookings", icon: CalendarDays, title: "Bookings", subtitle: "Your schedule & salon calendar" },
  { id: "messages", icon: MessageSquare, title: "Messages", subtitle: "Customer enquiries & replies" },
  { id: "packages", icon: Package, title: "Package Deals", subtitle: "View active package bookings" },
  { id: "purchases", icon: ShoppingCart, title: "Purchase Requests", subtitle: "Request equipment & supplies" },
  { id: "breeds", icon: Dog, title: "Breeds", subtitle: "Pricing & duration reference" },
  { id: "finance", icon: PoundSterling, title: "Finance", subtitle: "Commission & payouts" },
  { id: "documents", icon: FileText, title: "Documents", subtitle: "Contract, policies & reports" },
];

const GroomerPortalPage = () => {
  const { user } = useAuth();
  const { role: userRole } = useUserRole(user?.id);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  const activeSection: Section = routeToSection[location.pathname] || "overview";

  useEffect(() => {
    if (!user) return;
    const fetchStaff = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("staff")
        .select("id, name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      setStaffId(data?.id ?? null);
      setStaffName(data?.name ?? "");
      setLoading(false);
    };
    fetchStaff();
  }, [user]);

  if (loading) {
    return (
      <GroomerLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </GroomerLayout>
    );
  }

  if (!staffId) {
    return (
      <GroomerLayout>
        <div className="text-center py-16 space-y-3">
          <CalendarDays className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground">Your staff profile is not linked yet. Please contact the studio.</p>
        </div>
      </GroomerLayout>
    );
  }

  const renderSectionContent = (section: Section) => {
    switch (section) {
      case "overview":
        return (
          <div className="space-y-6">
            <GroomerDailyBriefing staffId={staffId} groomerName={staffName} />
            {/* Mobile: show section cards for quick navigation */}
            {isMobile && (
              <div className="space-y-3">
                {sectionCards.map((card) => (
                  <button key={card.id} onClick={() => navigate(sectionToRoute[card.id])} className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:shadow-md transition-all active:scale-[0.98] flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0"><card.icon className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">{card.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      case "bookings": return <GroomerBookingsTab staffId={staffId} userRole={userRole} />;
      case "messages": return <GroomerMessagesTab staffId={staffId} />;
      case "breeds": return <GroomerBreedsTab />;
      case "documents": return <GroomerDocumentsTab staffId={staffId} />;
      case "finance": return <GroomerFinanceView staffId={staffId} />;
      case "purchases": return <GroomerPurchaseRequestsTab staffId={staffId} />;
      case "packages": return <ActivePackages />;
    }
  };

  const sectionMeta = activeSection === "overview"
    ? { title: "My Portal", subtitle: "Your schedule, messages & more" }
    : sectionCards.find(s => s.id === activeSection) || { title: "My Portal", subtitle: "" };

  return (
    <GroomerLayout>
      <div className="space-y-4">
        {activeSection !== "overview" && isMobile && (
          <button onClick={() => navigate("/portal")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}
        <div>
          <h1 className="text-2xl font-heading text-foreground">{sectionMeta.title}</h1>
          <p className="text-muted-foreground font-body text-sm mt-1">{sectionMeta.subtitle}</p>
        </div>
        {renderSectionContent(activeSection)}
      </div>
    </GroomerLayout>
  );
};

export default GroomerPortalPage;
