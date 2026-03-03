import { useState } from "react";
import { format, parseISO, differenceInHours, isPast, isToday, differenceInDays } from "date-fns";
import { CalendarCheck, Clock, RotateCcw, XCircle, AlertTriangle, Ban, ChevronRight, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Booking {
  id: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_price: number;
  deposit_paid: number;
  notes?: string | null;
  services?: { name: string } | null;
  service_id?: string | null;
  breed_id?: string | null;
  staff?: { name: string } | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

interface BookingsTabProps {
  bookings: Booking[];
  userEmail?: string;
}

export function BookingsTab({ bookings, userEmail }: BookingsTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.functions.invoke("cancel-booking-with-refund", {
        body: { booking_id: bookingId, cancelled_by: "customer" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setCancelDialogOpen(false);
      setBookingToCancel(null);
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      if (data?.refunded) {
        toast.success(`Cancelled. Refund of £${data.refund_amount?.toFixed(2)} on its way (5-10 business days).`);
      } else {
        toast.success("Cancelled. Deposit non-refundable (within 48 hours).");
      }
    },
    onError: () => toast.error("Failed to cancel"),
  });

  const getStatusBadge = (booking: Booking) => {
    const status = (booking.status || "").trim();
    const bookingDate = new Date(booking.booking_date);
    const isFuture = !isPast(bookingDate) || isToday(bookingDate);
    const daysUntil = differenceInDays(bookingDate, new Date());

    if (["Refunded", "Refunded/Cancelled", "Cancelled/Refunded"].includes(status)) {
      return <Badge variant="destructive" className="text-[10px]">Refunded & Cancelled</Badge>;
    }
    if (status === "Cancelled") return <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>;
    if (status === "No Show") return <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px]">No Show</Badge>;
    if (status === "Completed") return <Badge variant="secondary" className="text-[10px]">Complete</Badge>;
    if ((status === "Confirmed" || status === "Pending") && isFuture) {
      const text = isToday(bookingDate) ? "Today! 🎉" : daysUntil === 1 ? "Tomorrow!" : `${daysUntil} days`;
      return <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">{text}</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  };

  const canCancel = (booking: Booking) => {
    const status = (booking.status || "").trim();
    if (["Cancelled", "Refunded", "Refunded/Cancelled", "Cancelled/Refunded", "Completed", "No Show"].includes(status)) return false;
    return true;
  };

  const canAmend = (booking: Booking) => {
    return differenceInHours(parseISO(booking.booking_date + "T" + (booking.booking_time || "09:00")), new Date()) >= 48;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-accent" />
        My Bookings
      </h3>

      {bookings.length === 0 ? (
        <div className="text-center py-10">
          <CalendarCheck className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No bookings yet</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/book")}>
            Book First Groom
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const total = Number(booking.total_price);
            const deposit = Number(booking.deposit_paid);
            const balance = Math.max(0, total - deposit);
            const status = (booking.status || "").trim();
            const isActive = ["Confirmed", "Pending"].includes(status);
            const serviceName = (booking.services as any)?.name || "Grooming";
            const staffName = (booking.staff as any)?.name;

            return (
              <button
                key={booking.id}
                onClick={() => setSelectedBooking(booking)}
                className={`w-full text-left rounded-2xl border p-4 transition-all hover:shadow-md ${
                  isActive
                    ? "border-green-200 bg-green-50/50 dark:bg-green-950/10"
                    : "border-border/50 bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{serviceName}</p>
                      {getStatusBadge(booking)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {booking.dog_name} • {format(new Date(booking.booking_date), "EEE d MMM")} at {booking.booking_time?.slice(0, 5)}
                      {staffName && ` • ${staffName}`}
                    </p>

                    {/* Financial strip */}
                    <div className="flex items-center gap-3 mt-2 text-[11px]">
                      <span className="text-muted-foreground">Total: <strong className="text-foreground">£{total.toFixed(2)}</strong></span>
                      <span className="text-green-600">Paid: £{deposit.toFixed(2)}</span>
                      {balance > 0 && <span className="text-accent font-semibold">Due: £{balance.toFixed(2)}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>

                {/* Action buttons */}
                {isActive && (
                  <div className="flex gap-2 mt-3 pt-2 border-t border-border/30">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-accent"
                      onClick={(e) => {
                        e.stopPropagation();
                        const params = new URLSearchParams();
                        if (serviceName !== "Grooming") params.set("service", serviceName);
                        if (booking.dog_name) params.set("dogName", booking.dog_name);
                        if (booking.breed_id) params.set("breedId", booking.breed_id);
                        navigate(`/book?${params.toString()}`);
                      }}
                    >
                      <RotateCcw className="h-3 w-3" /> Rebook
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBookingToCancel(booking);
                        setCancelDialogOpen(true);
                      }}
                    >
                      <Ban className="h-3 w-3" /> Cancel
                    </Button>
                  </div>
                )}

                {status === "Completed" && (
                  <div className="flex gap-2 mt-3 pt-2 border-t border-border/30">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-accent"
                      onClick={(e) => {
                        e.stopPropagation();
                        const params = new URLSearchParams();
                        if (serviceName !== "Grooming") params.set("service", serviceName);
                        if (booking.dog_name) params.set("dogName", booking.dog_name);
                        if (booking.breed_id) params.set("breedId", booking.breed_id);
                        navigate(`/book?${params.toString()}`);
                      }}
                    >
                      <RotateCcw className="h-3 w-3" /> Rebook this Groom
                    </Button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Booking Detail Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        {selectedBooking && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading">
                {(selectedBooking.services as any)?.name || "Grooming"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Dog</span><span>{selectedBooking.dog_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{format(new Date(selectedBooking.booking_date), "EEE d MMM yyyy")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span>{selectedBooking.booking_time?.slice(0, 5)}</span></div>
                {(selectedBooking.staff as any)?.name && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Groomer</span><span>{(selectedBooking.staff as any).name}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span>{getStatusBadge(selectedBooking)}</div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Price</span><span className="font-semibold">£{Number(selectedBooking.total_price).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deposit Paid</span><span className="text-green-600 font-medium">£{Number(selectedBooking.deposit_paid).toFixed(2)}</span></div>
                {Number(selectedBooking.total_price) - Number(selectedBooking.deposit_paid) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Balance Due</span><span className="text-accent font-semibold">£{(Number(selectedBooking.total_price) - Number(selectedBooking.deposit_paid)).toFixed(2)}</span></div>
                )}
              </div>

              {selectedBooking.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{selectedBooking.notes}</p>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        {bookingToCancel && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading">Cancel Booking?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cancel <strong>{bookingToCancel.dog_name}</strong>'s appointment on{" "}
                <strong>{format(new Date(bookingToCancel.booking_date), "dd MMM yyyy")}</strong>?
              </p>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  {canAmend(bookingToCancel)
                    ? `Your deposit of £${Number(bookingToCancel.deposit_paid).toFixed(2)} will be refunded.`
                    : `Your deposit of £${Number(bookingToCancel.deposit_paid).toFixed(2)} is non-refundable (within 48 hours).`
                  }
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Keep Booking</Button>
              <Button variant="destructive" onClick={() => cancelMutation.mutate(bookingToCancel.id)} disabled={cancelMutation.isPending}>
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
