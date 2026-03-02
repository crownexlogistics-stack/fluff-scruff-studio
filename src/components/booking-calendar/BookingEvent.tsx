import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { getStaffColor } from "./staffColors";
import { Pencil, Trash2, MoreHorizontal, Eye, PenLine, XCircle } from "lucide-react";

export interface BookingData {
  id: string;
  customer_name: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  total_price: number;
  deposit_paid: number;
  status: string;
  notes: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  staff_name?: string;
  staff_id?: string;
  breed_name?: string;
  service_name?: string;
  is_block?: boolean;
  end_time?: string;
  service_id?: string;
  breed_id?: string;
  final_charge?: number | null;
}

interface BookingEventProps {
  booking: BookingData;
  staffIndex: number;
  startHour: number;
  durationHours?: number;
  onEditBlock?: (booking: BookingData) => void;
  onCancelBlock?: (booking: BookingData) => void;
  onViewOrder?: (booking: BookingData) => void;
  onEditAppointment?: (booking: BookingData) => void;
  onCancelBooking?: (booking: BookingData) => void;
  onBookAgain?: (booking: BookingData) => void;
  onCheckout?: (booking: BookingData) => void;
}

export function BookingEvent({ booking, staffIndex, startHour, durationHours = 1, onEditBlock, onCancelBlock, onViewOrder, onEditAppointment, onCancelBooking, onBookAgain, onCheckout }: BookingEventProps) {
  const isNoShow = booking.status === "No Show";
  const color = isNoShow ? { bg: "bg-muted", text: "text-muted-foreground" } : getStaffColor(staffIndex);
  const timeParts = booking.booking_time.split(":");
  const hour = parseInt(timeParts[0]);
  const minutes = parseInt(timeParts[1] || "0");
  const topOffset = (hour - startHour + minutes / 60) * 64;

  let calculatedDuration = durationHours;
  if (booking.end_time) {
    const endParts = booking.end_time.split(":");
    const endHour = parseInt(endParts[0]);
    const endMin = parseInt(endParts[1] || "0");
    calculatedDuration = (endHour + endMin / 60) - (hour + minutes / 60);
    if (calculatedDuration <= 0) calculatedDuration = 1;
  }

  // No Show: shrink to thin strip
  const height = isNoShow ? 16 : calculatedDuration * 64;

  if (booking.is_block) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div
            className={cn("absolute left-1 right-1 rounded-md px-2 py-1 text-xs font-medium cursor-pointer z-10 hover:opacity-90 transition-opacity", color.bg, color.text)}
            style={{ top: `${topOffset}px`, height: `${calculatedDuration * 64}px`, minHeight: "28px" }}
          >
            <p className="font-bold">Blocked</p>
            <p className="opacity-80">{booking.staff_name}</p>
            {booking.notes && <p className="opacity-70 truncate text-[10px]">{booking.notes}</p>}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" side="right" align="start">
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
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "absolute left-1 right-1 rounded-md px-2 py-1 text-xs cursor-pointer z-10 overflow-hidden transition-opacity hover:opacity-90",
            color.bg, color.text,
            isNoShow && "line-through opacity-60"
          )}
          style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: isNoShow ? "16px" : "48px" }}
        >
          {isNoShow ? (
            <p className="font-medium truncate text-[10px]">{booking.customer_name} — No Show</p>
          ) : (
            <>
              <p className="font-bold truncate">{booking.service_name || "Appointment"}</p>
              <p className="truncate">{booking.customer_name}</p>
              <p className="opacity-80 truncate">with {booking.staff_name}</p>
            </>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" side="right" align="start">
        <div className="p-4 space-y-3">
          {/* Top: Customer info */}
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold", color.bg, color.text)}>
              {booking.customer_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{booking.customer_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {booking.customer_email || ""}
                {booking.customer_phone ? ` • ${booking.customer_phone}` : ""}
              </p>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex gap-2">
            <Badge variant={
              booking.status === "Confirmed" ? "default" :
              booking.status === "Completed" ? "secondary" :
              booking.status === "No Show" || booking.status === "Cancelled" ? "destructive" : "secondary"
            }>
              {booking.status}
            </Badge>
            <Badge variant={booking.deposit_paid > 0 ? "secondary" : "destructive"}>
              {booking.deposit_paid > 0 ? "PAID" : "NOT PAID"}
            </Badge>
          </div>

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

          {/* Action bar */}
          <div className="border-t pt-3 flex items-center gap-2">
            {/* 3-dot menu */}
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
      </PopoverContent>
    </Popover>
  );
}
