import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import YearOnYearTab from "@/components/historical/YearOnYearTab";
import CustomerLookupTab from "@/components/historical/CustomerLookupTab";
import BookingRecordsTab from "@/components/historical/BookingRecordsTab";

const HistoricalDataPage = () => (
  <AppLayout>
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold" style={{ color: "#2D1B0E" }}>
          Historical Data Hub
        </h1>
        <p className="text-sm mt-1" style={{ color: "#8B6F5C" }}>
          Archive, customer lookup &amp; year-on-year performance
        </p>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="rounded-[30px] p-1 h-auto flex-wrap" style={{ backgroundColor: "#f0e6da" }}>
          <TabsTrigger value="performance" className="rounded-[30px] text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            📊 Year-on-Year
          </TabsTrigger>
          <TabsTrigger value="customers" className="rounded-[30px] text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            🔍 Customer Lookup
          </TabsTrigger>
          <TabsTrigger value="records" className="rounded-[30px] text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            📋 Booking Records
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <YearOnYearTab />
        </TabsContent>
        <TabsContent value="customers">
          <CustomerLookupTab />
        </TabsContent>
        <TabsContent value="records">
          <BookingRecordsTab />
        </TabsContent>
      </Tabs>
    </div>
  </AppLayout>
);

export default HistoricalDataPage;
