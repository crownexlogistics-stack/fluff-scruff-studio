import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, PoundSterling, BarChart3, MousePointerClick, Clock, MailOpen, Link2 } from "lucide-react";
import { format } from "date-fns";

interface CampaignWithStats {
  id: string;
  subject: string;
  segment: string;
  emails_sent: number;
  sent_at: string | null;
  status: string;
  opens: number;
  unique_opens: number;
  clicks: number;
  unique_clicks: number;
  attributedBookings: number;
  attributedRevenue: number;
  conversionRate: number;
  openRate: number;
  clickRate: number;
}

export function CampaignROIDashboard() {
  const { data: campaigns } = useQuery({
    queryKey: ["email-campaigns-sent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("id, subject, segment, emails_sent, sent_at, status, opens, unique_opens, clicks, unique_clicks")
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch bookings that have been attributed to campaigns
  const { data: attributedBookings } = useQuery({
    queryKey: ["attributed-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, attributed_campaign_id, total_price, status")
        .not("attributed_campaign_id", "is", null)
        .in("status", ["Pending", "Confirmed", "Completed"]);
      if (error) throw error;
      return data;
    },
  });

  const campaignStats: CampaignWithStats[] = (campaigns || []).map(c => {
    const bookings = (attributedBookings || []).filter(b => b.attributed_campaign_id === c.id);
    const attributedCount = bookings.length;
    const attributedRevenue = bookings.reduce((sum, b) => sum + Number(b.total_price), 0);
    const conversionRate = c.emails_sent > 0 ? (attributedCount / c.emails_sent) * 100 : 0;
    const openRate = c.emails_sent > 0 ? ((c.unique_opens || 0) / c.emails_sent) * 100 : 0;
    const clickRate = c.emails_sent > 0 ? ((c.unique_clicks || 0) / c.emails_sent) * 100 : 0;

    return {
      ...c,
      attributedBookings: attributedCount,
      attributedRevenue,
      conversionRate,
      openRate,
      clickRate,
    };
  });

  const totals = campaignStats.reduce(
    (acc, c) => ({
      campaigns: acc.campaigns + 1,
      bookings: acc.bookings + c.attributedBookings,
      revenue: acc.revenue + c.attributedRevenue,
      emailsSent: acc.emailsSent + c.emails_sent,
      totalOpens: acc.totalOpens + (c.unique_opens || 0),
      totalClicks: acc.totalClicks + (c.unique_clicks || 0),
    }),
    { campaigns: 0, bookings: 0, revenue: 0, emailsSent: 0, totalOpens: 0, totalClicks: 0 }
  );

  const avgOpenRate = totals.emailsSent > 0 ? (totals.totalOpens / totals.emailsSent) * 100 : 0;
  const avgClickRate = totals.emailsSent > 0 ? (totals.totalClicks / totals.emailsSent) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Campaigns</span>
            </div>
            <p className="text-2xl font-bold font-heading">{totals.campaigns}</p>
            <p className="text-xs text-muted-foreground">{totals.emailsSent} emails</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MailOpen className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Open Rate</span>
            </div>
            <p className="text-2xl font-bold font-heading">{avgOpenRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">{totals.totalOpens} unique opens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Link2 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Click Rate</span>
            </div>
            <p className="text-2xl font-bold font-heading">{avgClickRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">{totals.totalClicks} unique clicks</p>
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
              {totals.emailsSent > 0 ? ((totals.bookings / totals.emailsSent) * 100).toFixed(1) : "0"}% conversion
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
              <span className="text-xs font-medium uppercase tracking-wider">Rev/Email</span>
            </div>
            <p className="text-2xl font-bold font-heading">
              £{totals.emailsSent > 0 ? (totals.revenue / totals.emailsSent).toFixed(2) : "0.00"}
            </p>
            <p className="text-xs text-muted-foreground">per email sent</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-campaign breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Campaign Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaignStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No sent campaigns yet. Send your first campaign to see ROI data.</p>
          ) : (
            <div className="space-y-3">
              {campaignStats.map(c => (
                <div key={c.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{c.subject}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>Segment: {c.segment}</span>
                        <span>{c.emails_sent} emails</span>
                        {c.sent_at && <span>{format(new Date(c.sent_at), "d MMM yyyy")}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold font-heading">£{c.attributedRevenue.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{c.attributedBookings} booking{c.attributedBookings !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <MailOpen className="h-3 w-3" />
                      {c.openRate.toFixed(1)}% opened
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Link2 className="h-3 w-3" />
                      {c.clickRate.toFixed(1)}% clicked
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-xs">
                      <MousePointerClick className="h-3 w-3" />
                      {c.attributedBookings} attributed
                    </Badge>
                    <Badge variant={c.conversionRate > 5 ? "default" : "secondary"} className="text-xs">
                      {c.conversionRate.toFixed(1)}% conversion
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
