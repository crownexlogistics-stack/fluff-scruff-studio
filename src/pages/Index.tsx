import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dog, Scissors, Users, Calendar, Mail, Sparkles, SmilePlus } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ServiceTile } from "@/components/ServiceTile";
import { BookingFlow } from "@/components/BookingFlow";

const Index = () => {
  const [activeService, setActiveService] = useState<string | null>(null);

  const sendTest = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-test-email");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success("Test email sent to info@fluffandscruff.co.uk"),
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: breedCount } = useQuery({
    queryKey: ["breeds-count"],
    queryFn: async () => {
      const { count } = await supabase.from("breeds").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: serviceCount } = useQuery({
    queryKey: ["services-count"],
    queryFn: async () => {
      const { count } = await supabase.from("services").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: staffCount } = useQuery({
    queryKey: ["staff-count"],
    queryFn: async () => {
      const { count } = await supabase.from("staff").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: bookingCount } = useQuery({
    queryKey: ["bookings-count"],
    queryFn: async () => {
      const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const stats = [
    { label: "Breeds", value: breedCount ?? 0, icon: Dog, color: "text-navy" },
    { label: "Services", value: serviceCount ?? 0, icon: Scissors, color: "text-rose-gold" },
    { label: "Staff", value: staffCount ?? 0, icon: Users, color: "text-success" },
    { label: "Bookings", value: bookingCount ?? 0, icon: Calendar, color: "text-muted-foreground" },
  ];

  const services = [
    { title: "Grooming", subtitle: "Full groom or bath & brush", icon: Scissors, gradient: "rose" as const },
    { title: "Puppy Special", subtitle: "Gentle first-time groom", icon: Sparkles, gradient: "navy" as const },
    { title: "Teeth Cleaning", subtitle: "Fresh breath & healthy gums", icon: SmilePlus, gradient: "rose" as const },
    { title: "Nail Clipping", subtitle: "Quick & painless trim", icon: Dog, gradient: "navy" as const },
  ];

  return (
    <AppLayout>
      <div className="space-y-8 max-w-lg mx-auto">
        {/* Welcome */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-heading">Fluff & Scruff</h1>
            <p className="text-muted-foreground text-sm mt-1">What can we do for you today?</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => sendTest.mutate()}
            disabled={sendTest.isPending}
            className="rounded-2xl h-12 w-12"
          >
            <Mail className="h-5 w-5" />
          </Button>
        </div>

        {/* Service Tiles */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground font-body">
            Our Services
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {services.map((s) => (
              <ServiceTile
                key={s.title}
                title={s.title}
                subtitle={s.subtitle}
                icon={s.icon}
                gradient={s.gradient}
                onClick={() => setActiveService(s.title)}
              />
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground font-body">
            Quick Stats
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <Card key={stat.label} className="rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between pb-1 p-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground font-body">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold font-heading">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      {/* Booking Flow Overlay */}
      {activeService && (
        <BookingFlow
          service={activeService}
          onClose={() => setActiveService(null)}
        />
      )}
    </AppLayout>
  );
};

export default Index;
