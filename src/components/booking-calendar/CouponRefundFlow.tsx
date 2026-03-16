import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PasswordVerifyDialog } from "./PasswordVerifyDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

interface CouponRefundFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  customerName: string;
  amountAlreadyPaid: number;
  newTotalAfterDiscount: number;
  staffName: string;
  couponCode: string;
  onComplete: () => void;
}

export function CouponRefundFlow({
  open,
  onOpenChange,
  bookingId,
  customerName,
  amountAlreadyPaid,
  newTotalAfterDiscount,
  staffName,
  couponCode,
  onComplete,
}: CouponRefundFlowProps) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const refundAmount = Math.max(0, amountAlreadyPaid - newTotalAfterDiscount);
  const discountAmount = amountAlreadyPaid - newTotalAfterDiscount;

  const handleConfirmRefund = () => {
    // Close confirmation, open password dialog
    onOpenChange(false);
    setPasswordOpen(true);
  };

  const handlePasswordVerified = async () => {
    setProcessing(true);
    try {
      // Process partial refund via edge function
      const { data, error } = await supabase.functions.invoke("process-refund", {
        body: {
          booking_id: bookingId,
          partial_amount: Math.round(refundAmount * 100), // in pence
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Log audit trail
      await (supabase.from("booking_audit_log") as any).insert({
        booking_id: bookingId,
        event_type: "coupon_refund",
        performed_by: staffName,
        note: `Stripe refund of £${refundAmount.toFixed(2)} issued — coupon ${couponCode} applied after payment. Payment intent: ${data.refund_id || "N/A"}. Authorised by ${staffName}`,
      });

      logAudit({
        action: "COUPON_REFUND_PROCESSED",
        details: `Coupon ${couponCode} applied to ${customerName}'s booking — Stripe refund of £${refundAmount.toFixed(2)} issued. Authorised by ${staffName}.`,
      });

      toast.success(`Refund of £${refundAmount.toFixed(2)} processed successfully`);
      onComplete();
    } catch (e: any) {
      toast.error("Refund failed: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      {/* Step 1: Confirmation dialog */}
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Coupon Discount — Refund Required</AlertDialogTitle>
            <AlertDialogDescription>
              This coupon reduces the total by £{discountAmount.toFixed(2)}.
              {customerName} has already paid £{amountAlreadyPaid.toFixed(2)}.
              A refund of <strong>£{refundAmount.toFixed(2)}</strong> will be issued to their original payment method.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount paid</span>
              <span className="font-medium">£{amountAlreadyPaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New total after discount</span>
              <span className="font-medium">£{newTotalAfterDiscount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-1.5 mt-1.5">
              <span className="font-semibold">Refund amount</span>
              <span className="font-bold text-destructive">£{refundAmount.toFixed(2)}</span>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmRefund} disabled={processing}>
              Confirm Refund
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 2: Password verification */}
      <PasswordVerifyDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        title="Authorise Refund"
        description={`Security check — enter your password to authorise this refund of £${refundAmount.toFixed(2)} to ${customerName}.`}
        confirmLabel={processing ? "Processing…" : `Authorise £${refundAmount.toFixed(2)} Refund`}
        onConfirmed={handlePasswordVerified}
        destructive
      />
    </>
  );
}
