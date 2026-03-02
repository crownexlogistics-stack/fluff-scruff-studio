import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GroomerLayout } from "@/components/GroomerLayout";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, MessageSquare, Dog, PoundSterling, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroomerDocuments } from "@/components/incident-reports/GroomerIncidentReview";
import { GroomerBookingsTab } from "@/components/groomer/GroomerBookingsTab";
import { GroomerMessagesTab } from "@/components/groomer/GroomerMessagesTab";
import { GroomerBreedsTab } from "@/components/groomer/GroomerBreedsTab";

const GroomerPortalPage = () => {
  const { user } = useAuth();
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchStaff = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("staff")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      setStaffId(data?.id ?? null);
      setLoading(false);
    };
    fetchStaff();
  }, [user]);

  if (loading) {
    return (
      <GroomerLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </GroomerLayout>
    );
  }

  if (!staffId) {
    return (
      <GroomerLayout>
        <div className="text-center py-16 space-y-3">
          <CalendarDays className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground">Your staff profile is not linked yet. Please contact the studio.</p>
        </div>
      </GroomerLayout>
    );
  }

  return (
    <GroomerLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-heading text-foreground">My Portal</h1>
          <p className="text-muted-foreground font-body text-sm mt-1">Your schedule, messages & more</p>
        </div>

        <Tabs defaultValue="bookings">
          <TabsList className="flex-wrap">
            <TabsTrigger value="bookings" className="gap-1.5">
              <CalendarDays className="h-4 w-4" /> Bookings
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5">
              <MessageSquare className="h-4 w-4" /> Messages
            </TabsTrigger>
            <TabsTrigger value="breeds" className="gap-1.5">
              <Dog className="h-4 w-4" /> Breeds
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-1.5">
              <PoundSterling className="h-4 w-4" /> Finance
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="h-4 w-4" /> Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="mt-4">
            <GroomerBookingsTab staffId={staffId} />
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            <GroomerMessagesTab staffId={staffId} />
          </TabsContent>

          <TabsContent value="breeds" className="mt-4">
            <GroomerBreedsTab />
          </TabsContent>

          <TabsContent value="finance" className="mt-4">
            <div className="text-center py-16 space-y-3">
              <PoundSterling className="h-12 w-12 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground font-body">Finance section coming soon</p>
              <p className="text-xs text-muted-foreground">Commission tracking and payouts will appear here</p>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <GroomerDocuments />
          </TabsContent>
        </Tabs>
      </div>
    </GroomerLayout>
  );
};

export default GroomerPortalPage;
