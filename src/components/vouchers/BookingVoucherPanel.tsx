import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * Shows "GIFT VOUCHER USED" with the amount on an appointment, or lets staff
 * apply a voucher code (in salon / over the phone). The server checks the code.
 */
export function BookingVoucherPanel({ bookingId, cancelled }: { bookingId: string; cancelled?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [channel, setChannel] = useState<"in_salon" | "phone">("in_salon");
  const [busy, setBusy] = useState(false);

  const { data: b } = useQuery({
    queryKey: ["booking-voucher", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("voucher_code, voucher_amount, deposit_paid, total_price, cash_collected, card_collected")
        .eq("id", bookingId)
        .maybeSingle();
      return data as any;
    },
  });
  if (!b) return null;

  const voucherAmt = Number(b.voucher_amount || 0);
  if (b.voucher_code && voucherAmt > 0) {
    const card = Math.max(0, Number(b.deposit_paid || 0) - voucherAmt);
    return (
      <div className="rounded-xl border-2 border-primary bg-primary/10 p-3 space-y-1">
        <p className="text-xs font-bold tracking-wider text-primary">🎁 GIFT VOUCHER USED</p>
        <div className="flex justify-between text-sm"><span>Voucher <code className="font-mono">{b.voucher_code}</code></span><span className="font-semibold">−£{voucherAmt.toFixed(2)}</span></div>
        {card > 0 && <div className="flex justify-between text-sm text-muted-foreground"><span>Paid by card</span><span>£{card.toFixed(2)}</span></div>}
        <p className="text-[11px] text-muted-foreground">Already included in "Paid" — don't charge this part again.</p>
      </div>
    );
  }

  const balance = Number(b.total_price || 0) - Number(b.deposit_paid || 0) - Number(b.cash_collected || 0) - Number(b.card_collected || 0);
  if (cancelled || balance <= 0) return null;

  const apply = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("gift-voucher", {
        body: { action: "redeem_for_booking", booking_id: bookingId, code, channel },
      });
      if (error) {
        let msg = "Couldn't apply the voucher";
        if (error instanceof FunctionsHttpError) { try { msg = (await error.context.json())?.error ?? msg; } catch { /* */ } }
        throw new Error(msg);
      }
      toast.success(
        data.applied < data.voucher_value
          ? `Voucher applied: £${data.applied.toFixed(2)} (voucher was £${data.voucher_value.toFixed(2)} — single use)`
          : `Voucher applied: £${data.applied.toFixed(2)}`,
      );
      setOpen(false); setCode("");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  if (!open) {
    return <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>🎁 Apply gift voucher</Button>;
  }
  return (
    <div className="rounded-xl border p-3 space-y-2">
      <p className="text-sm font-semibold">Apply gift voucher</p>
      <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="FS-XXXX-XXXX-XXXX" className="font-mono" maxLength={20} />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={channel === "in_salon" ? "default" : "outline"} onClick={() => setChannel("in_salon")}>In salon</Button>
        <Button type="button" size="sm" variant={channel === "phone" ? "default" : "outline"} onClick={() => setChannel("phone")}>Over the phone</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Up to £{balance.toFixed(2)} (what's left to pay) will be used. Vouchers are single use — any extra value is not kept.</p>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" disabled={busy || code.replace(/[^A-Z0-9]/g, "").length < 12} onClick={apply}>{busy ? "Checking…" : "Apply"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
