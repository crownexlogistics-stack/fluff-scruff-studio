import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

  if (!booking) return null;

  const total = Number(booking.total_price);
  const deposit = Number(booking.deposit_paid);
  const amountDue = total - deposit;

  const handleSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-payment-link", {
        body: { booking_id: booking.id, send_via: sendVia },
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
            <p className="text-sm"><span className="font-medium">Amount Due:</span> <span className="text-lg font-bold">£{amountDue.toFixed(2)}</span></p>
          </div>

          <div className="space-y-2">
            <Label>Send via</Label>
            <div className="flex rounded-lg border overflow-hidden">
              {(["email", "sms", "both"] as const).map(opt => (
                <button
                  key={opt}
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
            {sendVia !== "email" && !booking.customer_phone && (
              <p className="text-xs text-destructive">No phone number on this booking</p>
            )}
            {sendVia !== "sms" && !booking.customer_email && (
              <p className="text-xs text-destructive">No email on this booking</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || amountDue <= 0}>
            {sending ? "Sending…" : "Send Link 🐾"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
