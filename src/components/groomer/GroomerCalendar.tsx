import { useMemo, useRef, useEffect, useState } from "react";
import { format, addDays, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { getStaffColor } from "@/components/booking-calendar/staffColors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CalendarPlus, Ban, Clock, Pencil, Trash2, MoreHorizontal, Eye, PenLine, XCircle, Send, CheckCircle2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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
  is_overtime?: boolean;
  is_own: boolean;
  total_price?: number;
  deposit_paid?: number;
  customer_email?: string | null;
  customer_phone?: string | null;
  service_id?: string;
  breed_id?: string;
  final_charge?: number | null;
  stripe_payment_id?: string | null;
  duration_minutes?: number | null;
  is_migrated?: boolean;
  is_off_day?: boolean;
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
  onOvertime?: (date: Date, hour: number, staffId: string) => void;
  onEditBlock?: (booking: GroomerCalendarBooking) => void;
  onCancelBlock?: (booking: GroomerCalendarBooking) => void;
  onEditOvertime?: (booking: GroomerCalendarBooking) => void;
  onCancelOvertime?: (booking: GroomerCalendarBooking) => void;
  onViewOrder?: (booking: GroomerCalendarBooking) => void;
  onEditAppointment?: (booking: GroomerCalendarBooking) => void;
  onCancelBooking?: (booking: GroomerCalendarBooking) => void;
  onBookAgain?: (booking: GroomerCalendarBooking) => void;
  onCheckout?: (booking: GroomerCalendarBooking) => void;
}

const START_HOUR = 8;
const END_HOUR = 19;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const FOCUS_HOUR = 9;
const SLOT_HEIGHT = 64;

function SlotAction({ date, hour, staffId, staffName, canBlock, onBook, onBlock, onOvertime }: {
  date: Date; hour: number; staffId: string; staffName: string; canBlock: boolean;
  onBook: (date: Date, hour: number, staffId: string) => void;
  onBlock: (date: Date, hour: number, staffId: string) => void;
  onOvertime?: (date: Date, hour: number, staffId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="border-b cursor-pointer hover:bg-primary/[0.04] transition-colors" style={{ height: `${SLOT_HEIGHT}px` }} />
      </PopoverTrigger>
      <PopoverContent className="w-48 sm:w-52 p-2" side="bottom" align="center" sideOffset={4}>
        <div className="space-y-1">
          <button className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left" onClick={() => { onBook(date, hour, staffId); setOpen(false); }}>
            <CalendarPlus className="h-4 w-4" /> Appointment
          </button>
          {canBlock && (
            <button className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left" onClick={() => { onBlock(date, hour, staffId); setOpen(false); }}>
              <Ban className="h-4 w-4" /> Block time
            </button>
          )}
          {onOvertime && (
            <button className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left" onClick={() => { onOvertime(date, hour, staffId); setOpen(false); }}>
              <Clock className="h-4 w-4" /> Overtime
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
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold", color.bg, color.text)}>
            {booking.customer_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold cursor-pointer hover:underline" onClick={() => booking.customer_email && navigate(`/admin/customers/${encodeURIComponent(booking.customer_email)}`)}>
              {booking.customer_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {booking.customer_email || ""}
              {booking.customer_phone ? ` • ${booking.customer_phone}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={booking.status === "Confirmed" ? "default" : booking.status === "Completed" ? "secondary" : booking.status === "No Show" || booking.status === "Cancelled" || booking.status === "Refunded" ? "destructive" : "secondary"}>
            {booking.status}
          </Badge>
          {(() => {
            if (booking.status === "Refunded") return <Badge variant="outline">Refunded</Badge>;
            if (deposit >= total && total > 0) return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" /> All Paid Online</Badge>;
            if (deposit > 0) return <Badge variant="secondary">Deposit Paid</Badge>;
            return <Badge variant="destructive">NOT PAID</Badge>;
          })()}
        </div>

        {deposit >= total && total > 0 && booking.status !== "Refunded" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Customer paid in full online — nothing to charge on the day.</span>
          </div>
        )}

        {deposit > 0 && deposit < total && booking.status !== "Refunded" && (
          <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800 space-y-1">
            <div className="flex justify-between"><span>Total Cost</span><span className="font-semibold">£{total.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Deposit Paid</span><span className="font-semibold">£{deposit.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-amber-300 pt-1 mt-1"><span className="font-medium">Remaining Balance</span><span className="font-bold">£{(total - deposit).toFixed(2)}</span></div>
            <p className="text-[10px] text-amber-600 mt-1">Due at the salon on the day of appointment.</p>
          </div>
        )}

        {booking.stripe_payment_id && (
          <div className="text-[10px] text-muted-foreground font-mono truncate">Stripe: {booking.stripe_payment_id}</div>
        )}

        <div className="text-sm space-y-1">
          <p>{format(new Date(booking.booking_date), "EEE, MMM d")} • {booking.booking_time.slice(0, 5)}</p>
        </div>

        <div className="border-t pt-3">
          <p className="font-medium">{booking.service_name || "Service"} — {booking.breed_name || booking.dog_name}</p>
          <p className="text-sm text-muted-foreground">with {booking.staff_name}</p>
          {total > 0 && <p className="text-sm font-medium mt-1">£{total.toFixed(2)}</p>}
        </div>

        {booking.notes && (
          <div className="border-t pt-3"><p className="text-xs text-muted-foreground">{booking.notes}</p></div>
        )}

        {deposit === 0 && booking.customer_email && booking.status !== "Cancelled" && booking.status !== "No Show" && booking.status !== "Refunded" && (
          <div className="border-t pt-3">
            <Button variant="outline" size="sm" className="w-full" disabled={requestingDeposit}
              onClick={async () => {
                setRequestingDeposit(true);
                try {
                  const { error } = await supabase.functions.invoke("send-deposit-request", { body: { booking_id: booking.id } });
                  if (error) throw error;
                  toast.success("Deposit request email sent to " + booking.customer_email);
                  logAudit({ staffId: booking.staff_id, action: "DEPOSIT_REQUEST_SENT", details: `Deposit request sent to ${booking.customer_email} for ${booking.customer_name} (${booking.dog_name}). Total: £${Number(booking.total_price).toFixed(2)}.` });
                } catch (e: any) { toast.error("Failed to send: " + e.message); }
                finally { setRequestingDeposit(false); }
              }}
            >
              <Send className="h-4 w-4 mr-1" />
              {requestingDeposit ? "Sending…" : "Request Deposit Payment"}
            </Button>
          </div>
        )}

        <div className="border-t pt-3 flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onViewOrder?.(booking)}><Eye className="h-4 w-4 mr-2" /> View Order</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditAppointment?.(booking)}><PenLine className="h-4 w-4 mr-2" /> Edit Appointment</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => onCancelBooking?.(booking)}><XCircle className="h-4 w-4 mr-2" /> Cancel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => onBookAgain?.(booking)}>Book Again</Button>
          {booking.status !== "Completed" && booking.status !== "No Show" && booking.status !== "Cancelled" && (
            <Button size="sm" onClick={() => onCheckout?.(booking)}>Check Out</Button>
          )}
        </div>
      </div>
    </PopoverContent>
  );
}

function getEndTimeStr(booking: GroomerCalendarBooking): string {
  if (booking.end_time) return booking.end_time.slice(0, 5);
  const timeParts = booking.booking_time.split(":");
  const h = parseInt(timeParts[0]);
  const m = parseInt(timeParts[1] || "0");
  const dur = booking.duration_minutes || booking.breed_duration_minutes || 60;
  const endM = h * 60 + m + dur;
  return `${Math.floor(endM / 60).toString().padStart(2, '0')}:${(endM % 60).toString().padStart(2, '0')}`;
}

function getDurationHours(booking: GroomerCalendarBooking): number {
  const timeParts = booking.booking_time.split(":");
  const hour = parseInt(timeParts[0]);
  const minutes = parseInt(timeParts[1] || "0");
  if (booking.end_time) {
    const endParts = booking.end_time.split(":");
    const endHour = parseInt(endParts[0]);
    const endMin = parseInt(endParts[1] || "0");
    const d = (endHour + endMin / 60) - (hour + minutes / 60);
    return d > 0 ? d : 1;
  }
  if (booking.duration_minutes) return booking.duration_minutes / 60;
  if (booking.breed_duration_minutes) return booking.breed_duration_minutes / 60;
  return 1.5;
}

export function GroomerCalendar({ currentDate, daysToShow, staff, bookings, currentStaffId, userRole, onBook, onBlock, onOvertime, onEditBlock, onCancelBlock, onEditOvertime, onCancelOvertime, onViewOrder, onEditAppointment, onCancelBooking, onBookAgain, onCheckout }: GroomerCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const canInteract = !!onBook && !!onBlock && (userRole === "groomer" || userRole === "manager" || userRole === "director");
  // Only show narrow other-groomer columns in 1-day or 3-day view
  const showNarrowCols = !isMobile && daysToShow <= 3;
  const NARROW_COL_WIDTH = daysToShow === 1 ? 60 : 40;

  const days = useMemo(() => Array.from({ length: daysToShow }, (_, i) => addDays(currentDate, i)), [currentDate, daysToShow]);

  // Sort staff: current groomer first, then others
  const sortedStaff = useMemo(() => {
    const me = staff.find(s => s.id === currentStaffId);
    const others = staff.filter(s => s.id !== currentStaffId);
    return me ? [me, ...others] : staff;
  }, [staff, currentStaffId]);

  const otherStaff = useMemo(() => sortedStaff.filter(s => s.id !== currentStaffId), [sortedStaff, currentStaffId]);

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

  // Current time line position
  const now = new Date();
  const nowHour = now.getHours();
  const nowMin = now.getMinutes();
  const nowOffset = (nowHour - START_HOUR + nowMin / 60) * SLOT_HEIGHT;
  const showNowLine = nowHour >= START_HOUR && nowHour < END_HOUR;

  // Team availability summary for mobile sheet
  const teamSummary = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return otherStaff.map(s => {
      const key = `${todayStr}_${s.id}`;
      const dayBookings = bookingsByDateAndStaff.get(key) || [];
      const isOff = dayBookings.some(b => b.is_off_day || (b.is_block && b.end_time === "18:00" && b.booking_time === "08:00"));
      const apptCount = dayBookings.filter(b => !b.is_block && !b.is_overtime && !b.is_off_day).length;
      return { name: s.name, isOff, apptCount };
    });
  }, [otherStaff, bookingsByDateAndStaff]);

  const myStaffIdx = staff.findIndex(s => s.id === currentStaffId);
  const myColor = getStaffColor(myStaffIdx >= 0 ? myStaffIdx : 0);

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Mobile team button */}
      {isMobile && otherStaff.length > 0 && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="m-2 gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> View team availability
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[60vh]">
            <SheetHeader>
              <SheetTitle>Team Today</SheetTitle>
            </SheetHeader>
            <div className="space-y-2 mt-4">
              {teamSummary.map(t => (
                <div key={t.name} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium text-sm">{t.name}</span>
                  {t.isOff ? (
                    <Badge variant="secondary" className="text-xs">Off today</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t.apptCount} appointment{t.apptCount !== 1 ? "s" : ""} today</span>
                  )}
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Header row */}
      <div className="border-b bg-muted/30 sticky top-0 z-20">
        <div className="flex">
          <div className="w-[50px] shrink-0 border-r p-1" />
          {days.map((day) => (
            <div key={day.toISOString()} className={cn("flex-1 min-w-0 border-r last:border-r-0", isToday(day) && "bg-primary/10")}>
              <div className="text-center py-1">
                <p className="text-xs text-muted-foreground font-medium">{format(day, "EEE")}</p>
                <p className={cn("text-lg font-bold", isToday(day) && "text-primary")}>{format(day, "dd")}</p>
              </div>
              {/* Sub-header: my name + narrow others */}
              <div className="flex border-t">
                <div className={cn("flex-1 text-center py-1 text-xs font-bold text-primary truncate px-1")}>
                  {sortedStaff[0]?.name.split(" ")[0] || "You"}
                </div>
                {showNarrowCols && otherStaff.map((s) => (
                  <div key={s.id} className="text-center py-1 text-[9px] font-medium text-muted-foreground truncate border-l" style={{ width: `${NARROW_COL_WIDTH}px`, minWidth: `${NARROW_COL_WIDTH}px`, maxWidth: `${NARROW_COL_WIDTH}px` }}>
                    {s.name.split(" ")[0].slice(0, 4)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="overflow-y-auto relative" style={{ height: "calc(100vh - 340px)" }}>
        <div className="flex">
          {/* Time labels */}
          <div className="w-[50px] shrink-0 border-r">
            {HOURS.map(hour => (
              <div key={hour} className="border-b flex items-start justify-end pr-1 pt-0.5" style={{ height: `${SLOT_HEIGHT}px` }}>
                <span className="text-[10px] text-muted-foreground">{hour < 10 ? `0${hour}:00` : `${hour}:00`}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            return (
              <div key={dateStr} className={cn("flex-1 min-w-0 border-r last:border-r-0 flex", isToday(day) && "bg-primary/[0.02]")}>
                {/* MY COLUMN — full width */}
                <div className="flex-1 relative">
                  {/* Slots */}
                  {HOURS.map(hour => (
                    canInteract ? (
                      <SlotAction
                        key={hour} date={day} hour={hour} staffId={currentStaffId}
                        staffName={sortedStaff[0]?.name || "You"}
                        canBlock={userRole === "manager" || userRole === "director" || userRole === "groomer"}
                        onBook={onBook!} onBlock={onBlock!} onOvertime={onOvertime}
                      />
                    ) : (
                      <div key={hour} className="border-b" style={{ height: `${SLOT_HEIGHT}px` }} />
                    )
                  ))}

                  {/* Now line */}
                  {isToday(day) && showNowLine && (
                    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${nowOffset}px` }}>
                      <div className="h-0.5 bg-destructive w-full" />
                      <div className="absolute -top-1 -left-0.5 h-2.5 w-2.5 rounded-full bg-destructive" />
                    </div>
                  )}

                  {/* My bookings */}
                  {(bookingsByDateAndStaff.get(`${dateStr}_${currentStaffId}`) || []).map(booking => {
                    const timeParts = booking.booking_time.split(":");
                    const hour = parseInt(timeParts[0]);
                    const minutes = parseInt(timeParts[1] || "0");
                    const topOffset = (hour - START_HOUR + minutes / 60) * SLOT_HEIGHT;
                    const durationHours = getDurationHours(booking);
                    const isCancelled = booking.status === "Cancelled";
                    const isNoShow = booking.status === "No Show";
                    const isRefunded = booking.status === "Refunded";
                    const isGhost = isNoShow || isCancelled || isRefunded;
                    const rawHeight = isGhost ? 20 : durationHours * SLOT_HEIGHT;
                    const height = Math.max(rawHeight, isGhost ? 20 : 60);
                    const endTimeStr = getEndTimeStr(booking);

                    // Off-day
                    if (booking.is_off_day) {
                      return (
                        <div key={booking.id} className="absolute left-0 right-0 bg-muted/50 z-[5] flex items-center justify-center border-l-4 border-muted-foreground/30"
                          style={{ top: `${topOffset}px`, height: `${height}px` }}>
                          <div className="text-center">
                            <p className="text-sm font-medium text-muted-foreground">You are not scheduled today</p>
                          </div>
                        </div>
                      );
                    }

                    // Block
                    if (booking.is_block) {
                      const canEditBlock = userRole === "groomer" || userRole === "manager" || userRole === "director";
                      if (canEditBlock && onEditBlock && onCancelBlock) {
                        return (
                          <Popover key={booking.id}>
                            <PopoverTrigger asChild>
                              <div className="absolute left-1 right-1 rounded-lg px-3 py-2 text-xs z-10 cursor-pointer hover:opacity-90 bg-muted border border-border"
                                style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: "40px" }}>
                                <p className="font-bold">⛔ Unavailable</p>
                                <p className="text-muted-foreground">{booking.booking_time.slice(0, 5)} — {endTimeStr}</p>
                                {booking.notes && <p className="text-muted-foreground mt-1">{booking.notes}</p>}
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-2" side="bottom" align="center" sideOffset={4}>
                              <div className="space-y-1">
                                <p className="text-xs font-medium px-2 py-1 text-muted-foreground">Block: {booking.booking_time.slice(0, 5)} — {endTimeStr}</p>
                                {booking.notes && <p className="text-xs px-2 pb-1 text-muted-foreground">{booking.notes}</p>}
                                <button className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left" onClick={() => onEditBlock(booking)}>
                                  <Pencil className="h-4 w-4" /> Edit block
                                </button>
                                <button className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-destructive/10 text-destructive text-left" onClick={() => onCancelBlock(booking)}>
                                  <Trash2 className="h-4 w-4" /> Cancel block
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      }
                      return (
                        <div key={booking.id} className="absolute left-1 right-1 rounded-lg px-3 py-2 text-xs z-10 bg-muted border border-border"
                          style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: "40px" }}>
                          <p className="font-bold">⛔ Unavailable</p>
                          <p className="text-muted-foreground">{booking.booking_time.slice(0, 5)} — {endTimeStr}</p>
                        </div>
                      );
                    }

                    // Overtime
                    if (booking.is_overtime) {
                      const canEditOT = userRole === "groomer" || userRole === "manager" || userRole === "director";
                      if (canEditOT && onEditOvertime && onCancelOvertime) {
                        return (
                          <Popover key={booking.id}>
                            <PopoverTrigger asChild>
                              <div className="absolute left-1 right-1 rounded-lg px-3 py-2 text-xs z-10 cursor-pointer hover:opacity-90 bg-emerald-50 text-emerald-900 border border-emerald-300"
                                style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: "40px" }}>
                                <p className="font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> Overtime</p>
                                <p className="text-emerald-700">{booking.booking_time.slice(0, 5)} — {endTimeStr}</p>
                                {booking.notes && <p className="text-emerald-600 mt-0.5">{booking.notes}</p>}
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-2" side="bottom" align="center" sideOffset={4}>
                              <div className="space-y-1">
                                <p className="text-xs font-medium px-2 py-1 text-muted-foreground">Overtime: {booking.booking_time.slice(0, 5)} – {endTimeStr}</p>
                                {booking.notes && <p className="text-xs px-2 pb-1 text-muted-foreground">{booking.notes}</p>}
                                <button className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left" onClick={() => onEditOvertime(booking)}>
                                  <Pencil className="h-4 w-4" /> Edit overtime
                                </button>
                                <button className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-destructive/10 text-destructive text-left" onClick={() => onCancelOvertime(booking)}>
                                  <Trash2 className="h-4 w-4" /> Remove overtime
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      }
                      return (
                        <div key={booking.id} className="absolute left-1 right-1 rounded-lg px-3 py-2 text-xs z-10 bg-emerald-50 text-emerald-900 border border-emerald-300 opacity-70"
                          style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: "40px" }}>
                          <p className="font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> Overtime</p>
                        </div>
                      );
                    }

                    // Own appointment card — admin-style
                    return (
                      <Popover key={booking.id}>
                        <PopoverTrigger asChild>
                          <div
                            className={cn(
                              "absolute left-1 right-1 rounded-lg px-3 py-2 cursor-pointer z-10 hover:shadow-md transition-shadow overflow-hidden border",
                              myColor.bg, myColor.text,
                              isGhost && "line-through opacity-40"
                            )}
                            style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: isGhost ? "20px" : "60px" }}
                          >
                            {booking.is_migrated && (
                              <span className="absolute top-1 right-1.5 bg-amber-500 text-white text-[8px] font-bold rounded px-1 leading-tight z-20">W</span>
                            )}
                            {isGhost ? (
                              <p className="font-medium text-xs truncate">
                                {booking.customer_name} — {isRefunded ? "Refunded" : isCancelled ? "Cancelled" : "No Show"}
                              </p>
                            ) : height < 60 ? (
                              <p className="font-bold text-xs">{booking.booking_time.slice(0, 5)} {booking.customer_name}</p>
                            ) : (
                              <>
                                <p className="text-[11px] font-medium opacity-80">🕐 {booking.booking_time.slice(0, 5)} — {endTimeStr}</p>
                                <p className="font-bold text-sm truncate mt-0.5">{booking.customer_name}</p>
                                <p className="text-xs truncate opacity-90">{booking.service_name || "Service"}</p>
                                {height >= 90 && booking.breed_name && (
                                  <p className="text-xs truncate opacity-80">🐾 {booking.breed_name}</p>
                                )}
                                {height >= 100 && booking.dog_name && (
                                  <p className="text-xs truncate opacity-70">{booking.dog_name}</p>
                                )}
                              </>
                            )}
                          </div>
                        </PopoverTrigger>
                        <OwnBookingPopover
                          booking={booking} color={myColor}
                          onViewOrder={onViewOrder} onEditAppointment={onEditAppointment}
                          onCancelBooking={onCancelBooking} onBookAgain={onBookAgain} onCheckout={onCheckout}
                        />
                      </Popover>
                    );
                  })}
                </div>

                {/* OTHER GROOMERS — narrow columns (hidden on mobile) */}
                {!isMobile && otherStaff.map((s) => {
                  const key = `${dateStr}_${s.id}`;
                  const staffBookings = bookingsByDateAndStaff.get(key) || [];
                  const sIdx = staff.findIndex(st => st.id === s.id);
                  const sColor = getStaffColor(sIdx >= 0 ? sIdx : 0);
                  const isOffDay = staffBookings.some(b => b.is_off_day);

                  return (
                    <div key={s.id} className="relative border-l" style={{ width: `${NARROW_COL_WIDTH}px`, minWidth: `${NARROW_COL_WIDTH}px`, maxWidth: `${NARROW_COL_WIDTH}px` }}>
                      {/* Hour grid lines */}
                      {HOURS.map(hour => (
                        <div key={hour} className="border-b" style={{ height: `${SLOT_HEIGHT}px` }} />
                      ))}

                      {/* Now line extends through narrow cols */}
                      {isToday(day) && showNowLine && (
                        <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${nowOffset}px` }}>
                          <div className="h-0.5 bg-destructive w-full" />
                        </div>
                      )}

                      {/* Off day: striped grey */}
                      {isOffDay && (
                        <div className="absolute inset-0 z-[5]"
                          style={{
                            background: "repeating-linear-gradient(45deg, transparent, transparent 4px, hsl(var(--muted)) 4px, hsl(var(--muted)) 8px)",
                            opacity: 0.5,
                          }}
                        />
                      )}

                      {/* Narrow booking blocks */}
                      {staffBookings.filter(b => !b.is_off_day).map(booking => {
                        const timeParts = booking.booking_time.split(":");
                        const hour = parseInt(timeParts[0]);
                        const minutes = parseInt(timeParts[1] || "0");
                        const topOffset = (hour - START_HOUR + minutes / 60) * SLOT_HEIGHT;
                        const durationHours = getDurationHours(booking);
                        const height = Math.max(durationHours * SLOT_HEIGHT, 20);
                        const endTimeStr = getEndTimeStr(booking);

                        if (booking.is_block) {
                          return (
                            <TooltipProvider key={booking.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="absolute left-0.5 right-0.5 rounded-sm z-10 bg-muted/80"
                                    style={{ top: `${topOffset}px`, height: `${height}px` }} />
                                </TooltipTrigger>
                                <TooltipContent side="left"><p className="text-xs">Unavailable</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }

                        if (booking.is_overtime) {
                          return (
                            <TooltipProvider key={booking.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="absolute left-0.5 right-0.5 rounded-sm z-10 bg-emerald-200/60"
                                    style={{ top: `${topOffset}px`, height: `${height}px` }} />
                                </TooltipTrigger>
                                <TooltipContent side="left"><p className="text-xs">Overtime {booking.booking_time.slice(0, 5)}–{endTimeStr}</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }

                        // Regular booking — solid colour block, no details
                        const isCancelled = booking.status === "Cancelled" || booking.status === "No Show" || booking.status === "Refunded";
                        return (
                          <TooltipProvider key={booking.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn("absolute left-0.5 right-0.5 rounded-sm z-10", sColor.bg, isCancelled && "opacity-30")}
                                  style={{ top: `${topOffset}px`, height: `${height}px` }}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="text-xs font-medium">Booked {booking.booking_time.slice(0, 5)}–{endTimeStr}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
