import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerResult {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  dog_name: string;
  breed_id: string | null;
  dogs: { name: string; breed_id: string | null }[];
  source?: "booking" | "migrated" | "profile";
}

interface Props {
  onSelect: (customer: CustomerResult) => void;
  onAddNew: () => void;
  disabled?: boolean;
  initialSelectedName?: string | null;
}

export function CustomerSearchInput({ onSelect, onAddNew, disabled, initialSelectedName }: Props) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(initialSelectedName || null);
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setSelectedName(initialSelectedName || null);
  }, [initialSelectedName]);

  const searchCustomers = useCallback(async (term: string) => {
    if (term.trim().length < 3) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const map = new Map<string, CustomerResult>();
      const pattern = `%${term}%`;

      // Search bookings and migrated_customers in parallel
      const [bookingsRes, migratedRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("customer_name, customer_email, customer_phone, dog_name, breed_id")
          .or(`customer_name.ilike.${pattern},customer_email.ilike.${pattern}`)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("migrated_customers")
          .select("id, full_name, email, phone")
          .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
          .limit(20),
      ]);

      for (const b of bookingsRes.data || []) {
        const key = (b.customer_email || b.customer_phone || b.customer_name).toLowerCase().trim();
        if (map.has(key)) {
          const existing = map.get(key)!;
          if (b.dog_name && !existing.dogs.some(d => d.name.toLowerCase() === b.dog_name.toLowerCase())) {
            existing.dogs.push({ name: b.dog_name, breed_id: b.breed_id });
          }
        } else {
          map.set(key, {
            customer_name: b.customer_name,
            customer_email: b.customer_email || "",
            customer_phone: b.customer_phone || "",
            dog_name: b.dog_name,
            breed_id: b.breed_id,
            dogs: b.dog_name ? [{ name: b.dog_name, breed_id: b.breed_id }] : [],
            source: "booking",
          });
        }
      }

      for (const mc of migratedRes.data || []) {
        const key = (mc.email || mc.phone || mc.full_name || "").toLowerCase().trim();
        if (!key || map.has(key)) continue;
        const phoneKey = mc.phone?.toLowerCase().trim();
        if (phoneKey && Array.from(map.values()).some(v => v.customer_phone && v.customer_phone.replace(/\s/g, '') === phoneKey.replace(/\s/g, ''))) continue;

        map.set(key, {
          customer_name: mc.full_name || "Unknown",
          customer_email: mc.email || "",
          customer_phone: mc.phone || "",
          dog_name: "",
          breed_id: null,
          dogs: [],
          source: "migrated",
        });
      }

      setResults(Array.from(map.values()).slice(0, 10));
    } catch (err) {
      console.error("Customer search error:", err);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setShowResults(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => searchCustomers(value), 300);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setTimeout(() => setShowResults(false), 50);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (c: CustomerResult) => {
    setSelectedName(c.customer_name);
    setQuery("");
    setResults([]);
    setShowResults(false);
    onSelect(c);
  };

  const handleClear = () => {
    setSelectedName(null);
    setQuery("");
    setResults([]);
    onAddNew();
  };

  if (selectedName) {
    return (
      <div className="space-y-1">
        <Label>Customer</Label>
        <div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium flex-1">{selectedName}</span>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={handleClear}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 relative" ref={wrapperRef}>
      <Label>Search Customer</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email (min 3 chars)..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setShowResults(true)}
          className="pl-9"
          disabled={disabled}
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {showResults && query.trim().length >= 3 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {results.length > 0 ? (
            results.map((c, i) => (
              <button
                key={i}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0"
                onClick={() => handleSelect(c)}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium flex-1">{c.customer_name}</p>
                  {c.source === "migrated" && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400 text-amber-600 bg-amber-50">W</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {[c.customer_email, c.customer_phone].filter(Boolean).join(" · ")}
                  {c.dogs.length > 0 && ` · 🐕 ${c.dogs.map(d => d.name).join(", ")}`}
                </p>
              </button>
            ))
          ) : searching ? (
            <div className="p-3 text-center text-sm text-muted-foreground">Searching...</div>
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground">No customers found</div>
          )}
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2 text-sm font-medium text-primary border-t"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowResults(false);
              setTimeout(() => onAddNew(), 0);
            }}
          >
            <UserPlus className="h-4 w-4" />
            Add New Customer
          </button>
        </div>
      )}
    </div>
  );
}
