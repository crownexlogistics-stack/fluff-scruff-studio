import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { UsersRound, UserCheck, UserX, TrendingUp } from "lucide-react";

type FilterType = "all" | "returning" | "one-time" | "new";

interface CustomerSummary {
  name: string;
  email: string | null;
  phone: string | null;
  bookingCount: number;
  firstBooking: string;
  lastBooking: string;
}

export function CustomersSection() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["all-bookings-for-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("customer_name, customer_email, customer_phone, booking_date, created_at")
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Also fetch migrated customers + their booking counts
  const { data: migratedData } = useQuery({
    queryKey: ["migrated-customers-for-section"],
    queryFn: async () => {
      const { data: customers, error } = await supabase
        .from("migrated_customers")
        .select("id, full_name, email, phone, created_at")
        .not("email", "is", null);
      if (error) throw error;

      // Fetch migrated bookings counts in one go
      const { data: mBookings, error: mbErr } = await supabase
        .from("migrated_bookings")
        .select("migrated_customer_id, booking_date");
      if (mbErr) throw mbErr;

      return { customers: customers || [], bookings: mBookings || [] };
    },
  });


  const customers = useMemo(() => {
    const map = new Map<string, CustomerSummary>();

    // Add bookings data
    for (const b of bookings || []) {
      const key = (b.customer_email || b.customer_name).toLowerCase().trim();
      const existing = map.get(key);

      if (existing) {
        existing.bookingCount++;
        if (b.booking_date < existing.firstBooking) existing.firstBooking = b.booking_date;
        if (b.booking_date > existing.lastBooking) existing.lastBooking = b.booking_date;
        if (!existing.email && b.customer_email) existing.email = b.customer_email;
        if (!existing.phone && b.customer_phone) existing.phone = b.customer_phone;
      } else {
        map.set(key, {
          name: b.customer_name,
          email: b.customer_email,
          phone: b.customer_phone,
          bookingCount: 1,
          firstBooking: b.booking_date,
          lastBooking: b.booking_date,
        });
      }
    }

    // Add migrated customers (only if not already in map from bookings)
    if (migratedData) {
      // Build a booking count map for migrated bookings
      const mBookingMap = new Map<string, { count: number; first: string; last: string }>();
      for (const mb of migratedData.bookings) {
        const existing = mBookingMap.get(mb.migrated_customer_id);
        if (existing) {
          existing.count++;
          if (mb.booking_date < existing.first) existing.first = mb.booking_date;
          if (mb.booking_date > existing.last) existing.last = mb.booking_date;
        } else {
          mBookingMap.set(mb.migrated_customer_id, {
            count: 1,
            first: mb.booking_date,
            last: mb.booking_date,
          });
        }
      }

      for (const mc of migratedData.customers) {
        if (!mc.email) continue;
        const key = mc.email.toLowerCase().trim();
        if (map.has(key)) {
          // Merge migrated booking counts into existing entry
          const existing = map.get(key)!;
          const mStats = mBookingMap.get(mc.id);
          if (mStats) {
            existing.bookingCount += mStats.count;
            if (mStats.first < existing.firstBooking) existing.firstBooking = mStats.first;
            if (mStats.last > existing.lastBooking) existing.lastBooking = mStats.last;
          }
          if (!existing.phone && mc.phone) existing.phone = mc.phone;
        } else {
          const mStats = mBookingMap.get(mc.id);
          map.set(key, {
            name: mc.full_name || "Unknown",
            email: mc.email,
            phone: mc.phone,
            bookingCount: mStats?.count || 0,
            firstBooking: mStats?.first || mc.created_at?.slice(0, 10) || "2024-01-01",
            lastBooking: mStats?.last || mc.created_at?.slice(0, 10) || "2024-01-01",
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.lastBooking.localeCompare(a.lastBooking));
  }, [bookings, migratedData]);

  const totalCustomers = customers.length;
  const returningCustomers = customers.filter((c) => c.bookingCount >= 2);
  const oneTimeCustomers = customers.filter((c) => c.bookingCount === 1);

  const now = new Date();
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const newThisMonth = customers.filter((c) => c.firstBooking >= thisMonthStart);
  const newLastMonth = customers.filter((c) => c.firstBooking >= lastMonthKey && c.firstBooking < lastMonthEnd);
  const growthDiff = newThisMonth.length - newLastMonth.length;

  const filteredCustomers = useMemo(() => {
    switch (filter) {
      case "returning":
        return returningCustomers;
      case "one-time":
        return oneTimeCustomers;
      case "new":
        return newThisMonth;
      default:
        return customers;
    }
  }, [filter, customers, returningCustomers, oneTimeCustomers, newThisMonth]);

  const cards: { key: FilterType; label: string; value: number; subtitle: string; icon: React.ElementType; color: string }[] = [
    {
      key: "all",
      label: "Total Customers",
      value: totalCustomers,
      subtitle: "All-time unique customers",
      icon: UsersRound,
      color: "text-primary",
    },
    {
      key: "returning",
      label: "Returning",
      value: returningCustomers.length,
      subtitle: `${totalCustomers ? Math.round((returningCustomers.length / totalCustomers) * 100) : 0}% retention rate`,
      icon: UserCheck,
      color: "text-emerald-600",
    },
    {
      key: "one-time",
      label: "One-Time Only",
      value: oneTimeCustomers.length,
      subtitle: "Never re-booked",
      icon: UserX,
      color: "text-orange-500",
    },
    {
      key: "new",
      label: "New This Month",
      value: newThisMonth.length,
      subtitle: growthDiff > 0 ? `+${growthDiff} vs last month` : growthDiff < 0 ? `${growthDiff} vs last month` : "Same as last month",
      icon: TrendingUp,
      color: "text-blue-500",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 h-28" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const isActive = filter === card.key;
          return (
            <Card
              key={card.key}
              className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${
                isActive ? "ring-2 ring-primary shadow-md" : ""
              }`}
              onClick={() => setFilter(isActive ? "all" : card.key)}
            >
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <Icon className={`h-5 w-5 ${card.color}`} />
                  {isActive && (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold font-heading">{card.value}</p>
                <div>
                  <p className="text-sm font-medium text-foreground">{card.label}</p>
                  <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtered Label */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-semibold">
          {filter === "all" ? "All Customers" : filter === "returning" ? "Returning Customers" : filter === "one-time" ? "One-Time Customers" : "New This Month"}
        </h3>
        <p className="text-sm text-muted-foreground">{filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Customer List */}
      {filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No customers found in this category yet.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 py-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Name</span>
            <span>Email</span>
            <span className="w-32">Phone</span>
            <span className="w-20 text-right">Bookings</span>
          </div>
          <div className="divide-y divide-border">
            {filteredCustomers.map((customer, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-1 sm:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <p
                  className="font-medium text-sm text-foreground truncate cursor-pointer hover:underline"
                  onClick={() => {
                    if (customer.email) {
                      navigate(`/admin/customers/${encodeURIComponent(customer.email)}`);
                    } else if (customer.phone) {
                      navigate(`/admin/customers/${encodeURIComponent(`phone:${customer.phone}`)}`);
                    }
                  }}
                >
                  {customer.name}
                </p>
                <p className="text-sm text-muted-foreground truncate">{customer.email || "—"}</p>
                <p className="text-sm text-muted-foreground w-32 truncate">{customer.phone || "—"}</p>
                <p className="text-sm font-medium text-right w-20">
                  <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-semibold ${
                    customer.bookingCount >= 2 ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                  }`}>
                    {customer.bookingCount}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
