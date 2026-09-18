import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Loader2, Ban, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { normalisePhone } from "@/lib/phoneNormalise";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { BlacklistReasonDialog } from "./BlacklistReasonDialog";
import { friendlyError } from "@/lib/friendlyError";

interface Candidate {
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
}

interface Props {
  activeKeys: Set<string>;
  onBlacklisted: () => void;
}

export function BlacklistSearchTab({ activeKeys, onBlacklisted }: Props) {
  const { staff } = useCurrentStaff();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [target, setTarget] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const runSearch = useCallback(async (term: string) => {
    const t = term.trim();
    if (t.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const pattern = `%${t}%`;
      const [bookingsRes, migratedRes, profilesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("customer_name, customer_email, customer_phone")
          .or(`customer_name.ilike.${pattern},customer_email.ilike.${pattern},customer_phone.ilike.${pattern}`)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("migrated_customers")
          .select("full_name, email, phone")
          .or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
          .limit(50),
        supabase
          .from("profiles")
          .select("full_name, phone")
          .ilike("full_name", pattern)
          .limit(50),
      ]);

      const map = new Map<string, Candidate>();
      const add = (c: Candidate) => {
        const key = `${(c.email || "").toLowerCase()}|${normalisePhone(c.phone) || ""}`;
        if (key === "|") return;
        if (!map.has(key)) map.set(key, c);
      };

      for (const b of bookingsRes.data || []) {
        add({ name: b.customer_name, email: b.customer_email, phone: b.customer_phone, source: "Booking" });
      }
      for (const m of migratedRes.data || []) {
        add({ name: m.full_name || "Unknown", email: m.email, phone: m.phone, source: "Customer record" });
      }
      for (const p of (profilesRes.data || []) as any[]) {
        add({ name: p.full_name || "Unknown", email: null, phone: p.phone ?? null, source: "Account" });
      }

      setResults(Array.from(map.values()).slice(0, 25));
      setSearched(true);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (v: string) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(v), 350);
  };

  const isBlacklisted = (c: Candidate) => {
    const email = c.email?.toLowerCase();
    const phone = normalisePhone(c.phone);
    return (!!email && activeKeys.has(`email:${email}`)) || (!!phone && activeKeys.has(`phone:${phone}`));
  };

  const handleConfirm = async (reason: string) => {
    if (!target) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("customer_blacklist").insert({
        customer_name: target.name,
        email: target.email ? target.email.toLowerCase() : null,
        phone_raw: target.phone || null,
        phone_normalised: normalisePhone(target.phone),
        reason,
        blacklisted_by_staff_id: staff?.id || null,
        blacklisted_by_name: staff?.name || "Unknown staff",
        status: "active",
      });
      if (error) throw error;
      toast.success(`${target.name} has been added to the blacklist.`);
      setTarget(null);
      onBlacklisted();
    } catch (e: any) {
      if (String(e?.message || "").includes("duplicate key")) {
        toast.error("This email or phone number is already on the blacklist.");
      } else {
        toast.error(friendlyError(e));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, surname, email or phone number (min 3 characters)…"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {searched && results.length === 0 && !searching && (
        <p className="text-sm text-muted-foreground">No customers found for that search.</p>
      )}

      <div className="space-y-2">
        {results.map((c, i) => {
          const blocked = isBlacklisted(c);
          return (
            <Card key={i} className="p-3 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{c.name}</p>
                  <Badge variant="outline" className="text-[10px]">{c.source}</Badge>
                  {blocked && (
                    <Badge variant="destructive" className="text-[10px] gap-1">
                      <ShieldAlert className="h-3 w-3" /> Blacklisted
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "No email or phone on record"}
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                disabled={blocked || (!c.email && !c.phone)}
                onClick={() => setTarget(c)}
              >
                <Ban className="h-4 w-4 mr-1.5" />
                Blacklist this account
              </Button>
            </Card>
          );
        })}
      </div>

      <BlacklistReasonDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Blacklist ${target?.name || ""}`}
        description="This blocks their email address and phone number from making any booking. The customer is never told they are blacklisted."
        confirmLabel="Blacklist account"
        destructive
        saving={saving}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
