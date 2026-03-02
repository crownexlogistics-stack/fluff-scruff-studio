import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle, Calendar, Clock, Dog, MapPin, ArrowLeft, Pencil, Ban, AlertTriangle } from "lucide-react";
import { format, parseISO, differenceInHours } from "date-fns";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import logo from "@/assets/logo-transparent.png";

export default function BookingSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bookingId = searchParams.get("booking_id");
  const paymentType = searchParams.get("payment_type") || "deposit";

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking-success", bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      const { data, error } = await supabase
        .from("bookings")
        .select("*, staff:staff_id(name), service:service_id(name), breed:breed_id(name)")
        .eq("id", bookingId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!bookingId,
  });

  // Update booking status to Confirmed on successful payment and send confirmation email
  useEffect(() => {
    if (booking && booking.status === "Pending" && bookingId) {
      supabase.from("bookings").update({ status: "Confirmed" }).eq("id", bookingId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["booking-success", bookingId] });
      });
      // Send confirmation email now that payment is confirmed
      if (booking.customer_email) {
        supabase.functions.invoke("send-booking-email", {
          body: { booking_id: bookingId, email_type: "confirmation" },
        }).catch(() => {});
      }
      // Notify groomer of new booking
      if (booking.staff_id) {
        supabase.functions.invoke("notify-groomer", {
          body: { booking_id: bookingId, notification_type: "new_booking" },
        }).catch(() => {});
      }
    }
  }, [booking, bookingId]);

  // Check if within 48 hours
  const canAmend = booking
    ? differenceInHours(parseISO(booking.booking_date + "T" + (booking.booking_time || "09:00")), new Date()) >= 48
    : false;

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!bookingId) return;
      const { error } = await supabase.from("bookings").update({ status: "Cancelled" }).eq("id", bookingId);
      if (error) throw error;
      logAudit({ action: "BOOKING_CANCELLED_BY_CUSTOMER", details: `Customer cancelled booking ${bookingId}` });
    },
    onSuccess: () => {
      setCancelDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["booking-success", bookingId] });
      toast.success("Booking cancelled. Please note your deposit is non-refundable.");
    },
    onError: () => toast.error("Failed to cancel booking"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">Booking not found</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const serviceName = (booking.service as any)?.name || "Grooming";
  const staffName = (booking.staff as any)?.name;
  const breedName = (booking.breed as any)?.name;
  const isCancelled = booking.status === "Cancelled";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-white/75 backdrop-blur-2xl border-b border-border/20 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto" />
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Success Header */}
        {!isCancelled ? (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto">
              <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading text-foreground">Booking Confirmed!</h1>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {paymentType === "full"
                ? "Your full payment has been received. You're all set!"
                : "Your deposit has been received. The remaining balance is due after your appointment."}
            </p>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mx-auto">
              <Ban className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading text-foreground">Booking Cancelled</h1>
            <p className="text-muted-foreground text-sm">This appointment has been cancelled. Your deposit is non-refundable.</p>
          </div>
        )}

        {/* Booking Details Card */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-lg">{serviceName}</h2>
              <Badge variant={isCancelled ? "destructive" : "default"}>
                {booking.status}
              </Badge>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{format(parseISO(booking.booking_date), "EEEE, dd MMMM yyyy")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{booking.booking_time?.slice(0, 5)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Dog className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{booking.dog_name}{breedName && ` (${breedName})`}</span>
              </div>
              {staffName && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>with {staffName}</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Price</span>
                <span className="font-medium">£{Number(booking.total_price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {paymentType === "full" ? "Paid in full" : "Deposit paid"}
                </span>
                <span className="font-semibold text-foreground">£{Number(booking.deposit_paid).toFixed(2)}</span>
              </div>
              {paymentType !== "full" && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining balance</span>
                  <span className="font-medium">£{(Number(booking.total_price) - Number(booking.deposit_paid)).toFixed(2)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Amend Options */}
        {!isCancelled && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-heading font-semibold text-base">Need to make changes?</h3>
              {canAmend ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    You can cancel or rebook your appointment up to 48 hours before your scheduled time.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate("/book")}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Rebook
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setCancelDialogOpen(true)}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Cancel Booking
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Less than 48 hours until appointment</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Changes within 48 hours are subject to our cancellation policy. Please contact us directly.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            className="w-full h-12 rounded-xl"
            onClick={() => navigate("/my-pets")}
          >
            View My Bookings
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/")}
          >
            Back to Home
          </Button>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Cancel Booking?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to cancel your appointment for <strong>{booking.dog_name}</strong> on{" "}
              <strong>{format(parseISO(booking.booking_date), "dd MMM yyyy")}</strong>?
            </p>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">Your deposit of £{Number(booking.deposit_paid).toFixed(2)} is non-refundable as per our Terms & Conditions.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Keep Booking</Button>
            <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
