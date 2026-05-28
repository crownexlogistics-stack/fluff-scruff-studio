import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import type { BookingData } from "./BookingEvent";

interface SendPaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingData | null;
}

export function SendPaymentLinkDialog({ open, onOpenChange, booking }: SendPaymentLinkDialogProps) {
  const [sendVia, setSendVia] = useState<"email" | "sms" | "both">("email");
  const [sending, setSending] = useState(false);
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saveToBooking, setSaveToBooking] = useState(false);

  const total = booking ? Number(booking.total_price) : 0;
  const deposit = booking ? Number(booking.deposit_paid) : 0;
  const remaining = Math.max(total - deposit, 0);

  // Reset fields each time the dialog opens for a booking
  useEffect(() => {
    if (open && booking) {
      setAmount(remaining > 0 ? remaining.toFixed(2) : "");
      setEmail(booking.customer_email || "");
      setPhone(booking.customer_phone || "");
      setSaveToBooking(false);
      setSendVia("email");
    }
  }, [open, booking?.id]);

  if (!booking) return null;

  const amountNum = parseFloat(amount);
  const amountValid = !isNaN(amountNum) && amountNum >= 0.3;

  const emailChanged = (email || "").trim().toLowerCase() !== (booking.customer_email || "").trim().toLowerCase();
  const phoneChanged = (phone || "").replace(/\s+/g, "") !== (booking.customer_phone || "").replace(/\s+/g, "");
  const needsSavePrompt =
    (emailChanged && (sendVia === "email" || sendVia === "both")) ||
    (phoneChanged && (sendVia === "sms" || sendVia === "both"));

  const emailRequired = sendVia === "email" || sendVia === "both";
  const phoneRequired = sendVia === "sms" || sendVia === "both";
  const canSend =
    amountValid &&
    (!emailRequired || !!email.trim()) &&
    (!phoneRequired || !!phone.trim());

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-payment-link", {
        body: {
          booking_id: booking.id,
          send_via: sendVia,
          override_amount: amountNum,
          override_email: emailRequired ? email.trim() : undefined,
          override_phone: phoneRequired ? phone.trim() : undefined,
          save_contact_to_booking: needsSavePrompt && saveToBooking,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Payment link sent!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Send Payment Link
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm"><span className="font-medium">Customer:</span> {booking.customer_name}</p>
            <p className="text-xs text-muted-foreground">
              Total £{total.toFixed(2)} · Paid £{deposit.toFixed(2)} · Remaining £{remaining.toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pl-amount">Amount to charge (£)</Label>
            <Input
              id="pl-amount"
              type="number"
              step="0.01"
              min="0.30"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            {!amountValid && amount && (
              <p className="text-xs text-destructive">Minimum £0.30</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Send via</Label>
            <div className="flex rounded-lg border overflow-hidden">
              {(["email", "sms", "both"] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSendVia(opt)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    sendVia === opt
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {opt === "email" ? "Email" : opt === "sms" ? "SMS" : "Both"}
                </button>
              ))}
            </div>
          </div>

          {emailRequired && (
            <div className="space-y-2">
              <Label htmlFor="pl-email">Send to email</Label>
              <Input
                id="pl-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
          )}

          {phoneRequired && (
            <div className="space-y-2">
              <Label htmlFor="pl-phone">Send to phone</Label>
              <Input
                id="pl-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07..."
              />
            </div>
          )}

          {needsSavePrompt && (
            <label className="flex items-start gap-2 rounded-md border bg-muted/40 p-2 text-xs cursor-pointer">
              <Checkbox
                checked={saveToBooking}
                onCheckedChange={(v) => setSaveToBooking(v === true)}
                className="mt-0.5"
              />
              <span>Also save this {emailChanged && phoneChanged ? "email & phone" : emailChanged ? "email" : "phone"} to the booking</span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !canSend}>
            {sending ? "Sending…" : "Send Link 🐾"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
