import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GroomerLayout } from "@/components/GroomerLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, CheckCircle, Clock, Dog } from "lucide-react";
import { format } from "date-fns";

interface Booking {
  id: string;
  customer_name: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  notes: string | null;
  services?: { name: string } | null;
  breeds?: { name: string } | null;
}

const GroomerPortalPage = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBookings = async () => {
    if (!user) return;
    setLoading(true);

    // Get the staff record linked to this user
    const { data: staffRecord } = await supabase
      .from("staff")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!staffRecord) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("bookings")
      .select("id, customer_name, dog_name, booking_date, booking_time, status, notes, services(name), breeds(name)")
      .eq("staff_id", staffRecord.id)
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true });

    if (error) {
      console.error(error);
    } else {
      setBookings((data as unknown as Booking[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, [user]);

  const markAsFinished = async (bookingId: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "Completed" })
      .eq("id", bookingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Booking marked as completed" });
      fetchBookings();
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const todayBookings = bookings.filter((b) => b.booking_date === today);
  const upcomingBookings = bookings.filter((b) => b.booking_date > today);

  return (
    <GroomerLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-2xl font-heading text-foreground">My Schedule</h1>
          <p className="text-muted-foreground font-body text-sm mt-1">Your assigned appointments</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <CalendarDays className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground font-body">No appointments assigned to you yet.</p>
          </div>
        ) : (
          <>
            {/* Today */}
            {todayBookings.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-heading text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-accent" /> Today
                </h2>
                {todayBookings.map((b) => (
                  <BookingCard key={b.id} booking={b} onMarkFinished={markAsFinished} />
                ))}
              </div>
            )}

            {/* Upcoming */}
            {upcomingBookings.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-heading text-foreground">Upcoming</h2>
                {upcomingBookings.map((b) => (
                  <BookingCard key={b.id} booking={b} onMarkFinished={markAsFinished} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </GroomerLayout>
  );
};

function BookingCard({ booking, onMarkFinished }: { booking: Booking; onMarkFinished: (id: string) => void }) {
  const isCompleted = booking.status === "Completed";

  return (
    <div className={`rounded-2xl border border-border/60 bg-card p-5 shadow-sm shadow-black/[0.02] ${isCompleted ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Dog className="h-4 w-4 text-accent" />
            <span className="font-semibold text-foreground">{booking.dog_name}</span>
            <span className="text-muted-foreground text-sm">({booking.customer_name})</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(booking.booking_date), "EEE d MMM")} at {booking.booking_time}
          </p>
          {booking.services?.name && (
            <Badge variant="outline" className="text-xs">{booking.services.name}</Badge>
          )}
          {booking.notes && <p className="text-xs text-muted-foreground mt-1">{booking.notes}</p>}
        </div>

        <div className="shrink-0">
          {isCompleted ? (
            <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Done
            </Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onMarkFinished(booking.id)}>
              Mark Finished
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroomerPortalPage;
