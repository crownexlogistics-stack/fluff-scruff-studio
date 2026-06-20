import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, UserX, Banknote, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingData } from "./BookingEvent";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingData | null;
  onComplete: (
    bookingId: string,
    cashAmount: number,
    cardAmount: number,
    isOwnCustomer: boolean,
  ) => void;
  onNoShow: (bookingId: string) => void;
}

export function CheckoutDialog({ open, onOpenChange, booking, onComplete, onNoShow }: CheckoutDialogProps) {
  const [step, setStep] = useState<"choose" | "complete" | "noshow">("choose");
  const remaining = booking ? Number(booking.total_price) - Number(booking.deposit_paid) : 0;
  const [cashAmount, setCashAmount] = useState(0);
  const [cardAmount, setCardAmount] = useState(remaining);
  const [isOwnCustomer, setIsOwnCustomer] = useState(false);

  // Reset when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setStep("choose");
      const rem = booking ? Number(booking.total_price) - Number(booking.deposit_paid) : 0;
      setCashAmount(0);
      setCardAmount(rem);
      setIsOwnCustomer(booking?.is_groomers_own_customer ?? false);
    }
    onOpenChange(v);
  };

  if (!booking) return null;

  const collected = Number(cashAmount || 0) + Number(cardAmount || 0);
  const diff = collected - remaining; // negative = short, positive = over
  const isMatch = Math.abs(diff) < 0.01;

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

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground italic">
                💡 Record what the customer actually paid. Cash + Card must add up to the remaining balance.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="flex items-center gap-1.5 text-sm"><Banknote className="h-3.5 w-3.5" /> Cash (£)</Label>
                  <NumericInput value={cashAmount} onValueChange={setCashAmount} />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1.5 text-sm"><CreditCard className="h-3.5 w-3.5" /> Card (£)</Label>
                  <NumericInput value={cardAmount} onValueChange={setCardAmount} />
                </div>
              </div>
              <div className={cn(
                "rounded-md border px-3 py-2 text-sm flex items-center justify-between",
                isMatch ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : diff < 0 ? "bg-amber-50 border-amber-200 text-amber-800"
                                   : "bg-blue-50 border-blue-200 text-blue-800",
              )}>
                <span>Paid in total</span>
                <span className="font-semibold">
                  £{collected.toFixed(2)}
                  {isMatch && " ✓ matches"}
                  {!isMatch && diff < 0 && ` — short by £${Math.abs(diff).toFixed(2)}`}
                  {!isMatch && diff > 0 && ` — over by £${diff.toFixed(2)}`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Own Customer</Label>
                <p className="text-xs text-muted-foreground">Groomer gets 50% instead of 40%</p>
              </div>
              <Switch checked={isOwnCustomer} onCheckedChange={setIsOwnCustomer} />
            </div>

            {/* Commission preview */}
            <div className="rounded-lg bg-muted/30 border p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commission rate</span>
                <span className="font-medium">{isOwnCustomer ? "50%" : "40%"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Groomer pay</span>
                <span className="font-semibold text-primary">
                  £{(Number(booking.total_price) * (isOwnCustomer ? 0.5 : 0.4)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Studio share</span>
                <span className="font-medium">
                  £{(Number(booking.total_price) * (isOwnCustomer ? 0.5 : 0.6)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("choose")}>Back</Button>
              <Button onClick={() => { onComplete(booking.id, Number(cashAmount || 0), Number(cardAmount || 0), isOwnCustomer); onOpenChange(false); }}>
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
                This will mark the appointment as No Show and send an email to the customer.
              </p>
            </div>

            {/* Deposit split preview */}
            {Number(booking.deposit_paid) > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900">No Show — Deposit Split</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="text-muted-foreground">Deposit Paid</p>
                    <p className="font-bold text-sm">£{Number(booking.deposit_paid).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Salon (50%)</p>
                    <p className="font-bold text-sm">£{(Number(booking.deposit_paid) * 0.5).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Groomer (50%)</p>
                    <p className="font-bold text-sm text-primary">£{(Number(booking.deposit_paid) * 0.5).toFixed(2)}</p>
                  </div>
                </div>
                <p className="text-[10px] text-amber-600">Groomer's share will appear in their weekly payout.</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">No deposit was paid — no financial split applies.</p>
              </div>
            )}

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
