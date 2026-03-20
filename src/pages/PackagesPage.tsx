import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package } from "lucide-react";
import { ActivePackages } from "@/components/packages/ActivePackages";
import { CreatePackageBooking } from "@/components/packages/CreatePackageBooking";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export default function PackagesPage() {
  const [tab, setTab] = useState("active");
  const { user } = useAuth();
  const { role } = useUserRole(user?.id);
  const isAdmin = role === "director" || role === "manager";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Package className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Package Deals</h1>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="active">Active Packages</TabsTrigger>
            {isAdmin && <TabsTrigger value="create">Create New</TabsTrigger>}
          </TabsList>

          <TabsContent value="active">
            <ActivePackages />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="create">
              <CreatePackageBooking onCreated={() => setTab("active")} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
