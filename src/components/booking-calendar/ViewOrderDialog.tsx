import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { BookingData } from "./BookingEvent";

interface ViewOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingData | null;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-1.5 border-b last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export function ViewOrderDialog({ open, onOpenChange, booking }: ViewOrderDialogProps) {
  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Booking Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Badge variant={booking.status === "Confirmed" ? "default" : booking.status === "Cancelled" ? "destructive" : "secondary"}>
              {booking.status}
            </Badge>
            <Badge variant={booking.deposit_paid > 0 ? "secondary" : "destructive"}>
              {booking.deposit_paid > 0 ? `Deposit £${Number(booking.deposit_paid).toFixed(2)}` : "No Deposit"}
            </Badge>
          </div>

          <div className="rounded-lg border p-3">
            <Row label="Customer" value={booking.customer_name} />
            <Row label="Email" value={booking.customer_email} />
            <Row label="Phone" value={booking.customer_phone} />
            <Row label="Dog" value={booking.dog_name} />
            <Row label="Breed" value={booking.breed_name} />
            <Row label="Service" value={booking.service_name} />
            <Row label="Date" value={format(new Date(booking.booking_date), "EEEE, dd MMM yyyy")} />
            <Row label="Time" value={booking.booking_time.slice(0, 5)} />
            <Row label="Groomer" value={booking.staff_name} />
            <Row label="Total Price" value={`£${Number(booking.total_price).toFixed(2)}`} />
            <Row label="Deposit Paid" value={`£${Number(booking.deposit_paid).toFixed(2)}`} />
          </div>

          {booking.notes && (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{booking.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
