import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import logo from "@/assets/logo-transparent.png";

export default function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activated, setActivated] = useState(false);

  // Activate the migrated customer on mount
  useEffect(() => {
    if (!user?.email || activated) return;

    const activate = async () => {
      await supabase
        .from("migrated_customers")
        .update({
          status: "activated",
          activated_at: new Date().toISOString(),
          supabase_user_id: user.id,
        })
        .eq("email", user.email!.toLowerCase());
      setActivated(true);
    };

    activate();
  }, [user?.email, user?.id, activated]);

  // Fetch upcoming migrated bookings
  const { data: upcomingBookings = [] } = useQuery({
    queryKey: ["welcome-migrated-bookings", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const { data: customer } = await supabase
        .from("migrated_customers")
        .select("id")
        .eq("email", user.email.toLowerCase())
        .maybeSingle();
      if (!customer) return [];

      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("migrated_bookings")
        .select("*")
        .eq("migrated_customer_id", customer.id)
        .gte("booking_date", today)
        .order("booking_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.email,
  });

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#FFFAF4" }}
    >
      <div className="max-w-md w-full text-center space-y-6">
        {/* Logo */}
        <img src={logo} alt="Fluff & Scruff" className="h-20 w-auto mx-auto" />

        {/* Heading */}
        <h1
          className="text-3xl font-bold"
          style={{ fontFamily: "'Fredoka One', 'Nunito', sans-serif", color: "#1a1a1a" }}
        >
          Welcome to Fluff & Scruff! 🐾
        </h1>

        {/* Subtext */}
        <p
          className="text-base leading-relaxed"
          style={{ fontFamily: "'Nunito', sans-serif", color: "#555" }}
        >
          You're all set. Your appointment history is already here waiting for you.
        </p>

        {/* Upcoming bookings preview */}
        {upcomingBookings.length > 0 && (
          <div className="space-y-3 text-left">
            <p
              className="text-sm font-semibold"
              style={{ fontFamily: "'Nunito', sans-serif", color: "#333" }}
            >
              📅 Your upcoming appointments:
            </p>
            <div className="space-y-2">
              {upcomingBookings.map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                  style={{
                    backgroundColor: "#ffffff",
                    borderColor: "#fed7aa",
                  }}
                >
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ fontFamily: "'Nunito', sans-serif", color: "#1a1a1a" }}
                    >
                      {b.service_name}
                    </p>
                    <p className="text-xs" style={{ color: "#777" }}>
                      {format(new Date(b.booking_date), "EEE d MMM")}
                      {b.booking_time && ` at ${b.booking_time.slice(0, 5)}`}
                      {b.dog_name && ` · ${b.dog_name}`}
                    </p>
                  </div>
                  <Badge
                    className="text-[10px] border-0"
                    style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}
                  >
                    Upcoming
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <Button
          onClick={() => navigate("/my-pets")}
          className="w-full text-base font-bold py-6"
          style={{
            backgroundColor: "#F97316",
            color: "#ffffff",
            borderRadius: "30px",
            fontFamily: "'Fredoka One', 'Nunito', sans-serif",
            fontSize: "16px",
          }}
        >
          Take Me to My Account 🐾
        </Button>
      </div>
    </div>
  );
}
