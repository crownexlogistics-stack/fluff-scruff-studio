import { format } from "date-fns";
import { Undo2 } from "lucide-react";

/** Shows a clear refund banner when Stripe has refunded money on this booking. */
export function RefundNotice({ booking }: { booking: any }) {
  const amount = Number(booking?.refunded_amount || 0);
  if (!(amount > 0)) return null;
  const at = booking?.refunded_at ? new Date(booking.refunded_at) : null;
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
      <Undo2 className="h-4 w-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-bold">Refunded £{amount.toFixed(2)}</p>
        {at && <p>on {format(at, "EEE d MMM yyyy 'at' HH:mm")}</p>}
      </div>
    </div>
  );
}
