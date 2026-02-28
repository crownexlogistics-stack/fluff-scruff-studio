import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BarChart3, Tags, Search, Facebook, Instagram, Mail } from "lucide-react";

const sections = [
  { value: "customers", label: "Customers", icon: Users },
  { value: "booking-analytics", label: "Booking Analytics", icon: BarChart3 },
  { value: "discounts", label: "Discounts", icon: Tags },
  { value: "seo", label: "SEO", icon: Search },
  { value: "social", label: "Facebook & Instagram", icon: Facebook },
  { value: "email", label: "Email Marketing", icon: Mail },
] as const;

export default function MarketingPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Marketing</h1>
          <p className="text-muted-foreground">Manage campaigns, analytics and customer outreach</p>
        </div>

        <Tabs defaultValue="customers" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {sections.map((s) => (
              <TabsTrigger key={s.value} value={s.value} className="flex items-center gap-1.5">
                <s.icon className="h-4 w-4" />
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {sections.map((s) => (
            <TabsContent key={s.value} value={s.value}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <s.icon className="h-5 w-5" />
                    {s.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">This section is ready to be built out.</p>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
