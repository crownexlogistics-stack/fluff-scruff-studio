import { AppLayout } from "@/components/AppLayout";
import { Routes, Route, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { CustomersSection } from "@/components/marketing/CustomersSection";
import { EmailMarketingSection } from "@/components/marketing/EmailMarketingSection";

const Placeholder = ({ title, icon: Icon }: { title: string; icon: React.ElementType }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">This section is ready to be built out.</p>
    </CardContent>
  </Card>
);

export default function MarketingPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Marketing</h1>
          <p className="text-muted-foreground">Manage campaigns, analytics and customer outreach</p>
        </div>

        <Routes>
          <Route index element={<Navigate to="customers" replace />} />
          <Route path="customers" element={<CustomersSection />} />
          <Route path="analytics" element={<Placeholder title="Booking Analytics" icon={BarChart3} />} />
          <Route path="email" element={<EmailMarketingSection />} />
        </Routes>
      </div>
    </AppLayout>
  );
}
