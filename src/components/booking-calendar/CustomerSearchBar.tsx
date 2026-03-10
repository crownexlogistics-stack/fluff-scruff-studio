import { useState, useCallback, useRef } from "react";
import { Search, X, Phone, Mail, Dog, User, CalendarPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SearchResult {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  dog_name: string;
  last_staff_name: string | null;
  last_staff_id: string | null;
  last_booking_date: string | null;
  is_own_customer: boolean;
  source: "booking" | "migrated";
}

interface CustomerSearchBarProps {
  currentStaffId?: string;
  className?: string;
}

export function CustomerSearchBar({ currentStaffId, className }: CustomerSearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const customerMap = new Map<string, SearchResult>();

      // Source 1: bookings
      const { data, error } = await supabase
        .from("bookings")
        .select("customer_name, customer_email, customer_phone, dog_name, staff_id, booking_date, staff(name)")
        .or(`customer_name.ilike.%${q}%,customer_email.ilike.%${q}%,customer_phone.ilike.%${q}%,dog_name.ilike.%${q}%`)
        .order("booking_date", { ascending: false })
        .limit(50);

      if (error) throw error;

      (data || []).forEach((b: any) => {
        const key = (b.customer_email || b.customer_phone || b.customer_name).toLowerCase();
        if (!customerMap.has(key)) {
          customerMap.set(key, {
            customer_name: b.customer_name,
            customer_email: b.customer_email,
            customer_phone: b.customer_phone,
            dog_name: b.dog_name,
            last_staff_name: b.staff?.name || null,
            last_staff_id: b.staff_id,
            last_booking_date: b.booking_date,
            is_own_customer: currentStaffId ? b.staff_id === currentStaffId : true,
            source: "booking",
          });
        }
      });

      // Source 2: migrated_customers
      const { data: migrated } = await supabase
        .from("migrated_customers")
        .select("id, full_name, email, phone")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(20);

      for (const mc of migrated || []) {
        const key = (mc.email || mc.phone || mc.full_name || "").toLowerCase();
        if (!key || customerMap.has(key)) continue;

        // Phone dedup
        const phoneNorm = mc.phone?.replace(/\s/g, '');
        if (phoneNorm && Array.from(customerMap.values()).some(v => v.customer_phone?.replace(/\s/g, '') === phoneNorm)) continue;

        const { data: mbData } = await supabase
          .from("migrated_bookings")
          .select("dog_name, staff_name, booking_date")
          .eq("migrated_customer_id", mc.id)
          .order("booking_date", { ascending: false })
          .limit(1);
        const mb = mbData?.[0];
        customerMap.set(key, {
          customer_name: mc.full_name || "Unknown",
          customer_email: mc.email,
          customer_phone: mc.phone,
          dog_name: mb?.dog_name || "Unknown",
          last_staff_name: mb?.staff_name || null,
          last_staff_id: null,
          last_booking_date: mb?.booking_date || null,
          is_own_customer: false,
          source: "migrated",
        });
      }

      setResults(Array.from(customerMap.values()));
      setOpen(true);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setLoading(false);
    }
  }, [currentStaffId]);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: SearchResult) => {
    if (result.customer_email) {
      navigate(`/admin/customers/${encodeURIComponent(result.customer_email)}`);
    }
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, phone, or dog name..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="pl-9 pr-9"
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.map((r, i) => (
            <div
              key={i}
              className="px-4 py-3 hover:bg-accent cursor-pointer border-b last:border-b-0 transition-colors"
              onClick={() => handleSelect(r)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate">{r.customer_name}</span>
                    {r.source === "migrated" && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400 text-amber-600 bg-amber-50">W</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {r.customer_email && (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.customer_email}</span>
                    )}
                    {r.customer_phone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.customer_phone}</span>
                    )}
                    <span className="flex items-center gap-1"><Dog className="h-3 w-3" />{r.dog_name}</span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {r.is_own_customer ? (
                    <Badge variant="default" className="text-[10px]">Your customer</Badge>
                  ) : (
                    <div className="space-y-1">
                      {r.last_staff_name && (
                        <Badge variant="outline" className="text-[10px]">
                          Last with {r.last_staff_name}
                        </Badge>
                      )}
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] gap-1 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/book");
                          }}
                        >
                          <CalendarPlus className="h-3 w-3" /> Book
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-4 text-center text-sm text-muted-foreground">
          No customers found for "{query}"
        </div>
      )}
    </div>
  );
}
