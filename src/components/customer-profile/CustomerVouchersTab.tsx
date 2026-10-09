import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Ticket, Gift, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Row = {
  id: string;
  kind: "coupon" | "voucher";
  code: string;
  label: string;
  when: string;
  bookingDate?: string | null;
  dog?: string | null;
  groomer?: string | null;
  saved?: number | null;
  status?: string | null;
  repeat?: boolean;
  appliedBy?: string | null;
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return format(parseISO(d), "d MMM yyyy"); } catch { return d; }
};

export function CustomerVouchersTab({ email }: { email: string }) {
  const lower = email.toLowerCase().trim();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["customer-vouchers-discounts", lower],
    queryFn: async (): Promise<Row[]> => {
      const out: Row[] = [];

      // Coupons / discount codes
      const { data: usages } = await supabase
        .from("coupon_usages")
        .select("id, used_at, applied_by_staff_name, coupon_id, coupons(code, discount_type, discount_value, max_uses_per_customer), bookings(booking_date, dog_name, total_price, status, staff(name))")
        .ilike("customer_email", lower)
        .order("used_at", { ascending: true });

      const seen: Record<string, number> = {};
      for (const u of (usages || []) as any[]) {
        const c = u.coupons;
        const b = u.bookings;
        const live = !b || !["Cancelled", "Refunded"].includes(b.status);
        if (live) seen[u.coupon_id] = (seen[u.coupon_id] || 0) + 1;
        const limit = c?.max_uses_per_customer;
        let saved: number | null = null;
        if (c && b?.total_price != null) {
          const total = Number(b.total_price);
          if (c.discount_type === "percentage") {
            const pct = Number(c.discount_value) / 100;
            saved = pct < 1 ? total / (1 - pct) - total : null;
          } else saved = Number(c.discount_value);
        }
        out.push({
          id: u.id,
          kind: "coupon",
          code: c?.code || "Unknown code",
          label: c ? (c.discount_type === "percentage" ? `${Number(c.discount_value)}% off` : `£${Number(c.discount_value).toFixed(2)} off`) : "Discount",
          when: u.used_at,
          bookingDate: b?.booking_date,
          dog: b?.dog_name,
          groomer: b?.staff?.name,
          saved,
          status: b?.status,
          repeat: live && !!limit && seen[u.coupon_id] > limit,
          appliedBy: u.applied_by_staff_name,
        });
      }

      // Gift vouchers used on this customer's bookings
      const { data: vBookings } = await supabase
        .from("bookings")
        .select("id, booking_date, dog_name, voucher_code, voucher_amount, status, created_at, staff(name)")
        .ilike("customer_email", lower)
        .not("voucher_code", "is", null);
      for (const b of (vBookings || []) as any[]) {
        out.push({
          id: `v-${b.id}`,
          kind: "voucher",
          code: b.voucher_code,
          label: "Gift voucher",
          when: b.created_at,
          bookingDate: b.booking_date,
          dog: b.dog_name,
          groomer: b.staff?.name,
          saved: Number(b.voucher_amount || 0),
          status: b.status,
        });
      }

      return out.sort((a, b) => (b.when || "").localeCompare(a.when || ""));
    },
    enabled: !!lower,
  });

  const repeats = (rows || []).filter((r) => r.repeat).length;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" /> Vouchers & Discounts
        </h3>

        {repeats > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>This customer used a one-per-customer code more than allowed ({repeats} extra {repeats === 1 ? "use" : "uses"}).</span>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !rows?.length ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No vouchers or discount codes used yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {rows.map((r) => (
              <div key={r.id} className="p-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-[150px]">
                  {r.kind === "voucher" ? <Gift className="h-4 w-4 text-primary" /> : <Ticket className="h-4 w-4 text-primary" />}
                  <span className="font-mono font-semibold">{r.code}</span>
                </div>
                <Badge variant="secondary">{r.label}</Badge>
                {r.repeat && <Badge variant="destructive">Repeat use</Badge>}
                {r.status && ["Cancelled", "Refunded"].includes(r.status) && <Badge variant="outline">{r.status} booking</Badge>}
                <div className="flex-1 min-w-[200px] text-muted-foreground">
                  Used {fmtDate(r.when)} · Appointment {fmtDate(r.bookingDate)}
                  {r.dog ? ` · ${r.dog}` : ""}
                  {r.groomer ? ` · ${r.groomer}` : ""}
                  {r.appliedBy ? ` · added by ${r.appliedBy}` : ""}
                </div>
                {r.saved != null && r.saved > 0 && (
                  <span className="font-semibold">−£{r.saved.toFixed(2)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
