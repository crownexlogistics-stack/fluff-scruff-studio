import { AppLayout } from "@/components/AppLayout";
import { Routes, Route, Navigate } from "react-router-dom";
import { CustomersSection } from "@/components/marketing/CustomersSection";
import { EmailMarketingSection } from "@/components/marketing/EmailMarketingSection";
import { BookingAnalyticsSection } from "@/components/marketing/BookingAnalyticsSection";
import { SMSSection } from "@/components/marketing/SMSSection";

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
          <Route path="analytics" element={<BookingAnalyticsSection />} />
          <Route path="email" element={<EmailMarketingSection />} />
          <Route path="sms/*" element={<SMSSection />} />
        </Routes>
      </div>
    </AppLayout>
  );
}
