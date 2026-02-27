import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dog, Scissors, Users, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
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
    { label: "Breeds", value: breedCount ?? 0, icon: Dog, color: "text-primary" },
    { label: "Services", value: serviceCount ?? 0, icon: Scissors, color: "text-accent" },
    { label: "Staff", value: staffCount ?? 0, icon: Users, color: "text-success" },
    { label: "Bookings", value: bookingCount ?? 0, icon: Calendar, color: "text-muted-foreground" },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-heading font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome to Fluff & Scruff Studio</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-heading">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
