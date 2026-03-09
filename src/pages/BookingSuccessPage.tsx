import { useState, useEffect, useRef, useMemo } from "react";
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
import { Calendar, Clock, Dog, MapPin, ArrowLeft, Pencil, Ban, AlertTriangle, CalendarPlus, Share2 } from "lucide-react";
import { format, parseISO, differenceInHours } from "date-fns";
import { toast } from "sonner";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import logo from "@/assets/logo-transparent.png";

import { AIChatWidget } from "@/components/AIChatWidget";

// ─── Happy Dog Animation (inline SVG) ──────────────────────────────
function HappyDogAnimation() {
  return (
    <motion.div
      className="relative w-32 h-32 mx-auto"
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
    >
      <svg viewBox="0 0 128 128" className="w-full h-full">
        {/* Body */}
        <motion.ellipse
          cx="64" cy="80" rx="32" ry="24"
          fill="hsl(var(--accent))"
          opacity={0.85}
          animate={{ ry: [24, 22, 24] }}
          transition={{ repeat: Infinity, duration: 0.6 }}
        />
        {/* Head */}
        <motion.circle
          cx="64" cy="48" r="22"
          fill="hsl(var(--accent))"
          animate={{ cy: [48, 44, 48] }}
          transition={{ repeat: Infinity, duration: 0.6 }}
        />
        {/* Left ear */}
        <motion.ellipse
          cx="46" cy="34" rx="8" ry="14"
          fill="hsl(var(--accent))"
          opacity={0.7}
          transform="rotate(-15, 46, 34)"
          animate={{ ry: [14, 12, 14] }}
          transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }}
        />
        {/* Right ear */}
        <motion.ellipse
          cx="82" cy="34" rx="8" ry="14"
          fill="hsl(var(--accent))"
          opacity={0.7}
          transform="rotate(15, 82, 34)"
          animate={{ ry: [14, 12, 14] }}
          transition={{ repeat: Infinity, duration: 0.5, delay: 0.15 }}
        />
        {/* Eyes */}
        <circle cx="56" cy="46" r="3" fill="hsl(var(--background))" />
        <circle cx="72" cy="46" r="3" fill="hsl(var(--background))" />
        <circle cx="57" cy="45" r="1.2" fill="hsl(var(--foreground))" />
        <circle cx="73" cy="45" r="1.2" fill="hsl(var(--foreground))" />
        {/* Nose */}
        <ellipse cx="64" cy="54" rx="4" ry="3" fill="hsl(var(--foreground))" opacity={0.7} />
        {/* Mouth / smile */}
        <path d="M58 58 Q64 64 70 58" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" opacity={0.5} />
        {/* Tail */}
        <motion.path
          d="M96 76 Q108 60 100 48"
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="5"
          strokeLinecap="round"
          animate={{ d: ["M96 76 Q108 60 100 48", "M96 76 Q112 68 108 52", "M96 76 Q108 60 100 48"] }}
          transition={{ repeat: Infinity, duration: 0.4 }}
        />
        {/* Front legs */}
        <motion.line x1="52" y1="100" x2="48" y2="116" stroke="hsl(var(--accent))" strokeWidth="5" strokeLinecap="round"
          animate={{ y2: [116, 112, 116] }}
          transition={{ repeat: Infinity, duration: 0.6 }}
        />
        <motion.line x1="76" y1="100" x2="80" y2="116" stroke="hsl(var(--accent))" strokeWidth="5" strokeLinecap="round"
          animate={{ y2: [116, 112, 116] }}
          transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
        />
      </svg>
    </motion.div>
  );
}

// ─── Add to Calendar helpers ────────────────────────────────────────
function buildGoogleCalendarUrl(booking: any) {
  const start = `${booking.booking_date.replace(/-/g, "")}T${(booking.booking_time || "09:00:00").replace(/:/g, "").slice(0, 6)}00`;
  const endDate = new Date(`${booking.booking_date}T${booking.booking_time || "09:00:00"}`);
  endDate.setHours(endDate.getHours() + 1);
  const end = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, "0")}${String(endDate.getDate()).padStart(2, "0")}T${String(endDate.getHours()).padStart(2, "0")}${String(endDate.getMinutes()).padStart(2, "0")}00`;
  const title = encodeURIComponent(`Dog Grooming - ${booking.dog_name}`);
  const details = encodeURIComponent("Fluff & Scruff Studio — Your booking is confirmed!");
  const location = encodeURIComponent("Fluff & Scruff Studio");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
}

function buildICalUrl(booking: any) {
  const start = `${booking.booking_date.replace(/-/g, "")}T${(booking.booking_time || "09:00:00").replace(/:/g, "").slice(0, 6)}00`;
  const endDate = new Date(`${booking.booking_date}T${booking.booking_time || "09:00:00"}`);
  endDate.setHours(endDate.getHours() + 1);
  const end = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, "0")}${String(endDate.getDate()).padStart(2, "0")}T${String(endDate.getHours()).padStart(2, "0")}${String(endDate.getMinutes()).padStart(2, "0")}00`;
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${start}\nDTEND:${end}\nSUMMARY:Dog Grooming - ${booking.dog_name}\nLOCATION:Fluff & Scruff Studio\nDESCRIPTION:Your booking is confirmed!\nEND:VEVENT\nEND:VCALENDAR`;
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export default function BookingSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bookingId = searchParams.get("booking_id");
  const paymentType = searchParams.get("payment_type") || "deposit";
  const confettiFired = useRef(false);

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

  const isCancelledBooking = useMemo(() => {
    if (!booking) return false;
    const s = (booking.status || "").trim();
    return s === "Cancelled" || ["Refunded", "Refunded/Cancelled", "Cancelled/Refunded"].includes(s);
  }, [booking]);

  // Check if this user is a returning migrated customer
  const { data: migratedCustomer } = useQuery({
    queryKey: ["migrated-welcome-back", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data: mc } = await supabase
        .from("migrated_customers")
        .select("id, status")
        .eq("email", user.email.toLowerCase())
        .eq("status", "activated")
        .maybeSingle();
      if (!mc) return null;
      const { count } = await supabase
        .from("migrated_bookings")
        .select("id", { count: "exact", head: true })
        .eq("migrated_customer_id", mc.id);
      if (!count || count === 0) return null;
      return { ...mc, bookingCount: count };
    },
    enabled: !!user?.email && !!booking && !isCancelledBooking,
  });

  // Fire confetti on mount + GA purchase event
  useEffect(() => {
    if (booking && !confettiFired.current) {
      const status = (booking.status || "").trim().toLowerCase();
      const isCancelled = status === "cancelled" || status.includes("refund");
      if (!isCancelled) {
        confettiFired.current = true;
        // GA4 purchase event
        window.gtag?.("event", "purchase", {
          transaction_id: booking.id,
          value: booking.deposit_paid || 0,
          currency: "GBP",
          items: [{
            item_name: (booking.service as any)?.name || "Grooming",
            price: booking.total_price || 0,
          }],
        });
        // Small delay so the page renders first
        setTimeout(() => {
          const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
          // Parse HSL and create brand colors
          const colors = ["#e87c3a", "#f5a623", "#ff6b35", "#ffd700", "#ff8c42"];
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.4 },
            colors,
            disableForReducedMotion: true,
          });
        }, 500);
      }
    }
  }, [booking]);

  // Update booking status on successful payment
  useEffect(() => {
    if (booking && booking.status === "Pending" && bookingId) {
      supabase.functions.invoke("record-payment", {
        body: { booking_id: bookingId },
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["booking-success", bookingId] });
      }).catch(() => {});

      if (booking.customer_email) {
        supabase.functions.invoke("send-booking-email", {
          body: { booking_id: bookingId, email_type: "confirmation" },
        }).catch(() => {});
      }
      if (booking.staff_id) {
        supabase.functions.invoke("notify-groomer", {
          body: { booking_id: bookingId, notification_type: "new_booking" },
        }).catch(() => {});
      }
    }
  }, [booking, bookingId]);

  const canAmend = booking
    ? differenceInHours(parseISO(booking.booking_date + "T" + (booking.booking_time || "09:00")), new Date()) >= 48
    : false;

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!bookingId) return;
      const { data, error } = await supabase.functions.invoke("cancel-booking-with-refund", {
        body: { booking_id: bookingId, cancelled_by: "customer" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setCancelDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["booking-success", bookingId] });
      if (data?.refunded) {
        toast.success(`Booking cancelled. Your refund of £${data.refund_amount?.toFixed(2)} is on its way and will appear in your account within 5-10 business days.`);
      } else {
        toast.success("Booking cancelled. Your deposit is non-refundable as this is within 48 hours of your appointment.");
      }
    },
    onError: () => toast.error("Failed to cancel booking"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.svg
          width={48} height={48} viewBox="0 0 64 64"
          animate={{ rotate: [-20, 20, -20] }}
          transition={{ repeat: Infinity, duration: 0.4, ease: "easeInOut" }}
          style={{ originX: "50%", originY: "100%" }}
        >
          <path d="M32 58 C32 58 28 40 20 28 C14 19 8 16 8 16 C8 16 18 12 26 20 C34 28 32 58 32 58Z" fill="hsl(var(--accent))" opacity={0.8} />
          <path d="M32 58 C32 58 36 40 44 28 C50 19 56 16 56 16 C56 16 46 12 38 20 C30 28 32 58 32 58Z" fill="hsl(var(--accent))" opacity={0.5} />
        </motion.svg>
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
  const status = (booking.status || "").trim();
  const isRefunded = ["Refunded", "Refunded/Cancelled", "Cancelled/Refunded"].includes(status);
  const isCancelled = status === "Cancelled" || isRefunded;

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
        {/* Success Header with animation */}
        {!isCancelled ? (
          <motion.div
            className="text-center space-y-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <HappyDogAnimation />
            <motion.h1
              className="text-2xl sm:text-3xl font-heading text-foreground"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
            >
              Pawsome! Your Booking is Confirmed! 🎉
            </motion.h1>
            <motion.p
              className="text-muted-foreground text-sm max-w-sm mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              We can't wait to see <strong>{booking.dog_name}</strong> on{" "}
              <strong>{format(parseISO(booking.booking_date), "EEEE, dd MMMM yyyy")}</strong> at{" "}
              <strong>{booking.booking_time?.slice(0, 5)}</strong>. Check your emails for your confirmation.
            </motion.p>
          </motion.div>
        ) : (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mx-auto">
              <Ban className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading text-foreground">{isRefunded ? "Refunded & Cancelled" : "Booking Cancelled"}</h1>
            <p className="text-muted-foreground text-sm">{isRefunded ? "Your refund has been processed and should arrive within 5–10 business days." : "This appointment has been cancelled. Your deposit is non-refundable."}</p>
          </div>
        )}

        {/* Welcome Back Banner for migrated customers */}
        {migratedCustomer && !isCancelled && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 300, damping: 25 }}
            className="rounded-2xl p-4 border"
            style={{ backgroundColor: "#FFF3E0", borderColor: "#FF6B35" }}
          >
            <p className="text-sm font-semibold text-foreground mb-1">👋 Welcome back to Fluff & Scruff!</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your previous appointment history has been restored to your account. You can see all your past visits in My Bookings.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 text-xs"
              onClick={() => navigate("/my-pets")}
            >
              View My History 🐾
            </Button>
          </motion.div>
        )}

        {/* Booking Details Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 25 }}
        >
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
        </motion.div>

        {/* Add to Calendar & Social */}
        {!isCancelled && (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="grid grid-cols-2 gap-3">
              <a
                href={buildGoogleCalendarUrl(booking)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <CalendarPlus className="h-4 w-4 text-accent" />
                Google Cal
              </a>
              <a
                href={buildICalUrl(booking)}
                download={`fluff-scruff-${booking.dog_name}.ics`}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <CalendarPlus className="h-4 w-4 text-accent" />
                Apple Cal
              </a>
            </div>

            {/* Share the Joy */}
            <div className="rounded-2xl border border-border/40 bg-accent/5 p-4 text-center space-y-2">
              <p className="text-sm font-medium text-foreground flex items-center justify-center gap-2">
                <Share2 className="h-4 w-4 text-accent" />
                Share the Joy!
              </p>
              <p className="text-xs text-muted-foreground">
                Tag us <a href="https://www.instagram.com/fluffandscruff.studio" target="_blank" rel="noopener noreferrer" className="text-accent font-semibold hover:underline">@fluffandscruff.studio</a> on Instagram when you arrive! 📸
              </p>
            </div>
          </motion.div>
        )}

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
            Go to My Page
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
              <p className="text-xs text-destructive">
                {canAmend
                  ? `Since your appointment is more than 48 hours away, your deposit of £${Number(booking.deposit_paid).toFixed(2)} will be refunded automatically.`
                  : `Your deposit of £${Number(booking.deposit_paid).toFixed(2)} is non-refundable as this cancellation is within 48 hours of your appointment, as per our Terms & Conditions.`
                }
              </p>
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
      
      <AIChatWidget />
    </div>
  );
}
