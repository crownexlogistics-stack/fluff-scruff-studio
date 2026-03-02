import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getStaffColor } from "./staffColors";
import { Pencil, Trash2, MoreHorizontal, Eye, PenLine, XCircle, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { BookingData } from "./BookingEvent";

interface BookingPopoverCardProps {
  booking: BookingData;
  staffIndex?: number;
  onEditBlock?: (booking: BookingData) => void;
  onCancelBlock?: (booking: BookingData) => void;
  onViewOrder?: (booking: BookingData) => void;
  onEditAppointment?: (booking: BookingData) => void;
  onCancelBooking?: (booking: BookingData) => void;
  onBookAgain?: (booking: BookingData) => void;
  onCheckout?: (booking: BookingData) => void;
}

export function BookingPopoverCard({
  booking,
  staffIndex = 0,
  onEditBlock,
  onCancelBlock,
  onViewOrder,
  onEditAppointment,
  onCancelBooking,
  onBookAgain,
  onCheckout,
}: BookingPopoverCardProps) {
  const navigate = useNavigate();
  const [requestingDeposit, setRequestingDeposit] = useState(false);
  const isGhost = booking.status === "Cancelled" || booking.status === "No Show";
  const color = isGhost ? { bg: "bg-muted", text: "text-muted-foreground" } : getStaffColor(staffIndex);

  if (booking.is_block) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Blocked Time</p>
            <p className="text-xs text-muted-foreground">{booking.staff_name}</p>
          </div>
          <Badge variant="destructive">Blocked</Badge>
        </div>
        <div className="text-sm space-y-1">
          <p>{format(new Date(booking.booking_date), "EEEE, dd MMM yyyy")}</p>
          <p className="text-muted-foreground">
            {booking.booking_time.slice(0, 5)} — {booking.end_time?.slice(0, 5) || "Unknown"}
          </p>
        </div>
        {booking.notes && (
          <div className="border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Reason</p>
            <p className="text-sm">{booking.notes}</p>
          </div>
        )}
        <div className="border-t pt-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onEditBlock?.(booking)}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onCancelBlock?.(booking)}>
            <Trash2 className="h-3 w-3 mr-1" /> Cancel Block
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Top: Customer info */}
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold", color.bg, color.text)}>
          {booking.customer_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="font-semibold cursor-pointer hover:underline"
            onClick={() => booking.customer_email && navigate(`/admin/customers/${encodeURIComponent(booking.customer_email)}`)}
          >
            {booking.customer_name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {booking.customer_email || ""}
            {booking.customer_phone ? ` • ${booking.customer_phone}` : ""}
          </p>
        </div>
      </div>

      {/* Payment status */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={
          booking.status === "Confirmed" ? "default" :
          booking.status === "Completed" ? "secondary" :
          booking.status === "No Show" || booking.status === "Cancelled" ? "destructive" : "secondary"
        }>
          {booking.status}
        </Badge>
        {(() => {
          const deposit = Number(booking.deposit_paid);
          const total = Number(booking.total_price);
          if (deposit >= total && total > 0) {
            return (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                <CheckCircle2 className="h-3 w-3 mr-1" /> PAID IN FULL
              </Badge>
            );
          }
          if (deposit > 0) {
            return (
              <Badge variant="secondary">
                DEPOSIT £{deposit.toFixed(2)}
              </Badge>
            );
          }
          return <Badge variant="destructive">NOT PAID</Badge>;
        })()}
      </div>

      {/* Paid in full callout */}
      {Number(booking.deposit_paid) >= Number(booking.total_price) && Number(booking.total_price) > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Customer paid in full online — nothing to charge on the day.</span>
        </div>
      )}

      {/* Deposit paid but not full */}
      {Number(booking.deposit_paid) > 0 && Number(booking.deposit_paid) < Number(booking.total_price) && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800">
          Deposit of £{Number(booking.deposit_paid).toFixed(2)} paid — remaining balance of £{(Number(booking.total_price) - Number(booking.deposit_paid)).toFixed(2)} due on the day.
        </div>
      )}

      {/* Details */}
      <div className="text-sm space-y-1">
        <p>{format(new Date(booking.booking_date), "EEE, MMM d")} • {booking.booking_time.slice(0, 5)}</p>
      </div>

      <div className="border-t pt-3">
        <p className="font-medium">{booking.service_name || "Service"} — {booking.breed_name || booking.dog_name}</p>
        <p className="text-sm text-muted-foreground">with {booking.staff_name}</p>
        <p className="text-sm font-medium mt-1">£{Number(booking.total_price).toFixed(2)}</p>
      </div>

      {booking.notes && (
        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground">{booking.notes}</p>
        </div>
      )}

      {/* Request Deposit */}
      {Number(booking.deposit_paid) === 0 && booking.customer_email && booking.status !== "Cancelled" && booking.status !== "No Show" && (
        <div className="border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={requestingDeposit}
            onClick={async () => {
              setRequestingDeposit(true);
              try {
                const { data, error } = await supabase.functions.invoke("send-deposit-request", {
                  body: { booking_id: booking.id },
                });
                if (error) throw error;
                toast.success("Deposit request email sent to " + booking.customer_email);
              } catch (e: any) {
                toast.error("Failed to send: " + e.message);
              } finally {
                setRequestingDeposit(false);
              }
            }}
          >
            <Send className="h-4 w-4 mr-1" />
            {requestingDeposit ? "Sending…" : "Request Deposit Payment"}
          </Button>
        </div>
      )}

      {/* Action bar */}
      <div className="border-t pt-3 flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onViewOrder?.(booking)}>
              <Eye className="h-4 w-4 mr-2" /> View Order
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEditAppointment?.(booking)}>
              <PenLine className="h-4 w-4 mr-2" /> Edit Appointment
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onCancelBooking?.(booking)}>
              <XCircle className="h-4 w-4 mr-2" /> Cancel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={() => onBookAgain?.(booking)}>
          Book Again
        </Button>
        {booking.status !== "Completed" && booking.status !== "No Show" && booking.status !== "Cancelled" && (
          <Button size="sm" onClick={() => onCheckout?.(booking)}>
            Check Out
          </Button>
        )}
      </div>
    </div>
  );
}
