import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dog, Scissors, Users, Calendar, Mail } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Index = () => {
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
    { label: "Breeds", value: breedCount ?? 0, icon: Dog, color: "text-primary" },
    { label: "Services", value: serviceCount ?? 0, icon: Scissors, color: "text-accent" },
    { label: "Staff", value: staffCount ?? 0, icon: Users, color: "text-success" },
    { label: "Bookings", value: bookingCount ?? 0, icon: Calendar, color: "text-muted-foreground" },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome to Fluff & Scruff Studio</p>
          </div>
          <Button
            variant="outline"
            onClick={() => sendTest.mutate()}
            disabled={sendTest.isPending}
          >
            <Mail className="h-4 w-4 mr-2" />
            {sendTest.isPending ? "Sending…" : "Send Test Email"}
          </Button>
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
