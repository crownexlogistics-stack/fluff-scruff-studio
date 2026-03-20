import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import logo from "@/assets/logo-transparent.png";

export default function PackageBookingConfirmedPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");
  const confettiFired = useRef(false);
  const [processing, setProcessing] = useState(true);
  const [packageBookingId, setPackageBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Process payment on mount
  useEffect(() => {
    if (!sessionId) {
      setProcessing(false);
      setError("No session ID found");
      return;
    }

    const processPayment = async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("process-package-payment", {
          body: { session_id: sessionId },
        });
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
        setPackageBookingId(data?.package_booking_id || null);
      } catch (err: any) {
        console.error("Process package payment error:", err);
        setError(err.message || "Failed to process payment");
      } finally {
        setProcessing(false);
      }
    };

    processPayment();
  }, [sessionId]);

  // Fire confetti
  useEffect(() => {
    if (!processing && !error && !confettiFired.current) {
      confettiFired.current = true;
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.4 },
          colors: ["#e87c3a", "#f5a623", "#ff6b35", "#ffd700", "#ff8c42"],
          disableForReducedMotion: true,
        });
      }, 400);
    }
  }, [processing, error]);

  // Fetch package booking details
  const { data: pkgBooking } = useQuery({
    queryKey: ["pkg-booking-confirmed", packageBookingId],
    queryFn: async () => {
      if (!packageBookingId) return null;
      const { data, error } = await (supabase.from("package_bookings" as any).select("*, packages(name, session_count, discount_percentage, package_type)") as any).eq("id", packageBookingId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!packageBookingId,
  });

  const { data: pkgSessions } = useQuery({
    queryKey: ["pkg-sessions-confirmed", packageBookingId],
    queryFn: async () => {
      if (!packageBookingId) return [];
      const { data, error } = await (supabase.from("package_sessions" as any).select("*, bookings(booking_date, booking_time, staff:staff_id(name), service:service_id(name))") as any)
        .eq("package_booking_id", packageBookingId)
        .order("session_number");
      if (error) throw error;
      return data || [];
    },
    enabled: !!packageBookingId,
  });

  if (processing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm font-body text-muted-foreground">Processing your payment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-destructive font-body text-center">{error}</p>
        <Button onClick={() => navigate("/packages")}>Back to Packages</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background border-b border-border/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto" />
          </Link>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-6">
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
          >
            <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-heading text-foreground">Your package is booked! 🐾</h1>
          <p className="text-muted-foreground text-sm font-body max-w-sm mx-auto">
            Check your email — we've sent you a confirmation and a link to sign your agreement. You'll receive a reminder before each session.
          </p>
        </motion.div>

        {pkgBooking && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base">{(pkgBooking as any).packages?.name}</h3>
                  <Badge className="bg-green-100 text-green-700 text-xs">Paid</Badge>
                </div>
                <p className="text-sm text-muted-foreground font-body">
                  {pkgBooking.customer_name} — {pkgBooking.dog_name}
                </p>
                <p className="text-sm font-body font-bold">Total: £{Number(pkgBooking.total_paid).toFixed(2)}</p>

                <Separator />

                <div className="space-y-2">
                  {(pkgSessions as any[])?.map((s: any) => {
                    const booking = s.bookings;
                    return (
                      <div key={s.id} className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-body">
                          Session {s.session_number}: {booking?.booking_date ? format(new Date(booking.booking_date + "T00:00:00"), "EEE dd MMM yyyy") : "—"} at {booking?.booking_time?.slice(0, 5) || "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => navigate("/")} variant="outline" className="flex-1 rounded-full h-11 font-body font-bold">
            View Our Website
          </Button>
          <Button onClick={() => navigate("/book")} className="flex-1 bg-accent hover:bg-accent/90 text-white rounded-full h-11 font-body font-bold">
            Book Another Appointment
          </Button>
        </div>
      </div>
    </div>
  );
}
