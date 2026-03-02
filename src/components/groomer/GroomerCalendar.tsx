import { useMemo, useRef, useEffect, useState } from "react";
import { format, addDays, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { getStaffColor } from "@/components/booking-calendar/staffColors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CalendarPlus, Ban, Pencil, Trash2, MoreHorizontal, Eye, PenLine, XCircle, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface StaffMember {
  id: string;
  name: string;
}

export interface GroomerCalendarBooking {
  id: string;
  customer_name: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  end_time?: string;
  breed_duration_minutes?: number;
  status: string;
  notes: string | null;
  staff_name?: string;
  staff_id?: string;
  service_name?: string;
  breed_name?: string;
  is_block?: boolean;
  is_own: boolean;
  total_price?: number;
  deposit_paid?: number;
  customer_email?: string | null;
  customer_phone?: string | null;
  service_id?: string;
  breed_id?: string;
  final_charge?: number | null;
}

type UserRole = string | null;

interface GroomerCalendarProps {
  currentDate: Date;
  daysToShow: number;
  staff: StaffMember[];
  bookings: GroomerCalendarBooking[];
  currentStaffId: string;
  userRole?: UserRole;
  onBook?: (date: Date, hour: number, staffId: string) => void;
  onBlock?: (date: Date, hour: number, staffId: string) => void;
  onEditBlock?: (booking: GroomerCalendarBooking) => void;
  onCancelBlock?: (booking: GroomerCalendarBooking) => void;
  onViewOrder?: (booking: GroomerCalendarBooking) => void;
  onEditAppointment?: (booking: GroomerCalendarBooking) => void;
  onCancelBooking?: (booking: GroomerCalendarBooking) => void;
  onBookAgain?: (booking: GroomerCalendarBooking) => void;
  onCheckout?: (booking: GroomerCalendarBooking) => void;
}

const START_HOUR = 8;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const FOCUS_HOUR = 9;
const SLOT_HEIGHT = 56;

function SlotAction({ date, hour, staffId, staffName, canBlock, onBook, onBlock }: {
  date: Date; hour: number; staffId: string; staffName: string; canBlock: boolean;
  onBook: (date: Date, hour: number, staffId: string) => void;
  onBlock: (date: Date, hour: number, staffId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="h-14 border-b cursor-pointer hover:bg-primary/[0.04] transition-colors" />
      </PopoverTrigger>
      <PopoverContent className="w-48 sm:w-52 p-2" side="bottom" align="center" sideOffset={4}>
        <div className="space-y-1">
          <button
            className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left"
            onClick={() => { onBook(date, hour, staffId); setOpen(false); }}
          >
            <CalendarPlus className="h-4 w-4" /> Appointment
          </button>
          {canBlock && (
            <button
              className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left"
              onClick={() => { onBlock(date, hour, staffId); setOpen(false); }}
            >
              <Ban className="h-4 w-4" /> Block time
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OwnBookingPopover({ booking, color, onViewOrder, onEditAppointment, onCancelBooking, onBookAgain, onCheckout }: {
  booking: GroomerCalendarBooking;
  color: { bg: string; text: string };
  onViewOrder?: (b: GroomerCalendarBooking) => void;
  onEditAppointment?: (b: GroomerCalendarBooking) => void;
  onCancelBooking?: (b: GroomerCalendarBooking) => void;
  onBookAgain?: (b: GroomerCalendarBooking) => void;
  onCheckout?: (b: GroomerCalendarBooking) => void;
}) {
  const navigate = useNavigate();
  const [requestingDeposit, setRequestingDeposit] = useState(false);
  const deposit = Number(booking.deposit_paid || 0);
  const total = Number(booking.total_price || 0);

  return (
    <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm p-0" side="bottom" align="center" sideOffset={4}>
      <div className="p-4 space-y-3">
        {/* Customer info */}
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
            if (deposit >= total && total > 0) {
              return (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> PAID IN FULL
                </Badge>
              );
            }
            if (deposit > 0) {
              return <Badge variant="secondary">DEPOSIT £{deposit.toFixed(2)}</Badge>;
            }
            return <Badge variant="destructive">NOT PAID</Badge>;
          })()}
        </div>

        {/* Paid in full callout */}
        {deposit >= total && total > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Customer paid in full online — nothing to charge on the day.</span>
          </div>
        )}

        {/* Partial deposit */}
        {deposit > 0 && deposit < total && (
          <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800">
            Deposit of £{deposit.toFixed(2)} paid — remaining balance of £{(total - deposit).toFixed(2)} due on the day.
          </div>
        )}

        {/* Details */}
        <div className="text-sm space-y-1">
          <p>{format(new Date(booking.booking_date), "EEE, MMM d")} • {booking.booking_time.slice(0, 5)}</p>
        </div>

        <div className="border-t pt-3">
          <p className="font-medium">{booking.service_name || "Service"} — {booking.breed_name || booking.dog_name}</p>
          <p className="text-sm text-muted-foreground">with {booking.staff_name}</p>
          {total > 0 && <p className="text-sm font-medium mt-1">£{total.toFixed(2)}</p>}
        </div>

        {booking.notes && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">{booking.notes}</p>
          </div>
        )}

        {/* Request Deposit for unpaid appointments */}
        {deposit === 0 && booking.customer_email && booking.status !== "Cancelled" && booking.status !== "No Show" && (
          <div className="border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={requestingDeposit}
              onClick={async () => {
                setRequestingDeposit(true);
                try {
                  const { error } = await supabase.functions.invoke("send-deposit-request", {
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
    </PopoverContent>
  );
}

export function GroomerCalendar({ currentDate, daysToShow, staff, bookings, currentStaffId, userRole, onBook, onBlock, onEditBlock, onCancelBlock, onViewOrder, onEditAppointment, onCancelBooking, onBookAgain, onCheckout }: GroomerCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canInteract = !!onBook && !!onBlock && (userRole === "groomer" || userRole === "manager" || userRole === "director");

  const days = useMemo(() =>
    Array.from({ length: daysToShow }, (_, i) => addDays(currentDate, i)),
    [currentDate, daysToShow]
  );

  const bookingsByDateAndStaff = useMemo(() => {
    const map = new Map<string, GroomerCalendarBooking[]>();
    bookings.forEach(b => {
      const key = `${b.booking_date}_${b.staff_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return map;
  }, [bookings]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (FOCUS_HOUR - START_HOUR) * SLOT_HEIGHT;
    }
  }, [currentDate, daysToShow]);

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b bg-muted/30 sticky top-0 z-20">
        <div className="grid" style={{ gridTemplateColumns: `50px repeat(${days.length}, 1fr)` }}>
          <div className="border-r p-1" />
          {days.map((day) => (
            <div key={day.toISOString()} className={cn("text-center border-r last:border-r-0 py-1", isToday(day) && "bg-primary/10")}>
              <p className="text-xs text-muted-foreground font-medium">{format(day, "EEE")}</p>
              <p className={cn("text-lg font-bold", isToday(day) && "text-primary")}>{format(day, "dd")}</p>
            </div>
          ))}
        </div>
        <div className="grid border-t" style={{ gridTemplateColumns: `50px repeat(${days.length}, 1fr)` }}>
          <div className="border-r p-1" />
          {days.map((day) => (
            <div key={day.toISOString()} className="grid border-r last:border-r-0" style={{ gridTemplateColumns: `repeat(${staff.length}, 1fr)` }}>
              {staff.map((s) => {
                const isMe = s.id === currentStaffId;
                return (
                  <div key={s.id} className={cn("text-center py-1 text-[10px] font-medium border-r last:border-r-0 truncate px-0.5", isMe && "bg-primary/5")}>
                    <span className={cn(isMe && "font-bold text-primary")}>{s.name.split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ height: "calc(100vh - 320px)" }}>
        <div className="grid" style={{ gridTemplateColumns: `50px repeat(${days.length}, 1fr)` }}>
          <div className="border-r">
            {HOURS.map(hour => (
              <div key={hour} className="h-14 border-b flex items-start justify-end pr-1 pt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {hour < 10 ? `0${hour}:00` : `${hour}:00`}
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            return (
              <div key={dateStr} className={cn("grid border-r last:border-r-0", isToday(day) && "bg-primary/[0.02]")} style={{ gridTemplateColumns: `repeat(${staff.length}, 1fr)` }}>
                {staff.map((s, staffIdx) => {
                  const key = `${dateStr}_${s.id}`;
                  const staffBookings = bookingsByDateAndStaff.get(key) || [];
                  const isMe = s.id === currentStaffId;
                  const canBlockThisColumn = userRole === "manager" || userRole === "director" || (userRole === "groomer" && isMe);

                  return (
                    <div key={s.id} className={cn("relative border-r last:border-r-0", isMe && "bg-primary/[0.03]")}>
                      {HOURS.map(hour => (
                        canInteract ? (
                          <SlotAction
                            key={hour}
                            date={day}
                            hour={hour}
                            staffId={s.id}
                            staffName={s.name}
                            canBlock={canBlockThisColumn}
                            onBook={onBook!}
                            onBlock={onBlock!}
                          />
                        ) : (
                          <div key={hour} className="h-14 border-b" />
                        )
                      ))}

                      {staffBookings.map(booking => {
                        const timeParts = booking.booking_time.split(":");
                        const hour = parseInt(timeParts[0]);
                        const minutes = parseInt(timeParts[1] || "0");
                        const topOffset = (hour - START_HOUR + minutes / 60) * SLOT_HEIGHT;

                        let durationHours = 1.5;
                        if (booking.end_time) {
                          const endParts = booking.end_time.split(":");
                          const endHour = parseInt(endParts[0]);
                          const endMin = parseInt(endParts[1] || "0");
                          durationHours = (endHour + endMin / 60) - (hour + minutes / 60);
                          if (durationHours <= 0) durationHours = 1;
                        } else if (booking.breed_duration_minutes) {
                          durationHours = booking.breed_duration_minutes / 60;
                        }

                        const isCancelled = booking.status === "Cancelled";
                        const isNoShow = booking.status === "No Show";
                        const isGhost = isNoShow || isCancelled;
                        const height = isGhost ? 16 : durationHours * SLOT_HEIGHT;
                        const color = isGhost ? { bg: "bg-muted", text: "text-muted-foreground" } : getStaffColor(staffIdx);

                        // Block rendering
                        if (booking.is_block) {
                          const canEditBlock = booking.is_own && (userRole === "groomer" || userRole === "manager" || userRole === "director");
                          if (canEditBlock && onEditBlock && onCancelBlock) {
                            return (
                              <Popover key={booking.id}>
                                <PopoverTrigger asChild>
                                  <div
                                    className={cn("absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] z-10 cursor-pointer hover:opacity-90", color.bg, color.text, "opacity-70")}
                                    style={{ top: `${topOffset}px`, height: `${durationHours * SLOT_HEIGHT}px`, minHeight: "20px" }}
                                  >
                                    <p className="font-bold truncate">Off</p>
                                    {booking.notes && <p className="truncate opacity-80">{booking.notes}</p>}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 sm:w-52 p-2" side="bottom" align="center" sideOffset={4}>
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium px-2 py-1 text-muted-foreground">
                                      {booking.booking_time.slice(0, 5)} – {booking.end_time?.slice(0, 5) || "?"}
                                    </p>
                                    {booking.notes && <p className="text-xs px-2 pb-1 text-muted-foreground">{booking.notes}</p>}
                                    <button
                                      className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left"
                                      onClick={() => onEditBlock(booking)}
                                    >
                                      <Pencil className="h-4 w-4" /> Edit block
                                    </button>
                                    <button
                                      className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-destructive/10 text-destructive text-left"
                                      onClick={() => onCancelBlock(booking)}
                                    >
                                      <Trash2 className="h-4 w-4" /> Cancel block
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          }
                          return (
                            <div key={booking.id}
                              className={cn("absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] z-10", color.bg, color.text, "opacity-70")}
                              style={{ top: `${topOffset}px`, height: `${durationHours * SLOT_HEIGHT}px`, minHeight: "20px" }}
                            >
                              <p className="font-bold truncate">Off</p>
                            </div>
                          );
                        }

                        // Not own booking - just show "Booked" (availability only)
                        if (!booking.is_own) {
                          return (
                            <div key={booking.id}
                              className={cn("absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] z-10 opacity-60", color.bg, color.text)}
                              style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: "20px" }}
                            >
                              <p className="font-bold truncate">Booked</p>
                            </div>
                          );
                        }

                        // Own booking - full admin-style popover
                        return (
                          <Popover key={booking.id}>
                            <PopoverTrigger asChild>
                              <div
                                 className={cn(
                                   "absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] cursor-pointer z-10 hover:opacity-90 overflow-hidden",
                                   color.bg, color.text,
                                   isGhost && "line-through opacity-50"
                                 )}
                                 style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: isGhost ? "16px" : "20px" }}
                               >
                                 {isGhost ? (
                                   <p className="font-medium truncate">
                                     {booking.customer_name} — {isCancelled ? "Cancelled" : "No Show"}
                                   </p>
                                 ) : (
                                   <>
                                     <p className="font-bold truncate">{booking.service_name || "Appt"}</p>
                                     <p className="truncate">{booking.customer_name}</p>
                                     <p className="truncate opacity-80">{booking.dog_name}</p>
                                   </>
                                 )}
                              </div>
                            </PopoverTrigger>
                            <OwnBookingPopover
                              booking={booking}
                              color={color}
                              onViewOrder={onViewOrder}
                              onEditAppointment={onEditAppointment}
                              onCancelBooking={onCancelBooking}
                              onBookAgain={onBookAgain}
                              onCheckout={onCheckout}
                            />
                          </Popover>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
