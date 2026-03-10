import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 20;
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function BookingRecordsTab() {
  const [yearFilter, setYearFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  const { data: allRecords, isLoading } = useQuery({
    queryKey: ["wix-booking-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wix_historical_bookings")
        .select("*")
        .order("appointment_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!allRecords) return [];
    let data = allRecords;
    if (yearFilter !== "All") data = data.filter((d: any) => d.created_year?.toString() === yearFilter);
    if (monthFilter !== "All") data = data.filter((d: any) => d.created_month?.toString() === monthFilter);
    if (statusFilter !== "All") data = data.filter((d: any) => d.booking_status === statusFilter);
    if (paymentFilter !== "All") data = data.filter((d: any) => d.payment_status === paymentFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((d: any) => (d.customer_name || "").toLowerCase().includes(q) || (d.customer_email || "").toLowerCase().includes(q));
    }
    return data;
  }, [allRecords, yearFilter, monthFilter, statusFilter, paymentFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const availableYears = useMemo(() => {
    if (!allRecords) return [];
    return [...new Set(allRecords.map((r: any) => r.created_year).filter(Boolean))].sort();
  }, [allRecords]);

  const exportCSV = () => {
    const headers = ["Date", "Customer", "Email", "Service", "Groomer", "Status", "Payment", "Amount"];
    const rows = filtered.map((r: any) => [
      r.appointment_date ? format(new Date(r.appointment_date), "yyyy-MM-dd") : "",
      r.customer_name, r.customer_email, r.service_name, r.groomer_name,
      r.booking_status, r.payment_status, r.price_charged,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wix-historical-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 rounded-[30px]" /><Skeleton className="h-64 rounded-[20px]" /></div>;
  }

  if (!allRecords || allRecords.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm" style={{ color: "#8B6F5C" }}>No booking records yet. Import a Wix CSV from the "Import Data" tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={yearFilter} onValueChange={v => { setYearFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[100px] rounded-[30px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Years</SelectItem>
            {availableYears.map(y => <SelectItem key={y} value={y!.toString()}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={v => { setMonthFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[120px] rounded-[30px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Months</SelectItem>
            {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[120px] rounded-[30px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            <SelectItem value="Confirmed">Confirmed</SelectItem>
            <SelectItem value="Canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={v => { setPaymentFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[120px] rounded-[30px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Payment</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Not Paid">Not Paid</SelectItem>
            <SelectItem value="Partially Paid">Partially Paid</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search name or email"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          className="w-[180px] rounded-[30px] text-xs"
        />
        <div className="ml-auto">
          <Button size="sm" className="rounded-[30px] gap-1.5 text-xs font-bold" style={{ backgroundColor: "#FF6B35" }} onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <p className="text-xs" style={{ color: "#8B6F5C" }}>{filtered.length} records found</p>

      {/* Table */}
      <div className="rounded-[20px] border overflow-hidden" style={{ borderColor: "#f0e6da" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ backgroundColor: "#FFFAF4" }}>
              <TableHead className="text-xs font-semibold" style={{ color: "#8B6F5C" }}>Date</TableHead>
              <TableHead className="text-xs font-semibold" style={{ color: "#8B6F5C" }}>Customer</TableHead>
              <TableHead className="text-xs font-semibold hidden sm:table-cell" style={{ color: "#8B6F5C" }}>Service</TableHead>
              <TableHead className="text-xs font-semibold hidden md:table-cell" style={{ color: "#8B6F5C" }}>Groomer</TableHead>
              <TableHead className="text-xs font-semibold" style={{ color: "#8B6F5C" }}>Status</TableHead>
              <TableHead className="text-xs font-semibold hidden sm:table-cell" style={{ color: "#8B6F5C" }}>Payment</TableHead>
              <TableHead className="text-xs font-semibold text-right" style={{ color: "#8B6F5C" }}>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.map((r: any) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setSelectedBooking(r)}>
                <TableCell className="text-xs whitespace-nowrap">
                  {r.appointment_date ? format(new Date(r.appointment_date), "dd MMM yy") : "N/A"}
                  <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 bg-gray-100 text-gray-500">WIX</Badge>
                </TableCell>
                <TableCell className="text-xs font-medium">{r.customer_name}</TableCell>
                <TableCell className="text-xs hidden sm:table-cell">{r.service_name}</TableCell>
                <TableCell className="text-xs hidden md:table-cell">{r.groomer_name}</TableCell>
                <TableCell className="text-xs">
                  <Badge variant="outline" className="text-[10px] rounded-full" style={{
                    borderColor: (r.booking_status || "").toLowerCase().includes("cancel") ? "#ef4444" : "#22c55e",
                    color: (r.booking_status || "").toLowerCase().includes("cancel") ? "#ef4444" : "#16a34a",
                  }}>{r.booking_status}</Badge>
                </TableCell>
                <TableCell className="text-xs hidden sm:table-cell">{r.payment_status}</TableCell>
                <TableCell className="text-xs text-right font-medium">£{Number(r.price_charged || 0).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" className="rounded-[30px]" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs" style={{ color: "#8B6F5C" }}>Page {page + 1} of {totalPages}</span>
          <Button size="sm" variant="outline" className="rounded-[30px]" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <SheetContent className="overflow-y-auto">
          {selectedBooking && (
            <>
              <SheetHeader>
                <SheetTitle className="font-heading" style={{ color: "#2D1B0E" }}>Booking Details</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <Badge variant="secondary" className="bg-gray-100 text-gray-500 text-xs">WIX Historical Record</Badge>
                <div className="space-y-3 text-sm">
                  {[
                    ["Date", selectedBooking.appointment_date ? format(new Date(selectedBooking.appointment_date), "dd MMMM yyyy") : "N/A"],
                    ["Customer", selectedBooking.customer_name],
                    ["Email", selectedBooking.customer_email],
                    ["Phone", selectedBooking.customer_phone],
                    ["Service", selectedBooking.service_name],
                    ["Groomer", selectedBooking.groomer_name],
                    ["Status", selectedBooking.booking_status],
                    ["Payment", selectedBooking.payment_status],
                    ["Amount", `£${Number(selectedBooking.price_charged || 0).toFixed(2)}`],
                    ["Dog Name", selectedBooking.dog_name],
                    ["Dog Breed", selectedBooking.dog_breed],
                    ["Dog Age", selectedBooking.dog_age],
                    ["Message", selectedBooking.customer_message],
                    ["Order Number", selectedBooking.wix_order_number],
                  ]
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={label} className="flex justify-between border-b pb-2" style={{ borderColor: "#f0e6da" }}>
                        <span className="font-medium" style={{ color: "#8B6F5C" }}>{label}</span>
                        <span style={{ color: "#2D1B0E" }}>{value}</span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
