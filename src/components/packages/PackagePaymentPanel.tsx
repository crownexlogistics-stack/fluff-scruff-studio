import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Link2, Copy, Loader2, PoundSterling, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface PackageBooking {
  id: string;
  total_paid: number;
  amount_received?: number | null;
  payment_method?: string | null;
  cash_collected?: number | null;
  card_collected?: number | null;
  paid_at?: string | null;
  paid_by_staff_id?: string | null;
  stripe_payment_intent_id?: string | null;
}

interface Props {
  pb: PackageBooking;
  currentStaffId?: string | null;
  currentStaffName?: string | null;
  paidByStaffName?: string | null;
  onChanged?: () => void;
}

export function PackagePaymentPanel({ pb, currentStaffId, currentStaffName, paidByStaffName, onChanged }: Props) {
  const qc = useQueryClient();
  const price = Number(pb.total_paid || 0);
  const received = Number(pb.amount_received || 0);
  const balance = Math.max(0, price - received);
  const isPaid = balance <= 0.005 && (pb.payment_method && pb.payment_method !== "unpaid");

  const [linkOpen, setLinkOpen] = useState(false);
  const [salonOpen, setSalonOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState(false);

  const [cash, setCash] = useState<string>("");
  const [card, setCard] = useState<string>("");
  const [savingSalon, setSavingSalon] = useState(false);

  const paymentBadge = () => {
    if (!isPaid) {
      return <Badge className="bg-red-100 text-red-800 border-red-200">UNPAID</Badge>;
    }
    const method = pb.payment_method;
    const dateStr = pb.paid_at ? format(new Date(pb.paid_at), "dd MMM yyyy") : "";
    if (method === "stripe") {
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">PAID — Stripe {dateStr && `(${dateStr})`}</Badge>;
    }
    const cashN = Number(pb.cash_collected || 0);
    const cardN = Number(pb.card_collected || 0);
    const parts: string[] = [];
    if (cashN > 0) parts.push(`Cash £${cashN.toFixed(2)}`);
    if (cardN > 0) parts.push(`Card £${cardN.toFixed(2)}`);
    if (parts.length === 0 && method) parts.push(method[0].toUpperCase() + method.slice(1));
    const by = paidByStaffName ? ` — ${paidByStaffName}` : "";
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
        PAID — {parts.join(" / ")}{by} {dateStr && `(${dateStr})`}
      </Badge>
    );
  };

  const handleSendLink = async () => {
    setSendingLink(true);
    setLinkUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-package-payment-link", {
        body: { package_booking_id: pb.id, amount: balance },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No URL returned");
      setLinkUrl(data.url);

      await supabase.from("package_payment_audit").insert({
        package_booking_id: pb.id,
        event_type: "payment_link_sent",
        amount: balance,
        performed_by: currentStaffName || "Staff",
        note: `Stripe payment link generated for £${balance.toFixed(2)} outstanding balance.`,
      } as any);

      toast.success("Payment link created — copy and send to customer");
    } catch (err: any) {
      toast.error(err.message || "Failed to create payment link");
    } finally {
      setSendingLink(false);
    }
  };

  const handleCopy = async () => {
    if (!linkUrl) return;
    await navigator.clipboard.writeText(linkUrl);
    toast.success("Link copied to clipboard");
  };

  const handleRecordSalon = async () => {
    const cashN = Number(cash) || 0;
    const cardN = Number(card) || 0;
    const total = cashN + cardN;
    if (total <= 0) {
      toast.error("Enter a cash or card amount");
      return;
    }
    if (total > balance + 0.01) {
      toast.error(`Amount exceeds balance due (£${balance.toFixed(2)})`);
      return;
    }

    setSavingSalon(true);
    try {
      const method = cashN > 0 && cardN > 0 ? "mixed" : cashN > 0 ? "cash" : "card";
      const newReceived = received + total;
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("package_bookings" as any)
        .update({
          amount_received: newReceived,
          cash_collected: Number(pb.cash_collected || 0) + cashN,
          card_collected: Number(pb.card_collected || 0) + cardN,
          payment_method: method,
          paid_by_staff_id: currentStaffId || null,
          paid_at: now,
          stripe_payment_status: "paid_in_salon",
        })
        .eq("id", pb.id);

      if (error) throw error;

      await supabase.from("package_payment_audit").insert({
        package_booking_id: pb.id,
        event_type: "payment_recorded_in_salon",
        amount: total,
        performed_by: currentStaffName || "Staff",
        note: `Recorded in salon: Cash £${cashN.toFixed(2)} / Card £${cardN.toFixed(2)}. New amount_received: £${newReceived.toFixed(2)}.`,
      } as any);

      toast.success(`£${total.toFixed(2)} recorded`);
      setSalonOpen(false);
      setCash("");
      setCard("");
      qc.invalidateQueries({ queryKey: ["package-booking-detail"] });
      qc.invalidateQueries({ queryKey: ["package-bookings"] });
      qc.invalidateQueries({ queryKey: ["package-audit"] });
      onChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSavingSalon(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <PoundSterling className="h-4 w-4" /> Payment
        </div>
        {paymentBadge()}
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Package price</span>
          <span className="font-medium">£{price.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount received</span>
          <span className={`font-medium ${received > 0 ? "text-emerald-600" : ""}`}>£{received.toFixed(2)}</span>
        </div>
        {balance > 0 && (
          <div className="flex justify-between border-t pt-1.5">
            <span className="font-semibold">Balance due</span>
            <span className="font-bold text-red-600">£{balance.toFixed(2)}</span>
          </div>
        )}
      </div>

      {balance > 0 && !linkOpen && !salonOpen && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
            <Link2 className="h-3 w-3 mr-1" /> Send Stripe payment link
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSalonOpen(true)}>
            <CreditCard className="h-3 w-3 mr-1" /> Record payment in salon
          </Button>
        </div>
      )}

      {linkOpen && (
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Generate a Stripe checkout link for the outstanding <strong>£{balance.toFixed(2)}</strong>. Copy it into an email or SMS.
          </p>
          {!linkUrl ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSendLink} disabled={sendingLink}>
                {sendingLink ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Link2 className="h-3 w-3 mr-1" />}
                Generate link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLinkOpen(false)}>Cancel</Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input value={linkUrl} readOnly className="text-xs" />
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setLinkOpen(false); setLinkUrl(null); }}>
                Done
              </Button>
            </>
          )}
        </div>
      )}

      {salonOpen && (
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Record cash and/or card received. Balance due: <strong>£{balance.toFixed(2)}</strong>.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Cash £</Label>
              <Input type="number" step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs">Card £</Label>
              <Input type="number" step="0.01" value={card} onChange={(e) => setCard(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRecordSalon} disabled={savingSalon}>
              {savingSalon ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSalonOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isPaid && pb.stripe_payment_intent_id && (
        <>
          <Separator />
          <p className="text-xs text-muted-foreground font-mono truncate">Stripe PI: {pb.stripe_payment_intent_id}</p>
        </>
      )}
    </div>
  );
}