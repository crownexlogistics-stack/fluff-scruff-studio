import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingData } from "./BookingEvent";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingData | null;
  onComplete: (bookingId: string, finalCharge: number) => void;
  onNoShow: (bookingId: string) => void;
}

export function CheckoutDialog({ open, onOpenChange, booking, onComplete, onNoShow }: CheckoutDialogProps) {
  const [step, setStep] = useState<"choose" | "complete" | "noshow">("choose");
  const remaining = booking ? Number(booking.total_price) - Number(booking.deposit_paid) : 0;
  const [finalCharge, setFinalCharge] = useState(remaining);

  // Reset when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setStep("choose");
      setFinalCharge(booking ? Number(booking.total_price) - Number(booking.deposit_paid) : 0);
    }
    onOpenChange(v);
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Check Out — {booking.customer_name}</DialogTitle>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-3">
            <button
              className="w-full rounded-lg border-2 border-transparent hover:border-primary p-4 text-left transition-colors bg-muted/30 hover:bg-muted/50"
              onClick={() => setStep("complete")}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Appointment completed as planned</p>
                  <p className="text-xs text-muted-foreground">Confirm payment and close the appointment</p>
                </div>
              </div>
            </button>

            <button
              className="w-full rounded-lg border-2 border-transparent hover:border-destructive p-4 text-left transition-colors bg-muted/30 hover:bg-destructive/5"
              onClick={() => setStep("noshow")}
            >
              <div className="flex items-center gap-3">
                <UserX className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-semibold text-sm">No Show</p>
                  <p className="text-xs text-muted-foreground">Customer did not attend their appointment</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {step === "complete" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total price</span>
                <span className="font-medium">£{Number(booking.total_price).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Deposit paid</span>
                <Badge variant={booking.deposit_paid > 0 ? "secondary" : "destructive"} className="text-xs">
                  £{Number(booking.deposit_paid).toFixed(2)}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Remaining balance</span>
                <span className="font-semibold">£{remaining.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Final charge to customer (£)</Label>
              <NumericInput
                value={finalCharge}
                onValueChange={setFinalCharge}
              />
              <p className="text-xs text-muted-foreground">Adjust if the groomer charged more or less than planned</p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("choose")}>Back</Button>
              <Button onClick={() => { onComplete(booking.id, finalCharge); onOpenChange(false); }}>
                Complete Appointment
              </Button>
            </div>
          </div>
        )}

        {step === "noshow" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium">Customer did not attend</p>
              <p className="text-xs text-muted-foreground mt-1">
                This will cancel the appointment, free up the calendar slot, and send an email to the customer informing them.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("choose")}>Back</Button>
              <Button variant="destructive" onClick={() => { onNoShow(booking.id); onOpenChange(false); }}>
                Confirm No Show
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
