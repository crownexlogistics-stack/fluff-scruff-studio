import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle } from "lucide-react";
import { WIX_CUSTOMERS, type WixCustomer } from "./wixData";
import { format, differenceInMonths } from "date-fns";

interface MergedCustomer {
  name: string;
  email: string;
  phone: string;
  source: "Live" | "Historical (Wix)" | "Both";
  dogs: { name: string; breed: string }[];
  totalBookings: number;
  totalSpend: number;
  lastAppointment: string | null;
  appointments: { date: string; service: string; groomer: string; status: string; amount: number; source: string }[];
}

export default function CustomerLookupTab() {
  const [search, setSearch] = useState("");

  const { data: liveBookings } = useQuery({
    queryKey: ["historical-customer-lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("customer_name, customer_email, customer_phone, dog_name, booking_date, booking_time, total_price, status, staff_id")
        .order("booking_date", { ascending: false })
        .limit(1000);
      return data || [];
    },
  });

  const results = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (q.length < 2) return [];

    const merged: Map<string, MergedCustomer> = new Map();

    // Wix customers
    WIX_CUSTOMERS.forEach(c => {
      const fullName = `${c.firstName} ${c.lastName}`;
      const key = c.email.toLowerCase();
      const matches = fullName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q);
      if (!matches) return;

      const confirmedAppts = c.appointments.filter(a => a.status !== "Canceled");
      merged.set(key, {
        name: fullName,
        email: c.email,
        phone: c.phone,
        source: "Historical (Wix)",
        dogs: c.appointments
          .filter(a => a.dogName)
          .reduce((acc, a) => {
            if (!acc.find(d => d.name === a.dogName)) acc.push({ name: a.dogName!, breed: a.dogBreed || "" });
            return acc;
          }, [] as { name: string; breed: string }[]),
        totalBookings: c.appointments.length,
        totalSpend: confirmedAppts.reduce((s, a) => s + a.amount, 0),
        lastAppointment: c.appointments[0]?.date || null,
        appointments: c.appointments.map(a => ({ ...a, source: "WIX" })),
      });
    });

    // Live customers
    if (liveBookings) {
      const byEmail = new Map<string, typeof liveBookings>();
      liveBookings.forEach(b => {
        if (!b.customer_email) return;
        const key = b.customer_email.toLowerCase();
        if (!byEmail.has(key)) byEmail.set(key, []);
        byEmail.get(key)!.push(b);
      });

      byEmail.forEach((bookings, email) => {
        const first = bookings[0];
        const name = first.customer_name;
        const matches = name.toLowerCase().includes(q) || email.includes(q) || (first.customer_phone || "").includes(q);
        if (!matches) return;

        const liveAppts = bookings.map(b => ({
          date: b.booking_date,
          service: "Booking",
          groomer: "",
          status: b.status,
          amount: Number(b.total_price) || 0,
          source: "Live",
        }));

        if (merged.has(email)) {
          const existing = merged.get(email)!;
          existing.source = "Both";
          existing.totalBookings += bookings.length;
          existing.totalSpend += liveAppts.filter(a => a.status !== "Canceled").reduce((s, a) => s + a.amount, 0);
          existing.appointments = [...liveAppts, ...existing.appointments];
          if (bookings[0] && (!existing.lastAppointment || bookings[0].booking_date > existing.lastAppointment)) {
            existing.lastAppointment = bookings[0].booking_date;
          }
        } else {
          merged.set(email, {
            name,
            email: first.customer_email || email,
            phone: first.customer_phone || "",
            source: "Live",
            dogs: bookings
              .filter(b => b.dog_name)
              .reduce((acc, b) => {
                if (!acc.find(d => d.name === b.dog_name)) acc.push({ name: b.dog_name, breed: "" });
                return acc;
              }, [] as { name: string; breed: string }[]),
            totalBookings: bookings.length,
            totalSpend: liveAppts.filter(a => a.status !== "Canceled").reduce((s, a) => s + a.amount, 0),
            lastAppointment: bookings[0]?.booking_date || null,
            appointments: liveAppts,
          });
        }
      });
    }

    return Array.from(merged.values()).slice(0, 20);
  }, [search, liveBookings]);

  const sourceColor = (s: string) => {
    if (s === "Live") return { bg: "#FF6B35", color: "#fff" };
    if (s === "Both") return { bg: "#2D1B0E", color: "#fff" };
    return { bg: "#FFB800", color: "#2D1B0E" };
  };

  const isLapsed = (date: string | null) => {
    if (!date) return true;
    return differenceInMonths(new Date(), new Date(date)) > 6;
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#8B6F5C" }} />
        <Input
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-[30px] border-2 focus-visible:ring-2"
          style={{ borderColor: "#f0e6da", "--tw-ring-color": "#FF6B35" } as any}
        />
      </div>

      {search.length >= 2 && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No customers found matching "{search}"</p>
      )}

      {results.map(c => {
        const sc = sourceColor(c.source);
        return (
          <Card key={c.email} className="rounded-[20px] border-none shadow-sm overflow-hidden">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-heading font-bold text-lg" style={{ color: "#2D1B0E" }}>{c.name}</h3>
                  <p className="text-sm" style={{ color: "#8B6F5C" }}>{c.email} · {c.phone}</p>
                </div>
                <div className="flex gap-2">
                  <Badge style={{ backgroundColor: sc.bg, color: sc.color }} className="text-xs font-bold">{c.source}</Badge>
                  {isLapsed(c.lastAppointment) && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-xs font-bold gap-1">
                      <AlertTriangle className="h-3 w-3" /> Lapsed
                    </Badge>
                  )}
                </div>
              </div>

              {c.dogs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.dogs.map(d => (
                    <Badge key={d.name} variant="outline" className="rounded-full text-xs" style={{ borderColor: "#FFB800", color: "#2D1B0E" }}>
                      🐕 {d.name}{d.breed ? ` (${d.breed})` : ""}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-4 text-sm" style={{ color: "#8B6F5C" }}>
                <span><strong>{c.totalBookings}</strong> bookings</span>
                <span><strong>£{c.totalSpend.toLocaleString()}</strong> spent</span>
                <span>Last: {c.lastAppointment ? format(new Date(c.lastAppointment), "dd MMM yyyy") : "N/A"}</span>
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-xl" style={{ borderColor: "#f0e6da" }}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0" style={{ backgroundColor: "#FFFAF4" }}>
                    <tr>
                      <th className="text-left p-2 font-semibold" style={{ color: "#8B6F5C" }}>Date</th>
                      <th className="text-left p-2 font-semibold" style={{ color: "#8B6F5C" }}>Service</th>
                      <th className="text-left p-2 font-semibold" style={{ color: "#8B6F5C" }}>Status</th>
                      <th className="text-right p-2 font-semibold" style={{ color: "#8B6F5C" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.appointments
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((a, i) => (
                        <tr key={i} className="border-t" style={{ borderColor: "#f0e6da" }}>
                          <td className="p-2 whitespace-nowrap">
                            {format(new Date(a.date), "dd MMM yy")}
                            {a.source === "WIX" && (
                              <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 bg-gray-100 text-gray-500">WIX</Badge>
                            )}
                          </td>
                          <td className="p-2">{a.service}</td>
                          <td className="p-2">{a.status}</td>
                          <td className="p-2 text-right">£{a.amount}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
