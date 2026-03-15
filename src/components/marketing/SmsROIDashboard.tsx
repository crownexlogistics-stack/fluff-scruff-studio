import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Target, PoundSterling, TrendingUp, CheckCircle2, MousePointerClick, BarChart3 } from "lucide-react";

interface SmsCampaignROI {
  name: string;
  sent: number;
  delivered: number;
  clicks: number;
  attributedBookings: number;
  attributedRevenue: number;
  conversionRate: number;
  deliveryRate: number;
}

export function SmsROIDashboard() {
  // Fetch all bulk SMS logs grouped by campaign
  const { data: smsLogs } = useQuery({
    queryKey: ["sms-roi-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulk_sms_log")
        .select("campaign_name, status, delivery_status, sent_at")
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch click data
  const { data: clickData } = useQuery({
    queryKey: ["sms-roi-clicks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_link_clicks")
        .select("campaign_name");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const c of (data || [])) {
        const key = c.campaign_name || "";
        map.set(key, (map.get(key) || 0) + 1);
      }
      return map;
    },
  });

  // Fetch attributed bookings
  const { data: attributedBookings } = useQuery({
    queryKey: ["sms-attributed-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, attributed_sms_campaign, total_price, status")
        .not("attributed_sms_campaign", "is", null)
        .in("status", ["Pending", "Confirmed", "Completed"]);
      if (error) throw error;
      return data;
    },
  });

  // Build campaign stats
  const campaignMap = new Map<string, { sent: number; delivered: number }>();
  for (const log of (smsLogs || [])) {
    const key = log.campaign_name || "Unknown";
    if (!campaignMap.has(key)) campaignMap.set(key, { sent: 0, delivered: 0 });
    const c = campaignMap.get(key)!;
    if (log.status === "sent") c.sent++;
    if (log.delivery_status === "delivered") c.delivered++;
  }

  const campaignStats: SmsCampaignROI[] = Array.from(campaignMap.entries()).map(([name, stats]) => {
    const clicks = clickData?.get(name) || 0;
    const bookings = (attributedBookings || []).filter(b => b.attributed_sms_campaign === name);
    const attributedCount = bookings.length;
    const attributedRevenue = bookings.reduce((sum, b) => sum + Number(b.total_price), 0);
    const conversionRate = stats.sent > 0 ? (attributedCount / stats.sent) * 100 : 0;
    const deliveryRate = stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0;

    return {
      name,
      sent: stats.sent,
      delivered: stats.delivered,
      clicks,
      attributedBookings: attributedCount,
      attributedRevenue,
      conversionRate,
      deliveryRate,
    };
  });

  const totals = campaignStats.reduce(
    (acc, c) => ({
      campaigns: acc.campaigns + 1,
      sent: acc.sent + c.sent,
      delivered: acc.delivered + c.delivered,
      clicks: acc.clicks + c.clicks,
      bookings: acc.bookings + c.attributedBookings,
      revenue: acc.revenue + c.attributedRevenue,
    }),
    { campaigns: 0, sent: 0, delivered: 0, clicks: 0, bookings: 0, revenue: 0 }
  );

  const avgDeliveryRate = totals.sent > 0 ? (totals.delivered / totals.sent) * 100 : 0;

  const bestCampaign = campaignStats.length > 0
    ? campaignStats.reduce((best, c) => c.attributedRevenue > best.attributedRevenue ? c : best)
    : null;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
        <MessageSquare className="h-5 w-5" /> SMS Campaign ROI
      </h3>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Campaigns</span>
            </div>
            <p className="text-2xl font-bold font-heading">{totals.campaigns}</p>
            <p className="text-xs text-muted-foreground">{totals.sent} SMS sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Delivered</span>
            </div>
            <p className="text-2xl font-bold font-heading">{totals.delivered}</p>
            <p className="text-xs text-muted-foreground">{avgDeliveryRate.toFixed(1)}% delivery rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MousePointerClick className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Link Clicks</span>
            </div>
            <p className="text-2xl font-bold font-heading">{totals.clicks}</p>
            <p className="text-xs text-muted-foreground">
              {totals.delivered > 0 ? ((totals.clicks / totals.delivered) * 100).toFixed(1) : "0"}% click rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Bookings</span>
            </div>
            <p className="text-2xl font-bold font-heading">{totals.bookings}</p>
            <p className="text-xs text-muted-foreground">
              {totals.sent > 0 ? ((totals.bookings / totals.sent) * 100).toFixed(1) : "0"}% conversion
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <PoundSterling className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Revenue</span>
            </div>
            <p className="text-2xl font-bold font-heading">£{totals.revenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              {totals.bookings > 0 ? `£${(totals.revenue / totals.bookings).toFixed(2)} avg` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Rev/SMS</span>
            </div>
            <p className="text-2xl font-bold font-heading">
              £{totals.sent > 0 ? (totals.revenue / totals.sent).toFixed(2) : "0.00"}
            </p>
            <p className="text-xs text-muted-foreground">per SMS sent</p>
          </CardContent>
        </Card>
      </div>

      {/* Best campaign highlight */}
      {bestCampaign && bestCampaign.attributedRevenue > 0 && (
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm font-medium text-primary flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Best performing SMS campaign: <span className="font-bold">{bestCampaign.name}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            £{bestCampaign.attributedRevenue.toFixed(2)} revenue · {bestCampaign.attributedBookings} bookings · {bestCampaign.deliveryRate.toFixed(0)}% delivery
          </p>
        </div>
      )}

      {/* Per-campaign breakdown */}
      {campaignStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> SMS Campaign Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {campaignStats.map(c => (
                <div key={c.name} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.sent} sent · {c.delivered} delivered · {c.deliveryRate.toFixed(0)}% delivery
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold font-heading">£{c.attributedRevenue.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{c.attributedBookings} booking{c.attributedBookings !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3" />
                      {c.deliveryRate.toFixed(0)}% delivered
                    </Badge>
                    {c.clicks > 0 && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <MousePointerClick className="h-3 w-3" />
                        {c.clicks} clicks
                      </Badge>
                    )}
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Target className="h-3 w-3" />
                      {c.attributedBookings} attributed
                    </Badge>
                    <Badge variant={c.conversionRate > 5 ? "default" : "secondary"} className="text-xs">
                      {c.conversionRate.toFixed(1)}% conversion
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {campaignStats.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No SMS campaigns sent yet.</p>
      )}
    </div>
  );
}
