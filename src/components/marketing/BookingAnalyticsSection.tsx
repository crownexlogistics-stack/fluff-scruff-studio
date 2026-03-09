import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/config/rolePermissions";
import { Navigate } from "react-router-dom";
import { subDays, subWeeks, subMonths, subYears, startOfDay, startOfWeek, startOfMonth, startOfYear, format, differenceInDays, differenceInWeeks, parseISO, getDay, getHours, isAfter, isBefore } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import { BookingVolumeSection } from "./analytics/BookingVolumeSection";
import { CustomerRetentionSection } from "./analytics/CustomerRetentionSection";
import { GroomerRebookingSection } from "./analytics/GroomerRebookingSection";
import { CancellationIntelligenceSection } from "./analytics/CancellationIntelligenceSection";
import { CustomerLifetimeValueSection } from "./analytics/CustomerLifetimeValueSection";
import { OverdueCustomersSection } from "./analytics/OverdueCustomersSection";
import { QuickActionsBar } from "./analytics/QuickActionsBar";

type Period = "today" | "week" | "month" | "year" | "all";

function getDateRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  switch (period) {
    case "today": return { start: startOfDay(now), end };
    case "week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end };
    case "month": return { start: startOfMonth(now), end };
    case "year": return { start: startOfYear(now), end };
    case "all": return { start: new Date("2020-01-01"), end };
  }
}

function getPreviousRange(period: Period): { start: Date; end: Date } {
  const { start, end } = getDateRange(period);
  const diff = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - diff), end: new Date(start.getTime()) };
}

export interface BookingRecord {
  id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_email: string | null;
  dog_name: string;
  status: string;
  total_price: number;
  deposit_paid: number;
  final_charge: number | null;
  created_at: string;
  staff_id: string | null;
  service_id: string | null;
  breed_id: string | null;
  referral_source: string | null;
  is_groomers_own_customer: boolean;
  duration_minutes: number | null;
  notes: string | null;
}

export interface MigratedBookingRecord {
  id: string;
  booking_date: string;
  booking_time: string | null;
  service_name: string;
  total_price: number | null;
  deposit_paid: number | null;
  staff_name: string | null;
  dog_name: string | null;
  dog_breed: string | null;
  is_future_booking: boolean;
  payment_status: string | null;
  migrated_customer_id: string;
  notes: string | null;
}

export interface MigratedCustomerRecord {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface StaffRecord {
  id: string;
  name: string;
  role: string;
  auth_user_id: string | null;
}

export function BookingAnalyticsSection() {
  const { isDirector, isManager, isGroomer } = usePermissions();
  const [period, setPeriod] = useState<Period>("month");
  const [compare, setCompare] = useState(false);

  const { data: bookings, isLoading: loadingBookings, refetch: refetchBookings } = useQuery({
    queryKey: ["analytics-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("id, booking_date, booking_time, customer_name, customer_email, dog_name, status, total_price, deposit_paid, final_charge, created_at, staff_id, service_id, breed_id, referral_source, is_groomers_own_customer, duration_minutes, notes");
      if (error) throw error;
      return (data || []) as BookingRecord[];
    },
  });

  const { data: migratedBookings, isLoading: loadingMigrated } = useQuery({
    queryKey: ["analytics-migrated-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("migrated_bookings").select("id, booking_date, booking_time, service_name, total_price, deposit_paid, staff_name, dog_name, dog_breed, is_future_booking, payment_status, migrated_customer_id, notes");
      if (error) throw error;
      return (data || []) as MigratedBookingRecord[];
    },
  });

  const { data: migratedCustomers } = useQuery({
    queryKey: ["analytics-migrated-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("migrated_customers").select("id, full_name, email, phone, status");
      if (error) throw error;
      return (data || []) as MigratedCustomerRecord[];
    },
  });

  const { data: staff } = useQuery({
    queryKey: ["analytics-staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name, role, auth_user_id");
      if (error) throw error;
      return (data || []) as StaffRecord[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["analytics-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name");
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingBookings || loadingMigrated;

  const dateRange = useMemo(() => getDateRange(period), [period]);
  const prevRange = useMemo(() => getPreviousRange(period), [period]);

  const migratedCustomerMap = useMemo(() => {
    const map = new Map<string, MigratedCustomerRecord>();
    (migratedCustomers || []).forEach(c => map.set(c.id, c));
    return map;
  }, [migratedCustomers]);

  const staffMap = useMemo(() => {
    const map = new Map<string, StaffRecord>();
    (staff || []).forEach(s => map.set(s.id, s));
    return map;
  }, [staff]);

  const serviceMap = useMemo(() => {
    const map = new Map<string, string>();
    (services || []).forEach(s => map.set(s.id, s.name));
    return map;
  }, [services]);

  const overdueCustomers = useMemo(() => {
    if (!bookings || !migratedBookings) return [];
    const customerLastVisit = new Map<string, { name: string; email: string; date: string; dogName: string; groomer: string }>();
    const customerFutureBooking = new Set<string>();
    const today = new Date();

    bookings.forEach(b => {
      const email = b.customer_email?.toLowerCase();
      if (!email) return;
      const bDate = parseISO(b.booking_date);
      if (isAfter(bDate, today) && b.status !== "Cancelled") {
        customerFutureBooking.add(email);
      }
      if (b.status === "Completed" || (isBefore(bDate, today) && b.status !== "Cancelled")) {
        const existing = customerLastVisit.get(email);
        if (!existing || b.booking_date > existing.date) {
          customerLastVisit.set(email, {
            name: b.customer_name,
            email,
            date: b.booking_date,
            dogName: b.dog_name,
            groomer: staffMap.get(b.staff_id || "")?.name || "Unknown",
          });
        }
      }
    });

    migratedBookings.forEach(mb => {
      const mc = migratedCustomerMap.get(mb.migrated_customer_id);
      const email = mc?.email?.toLowerCase();
      if (!email) return;
      const existing = customerLastVisit.get(email);
      if (!existing || mb.booking_date > existing.date) {
        customerLastVisit.set(email, {
          name: mc?.full_name || "Unknown",
          email,
          date: mb.booking_date,
          dogName: mb.dog_name || "Unknown",
          groomer: mb.staff_name || "Unknown",
        });
      }
    });

    const result: { name: string; email: string; lastVisit: string; dogName: string; groomer: string; daysOverdue: number; category: "overdue" | "at_risk" | "lost" }[] = [];
    customerLastVisit.forEach((val, email) => {
      if (customerFutureBooking.has(email)) return;
      const days = differenceInDays(today, parseISO(val.date));
      if (days >= 42) {
        result.push({
          ...val,
          lastVisit: val.date,
          daysOverdue: days,
          category: days >= 180 ? "lost" : days >= 84 ? "at_risk" : "overdue",
        });
      }
    });
    return result.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [bookings, migratedBookings, migratedCustomerMap, staffMap]);

  const handleRefresh = () => {
    refetchBookings();
  };

  if (isGroomer) return <Navigate to="/portal" replace />;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const allBookings = bookings || [];
  const allMigrated = migratedBookings || [];

  return (
    <div className="space-y-8">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        {(["today", "week", "month", "year", "all"] as Period[]).map(p => (
          <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
            {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : p === "year" ? "This Year" : "All Time"}
          </Button>
        ))}
        <div className="flex items-center gap-2 ml-4">
          <Switch id="compare" checked={compare} onCheckedChange={setCompare} />
          <Label htmlFor="compare" className="text-sm">Compare to previous period</Label>
        </div>
        <Button variant="ghost" size="icon" onClick={handleRefresh} className="ml-auto">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <BookingVolumeSection
        bookings={allBookings}
        migratedBookings={allMigrated}
        migratedCustomerMap={migratedCustomerMap}
        staffMap={staffMap}
        serviceMap={serviceMap}
        dateRange={dateRange}
        prevRange={prevRange}
        compare={compare}
        period={period}
      />

      <CustomerRetentionSection
        bookings={allBookings}
        migratedBookings={allMigrated}
        migratedCustomerMap={migratedCustomerMap}
        staffMap={staffMap}
        dateRange={dateRange}
        prevRange={prevRange}
        compare={compare}
      />

      <OverdueCustomersSection overdueCustomers={overdueCustomers} />

      <GroomerRebookingSection
        bookings={allBookings}
        migratedBookings={allMigrated}
        migratedCustomerMap={migratedCustomerMap}
        staffMap={staffMap}
        staff={staff || []}
        dateRange={dateRange}
        isDirector={isDirector}
      />

      <CancellationIntelligenceSection
        bookings={allBookings}
        serviceMap={serviceMap}
        dateRange={dateRange}
        prevRange={prevRange}
        compare={compare}
        period={period}
      />

      <CustomerLifetimeValueSection
        bookings={allBookings}
        migratedBookings={allMigrated}
        migratedCustomerMap={migratedCustomerMap}
        staffMap={staffMap}
      />

      <QuickActionsBar overdueCustomers={overdueCustomers} />
    </div>
  );
}
