import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GroomerLayout } from "@/components/GroomerLayout";
import { CalendarDays, MessageSquare, Dog, PoundSterling, FileText, ChevronRight, ArrowLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroomerBookingsTab } from "@/components/groomer/GroomerBookingsTab";
import { GroomerMessagesTab } from "@/components/groomer/GroomerMessagesTab";
import { GroomerBreedsTab } from "@/components/groomer/GroomerBreedsTab";
import { GroomerDocumentsTab } from "@/components/groomer/GroomerDocumentsTab";

type Section = "bookings" | "messages" | "breeds" | "finance" | "documents";

const sectionCards: { id: Section; icon: React.ElementType; title: string; subtitle: string }[] = [
  { id: "bookings", icon: CalendarDays, title: "Bookings", subtitle: "Your schedule & salon calendar" },
  { id: "messages", icon: MessageSquare, title: "Messages", subtitle: "Customer enquiries & replies" },
  { id: "breeds", icon: Dog, title: "Breeds", subtitle: "Pricing & duration reference" },
  { id: "finance", icon: PoundSterling, title: "Finance", subtitle: "Commission & payouts" },
  { id: "documents", icon: FileText, title: "Documents", subtitle: "Contract, policies & reports" },
];

const GroomerPortalPage = () => {
  const { user } = useAuth();
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<Section | null>(null);

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

  const renderSectionContent = (section: Section) => {
    switch (section) {
      case "bookings": return <GroomerBookingsTab staffId={staffId} />;
      case "messages": return <GroomerMessagesTab staffId={staffId} />;
      case "breeds": return <GroomerBreedsTab />;
      case "documents": return <GroomerDocumentsTab staffId={staffId} />;
      case "finance": return (
        <div className="text-center py-16 space-y-3">
          <PoundSterling className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground font-body">Finance section coming soon</p>
          <p className="text-xs text-muted-foreground">Commission tracking and payouts will appear here</p>
        </div>
      );
    }
  };

  // Mobile: card-based navigation
  if (isMobile) {
    if (activeSection) {
      const sectionMeta = sectionCards.find(s => s.id === activeSection)!;
      return (
        <GroomerLayout>
          <div className="space-y-4">
            <button
              onClick={() => setActiveSection(null)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div>
              <h1 className="text-xl font-heading text-foreground">{sectionMeta.title}</h1>
              <p className="text-muted-foreground text-xs mt-0.5">{sectionMeta.subtitle}</p>
            </div>
            {renderSectionContent(activeSection)}
          </div>
        </GroomerLayout>
      );
    }

    return (
      <GroomerLayout>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-heading text-foreground">My Account</h1>
            <p className="text-muted-foreground font-body text-sm mt-1">Your schedule, messages & more</p>
          </div>
          <div className="space-y-3">
            {sectionCards.map((card) => (
              <button
                key={card.id}
                onClick={() => setActiveSection(card.id)}
                className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:shadow-md transition-all active:scale-[0.98] flex items-center gap-3"
              >
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{card.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </GroomerLayout>
    );
  }

  // Desktop: tabs
  return (
    <GroomerLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-heading text-foreground">My Account</h1>
          <p className="text-muted-foreground font-body text-sm mt-1">Your schedule, messages & more</p>
        </div>

        <Tabs defaultValue="bookings">
          <TabsList className="flex-wrap">
            <TabsTrigger value="bookings" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Bookings</TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5"><MessageSquare className="h-4 w-4" /> Messages</TabsTrigger>
            <TabsTrigger value="breeds" className="gap-1.5"><Dog className="h-4 w-4" /> Breeds</TabsTrigger>
            <TabsTrigger value="finance" className="gap-1.5"><PoundSterling className="h-4 w-4" /> Finance</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5"><FileText className="h-4 w-4" /> Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="mt-4">{renderSectionContent("bookings")}</TabsContent>
          <TabsContent value="messages" className="mt-4">{renderSectionContent("messages")}</TabsContent>
          <TabsContent value="breeds" className="mt-4">{renderSectionContent("breeds")}</TabsContent>
          <TabsContent value="finance" className="mt-4">{renderSectionContent("finance")}</TabsContent>
          <TabsContent value="documents" className="mt-4">{renderSectionContent("documents")}</TabsContent>
        </Tabs>
      </div>
    </GroomerLayout>
  );
};

export default GroomerPortalPage;
