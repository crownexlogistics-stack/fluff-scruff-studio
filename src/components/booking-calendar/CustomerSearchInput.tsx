import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerResult {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  dog_name: string;
  breed_id: string | null;
  dogs: { name: string; breed_id: string | null }[];
}

interface Props {
  onSelect: (customer: CustomerResult) => void;
  onAddNew: () => void;
  disabled?: boolean;
}

export function CustomerSearchInput({ onSelect, onAddNew, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch distinct customers from bookings
  const { data: customers } = useQuery({
    queryKey: ["customer-search-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("customer_name, customer_email, customer_phone, dog_name, breed_id")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Deduplicate by email (primary) or name
      const map = new Map<string, CustomerResult>();
      for (const b of data || []) {
        const key = (b.customer_email || b.customer_name).toLowerCase().trim();
        if (map.has(key)) {
          const existing = map.get(key)!;
          // Add dog if not already listed
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
          });
        }
      }
      return Array.from(map.values());
    },
  });

  const filtered = query.trim().length >= 2
    ? (customers || []).filter(c => {
        const q = query.toLowerCase();
        return (
          c.customer_name.toLowerCase().includes(q) ||
          c.customer_email.toLowerCase().includes(q) ||
          c.customer_phone.includes(q) ||
          c.dogs.some(d => d.name.toLowerCase().includes(q))
        );
      }).slice(0, 8)
    : [];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (c: CustomerResult) => {
    setSelectedName(c.customer_name);
    setQuery("");
    setShowResults(false);
    onSelect(c);
  };

  const handleClear = () => {
    setSelectedName(null);
    setQuery("");
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
          placeholder="Search by name, email, phone or dog..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="pl-9"
          disabled={disabled}
        />
      </div>

      {showResults && query.trim().length >= 2 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((c, i) => (
              <button
                key={i}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0"
                onClick={() => handleSelect(c)}
              >
                <p className="text-sm font-medium">{c.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[c.customer_email, c.customer_phone].filter(Boolean).join(" · ")}
                  {c.dogs.length > 0 && ` · 🐕 ${c.dogs.map(d => d.name).join(", ")}`}
                </p>
              </button>
            ))
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground">
              No customers found
            </div>
          )}
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2 text-sm font-medium text-primary border-t"
            onClick={() => {
              setShowResults(false);
              onAddNew();
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
