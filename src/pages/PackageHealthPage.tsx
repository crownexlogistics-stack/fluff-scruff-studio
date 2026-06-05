import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HeartPulse,
  AlertTriangle,
  FileWarning,
  UserX,
  TimerOff,
  Loader2,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { format, formatDistanceToNow, isAfter } from "date-fns";
import { useState } from "react";
import { PackageDetailDialog } from "@/components/packages/PackageDetailDialog";
import { Link } from "react-router-dom";

type PackageBooking = {
  id: string;
  customer_name: string;
  customer_email: string;
  dog_name: string | null;
  status: string;
  tc_signed: boolean;
  tc_signed_at: string | null;
  sessions_total: number;
  sessions_used: number;
  total_paid: number;
  created_at: string;
  packages?: { name: string } | null;
};

type PackageSession = {
  id: string;
  package_booking_id: string;
  session_number: number;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  booking_id: string | null;
};

type TcSignature = {
  package_booking_id: string;
  status: string;
  token_expires_at: string | null;
  signed_at: string | null;
  email_sent_at: string | null;
};

export default function PackageHealthPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: packageBookings, isLoading: loadingPb } = useQuery({
    queryKey: ["pkg-health-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_bookings" as any)
        .select("*, packages(name)")
        .in("status", ["active"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PackageBooking[];
    },
  });

  const pbIds = useMemo(() => (packageBookings ?? []).map((p) => p.id), [packageBookings]);

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["pkg-health-sessions", pbIds.join(",")],
    queryFn: async () => {
      if (pbIds.length === 0) return [] as PackageSession[];
      const { data, error } = await supabase
        .from("package_sessions" as any)
        .select("id, package_booking_id, session_number, scheduled_date, scheduled_time, status, booking_id")
        .in("package_booking_id", pbIds);
      if (error) throw error;
      return data as unknown as PackageSession[];
    },
    enabled: pbIds.length > 0,
  });

  const { data: bookingStaffMap } = useQuery({
    queryKey: [
      "pkg-health-booking-staff",
      (sessions ?? []).map((s) => s.booking_id).filter(Boolean).join(","),
    ],
    queryFn: async () => {
      const bookingIds = (sessions ?? [])
        .map((s) => s.booking_id)
        .filter((v): v is string => !!v);
      if (bookingIds.length === 0) return {} as Record<string, string | null>;
      const { data, error } = await supabase
        .from("bookings")
        .select("id, staff_id")
        .in("id", bookingIds);
      if (error) throw error;
      const map: Record<string, string | null> = {};
      (data ?? []).forEach((b: any) => {
        map[b.id] = b.staff_id;
      });
      return map;
    },
    enabled: (sessions ?? []).some((s) => !!s.booking_id),
  });

  const { data: tcSignatures } = useQuery({
    queryKey: ["pkg-health-tc-tokens", pbIds.join(",")],
    queryFn: async () => {
      if (pbIds.length === 0) return [] as TcSignature[];
      const { data, error } = await supabase
        .from("package_tc_signatures" as any)
        .select("package_booking_id, status, token_expires_at, signed_at, email_sent_at")
        .in("package_booking_id", pbIds);
      if (error) throw error;
      return data as unknown as TcSignature[];
    },
    enabled: pbIds.length > 0,
  });

  const enriched = useMemo(() => {
    if (!packageBookings) return [];
    const sessionsByPb = new Map<string, PackageSession[]>();
    (sessions ?? []).forEach((s) => {
      const arr = sessionsByPb.get(s.package_booking_id) ?? [];
      arr.push(s);
      sessionsByPb.set(s.package_booking_id, arr);
    });

    const tcByPb = new Map<string, TcSignature>();
    (tcSignatures ?? []).forEach((t) => {
      const existing = tcByPb.get(t.package_booking_id);
      if (
        !existing ||
        (t.signed_at ?? t.token_expires_at ?? "") >
          (existing.signed_at ?? existing.token_expires_at ?? "")
      ) {
        tcByPb.set(t.package_booking_id, t);
      }
    });

    return packageBookings.map((pb) => {
      const pbSessions = sessionsByPb.get(pb.id) ?? [];
      const upcomingSessions = pbSessions.filter(
        (s) => s.status === "scheduled" || !s.booking_id,
      );
      const unassignedSessions = upcomingSessions.filter((s) => {
        if (!s.booking_id) return true;
        const staffId = bookingStaffMap?.[s.booking_id];
        return !staffId;
      });

      const tc = tcByPb.get(pb.id);
      const tokenExpired =
        !pb.tc_signed &&
        tc?.token_expires_at != null &&
        isAfter(new Date(), new Date(tc.token_expires_at));
      const tcMissing = !pb.tc_signed;

      const issueCount =
        (tcMissing ? 1 : 0) +
        (unassignedSessions.length > 0 ? 1 : 0) +
        (tokenExpired ? 1 : 0);

      return {
        pb,
        unassignedSessions,
        tcMissing,
        tokenExpired,
        tcExpiresAt: tc?.token_expires_at ?? null,
        tcEmailSentAt: tc?.email_sent_at ?? null,
        issueCount,
      };
    });
  }, [packageBookings, sessions, tcSignatures, bookingStaffMap]);

  const unsignedTc = enriched.filter((e) => e.tcMissing);
  const unassigned = enriched.filter((e) => e.unassignedSessions.length > 0);
  const expiredTokens = enriched.filter((e) => e.tokenExpired);
  const allIssues = enriched.filter((e) => e.issueCount > 0);
  const healthy = enriched.filter((e) => e.issueCount === 0);

  const isLoading = loadingPb || loadingSessions;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <HeartPulse className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Package Health</h1>
            <p className="text-sm text-muted-foreground">
              Catch issues before they become problems — unsigned T&Cs, unassigned
              groomers, expired signing links.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryCard
            label="With Issues"
            count={allIssues.length}
            icon={AlertTriangle}
            tone={allIssues.length > 0 ? "destructive" : "muted"}
          />
          <SummaryCard
            label="Unsigned T&Cs"
            count={unsignedTc.length}
            icon={FileWarning}
            tone={unsignedTc.length > 0 ? "warning" : "muted"}
          />
          <SummaryCard
            label="Unassigned Sessions"
            count={unassigned.length}
            icon={UserX}
            tone={unassigned.length > 0 ? "destructive" : "muted"}
          />
          <SummaryCard
            label="Expired Signing Links"
            count={expiredTokens.length}
            icon={TimerOff}
            tone={expiredTokens.length > 0 ? "warning" : "muted"}
          />
        </div>

        <Tabs defaultValue="issues" className="w-full">
          <TabsList>
            <TabsTrigger value="issues">
              All Issues ({allIssues.length})
            </TabsTrigger>
            <TabsTrigger value="unsigned">
              Unsigned T&Cs ({unsignedTc.length})
            </TabsTrigger>
            <TabsTrigger value="unassigned">
              Unassigned ({unassigned.length})
            </TabsTrigger>
            <TabsTrigger value="expired">
              Expired Links ({expiredTokens.length})
            </TabsTrigger>
            <TabsTrigger value="healthy">
              Healthy ({healthy.length})
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <TabsContent value="issues">
                <IssueTable rows={allIssues} onView={setSelectedId} />
              </TabsContent>
              <TabsContent value="unsigned">
                <IssueTable rows={unsignedTc} onView={setSelectedId} />
              </TabsContent>
              <TabsContent value="unassigned">
                <IssueTable rows={unassigned} onView={setSelectedId} />
              </TabsContent>
              <TabsContent value="expired">
                <IssueTable rows={expiredTokens} onView={setSelectedId} />
              </TabsContent>
              <TabsContent value="healthy">
                <IssueTable rows={healthy} onView={setSelectedId} hideIssues />
              </TabsContent>
            </>
          )}
        </Tabs>

        {selectedId && (
          <PackageDetailDialog
            packageBookingId={selectedId}
            open={!!selectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  label,
  count,
  icon: Icon,
  tone,
}: {
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "destructive" | "warning" | "muted";
}) {
  const toneClasses =
    tone === "destructive"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warning"
      ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
      : "border-border bg-card";
  const iconClasses =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
      ? "text-amber-600"
      : "text-muted-foreground";
  return (
    <Card className={toneClasses}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClasses}`} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{count}</div>
      </CardContent>
    </Card>
  );
}

function IssueTable({
  rows,
  onView,
  hideIssues = false,
}: {
  rows: ReturnType<
    typeof useMemo<
      {
        pb: PackageBooking;
        unassignedSessions: PackageSession[];
        tcMissing: boolean;
        tokenExpired: boolean;
        tcExpiresAt: string | null;
        tcEmailSentAt: string | null;
        issueCount: number;
      }[]
    >
  >;
  onView: (id: string) => void;
  hideIssues?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500 opacity-70" />
          <p>Nothing to flag here. </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Progress</TableHead>
              {!hideIssues && <TableHead>Issues</TableHead>}
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ pb, unassignedSessions, tcMissing, tokenExpired, tcExpiresAt }) => (
              <TableRow key={pb.id}>
                <TableCell>
                  <Link
                    to={`/admin/customers/${encodeURIComponent(pb.customer_email)}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {pb.customer_name}
                  </Link>
                  {pb.dog_name && (
                    <div className="text-xs text-muted-foreground">🐶 {pb.dog_name}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {pb.packages?.name ?? "Package"}
                </TableCell>
                <TableCell className="text-sm">
                  {pb.sessions_used} / {pb.sessions_total}
                </TableCell>
                {!hideIssues && (
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tcMissing && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                          <FileWarning className="h-3 w-3 mr-1" /> T&C unsigned
                        </Badge>
                      )}
                      {unassignedSessions.length > 0 && (
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          <UserX className="h-3 w-3 mr-1" />
                          {unassignedSessions.length} unassigned
                        </Badge>
                      )}
                      {tokenExpired && (
                        <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                          <TimerOff className="h-3 w-3 mr-1" />
                          Link expired
                          {tcExpiresAt &&
                            ` ${formatDistanceToNow(new Date(tcExpiresAt), {
                              addSuffix: true,
                            })}`}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(pb.created_at), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => onView(pb.id)}>
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
