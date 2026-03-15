import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  MessageSquare, Send, Loader2, Phone, ArrowUpRight, ArrowDownLeft,
  Bell, CheckCircle2, AlertTriangle, Clock, Users, XCircle, Megaphone,
  Link as LinkIcon, TrendingUp, BarChart3, Eye, Target
} from "lucide-react";

export function SMSSection() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["sms-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { phone, body },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-messages"] });
      setPhone("");
      setBody("");
      toast.success("SMS sent!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const charCount = body.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  return (
    <div className="space-y-6">
      {/* Send SMS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-green-500" />
            Send SMS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+447..." />
              <p className="text-[10px] text-muted-foreground">International format (e.g. +447476452782)</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>Message</span>
                <span className="text-muted-foreground">{charCount}/160 ({smsCount} SMS)</span>
              </label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Hi! Just a reminder about your grooming appointment tomorrow..." className="min-h-[80px] resize-none" maxLength={480} />
            </div>
          </div>
          <Button onClick={() => sendMutation.mutate()} disabled={!phone.trim() || !body.trim() || sendMutation.isPending} className="gap-1.5">
            {sendMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send SMS</>}
          </Button>
        </CardContent>
      </Card>

      {/* SMS Templates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "Appointment Reminder", text: "Hi! Reminder: Your dog's grooming appointment at Fluff & Scruff Studio is tomorrow. Please arrive 5 minutes early. Call 01708 606655 if you need to reschedule. See you soon! 🐾" },
              { label: "Booking Confirmation", text: "Your grooming appointment at Fluff & Scruff Studio has been confirmed! We look forward to seeing you and your furry friend. 📍 138 Hillview Avenue, Hornchurch RM11 2DL" },
              { label: "Follow Up", text: "Hi! Thank you for visiting Fluff & Scruff Studio. We hope your pup is looking fabulous! Ready to rebook? Call 01708 606655 or visit fluffandscruff.co.uk/book 🐾" },
            ].map(t => (
              <button key={t.label} onClick={() => setBody(t.text)} className="text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors space-y-1">
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.text}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Automated SMS Reminders Log */}
      <SmsRemindersLog />

      <Separator className="my-8" />

      {/* SMS Campaign ROI */}
      <SmsROIDashboard />

      <Separator className="my-8" />

      {/* Bulk SMS Campaign */}
      <BulkSmsCampaign />

      {/* SMS History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5" /> SMS History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !messages?.length ? (
            <p className="text-center text-muted-foreground py-8">No SMS messages yet.</p>
          ) : (
            <div className="space-y-2">
              {messages.map(m => (
                <div key={m.id} className="flex items-start gap-3 border rounded-lg p-3">
                  <div className={`p-1.5 rounded-full ${m.direction === "outbound" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}>
                    {m.direction === "outbound" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium">{m.phone_number}</p>
                      <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{m.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(m.created_at), "d MMM yyyy HH:mm")}</p>
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

// ─── BULK SMS CAMPAIGN ──────────────────────────────────

interface CampaignData {
  name: string;
  message: string;
  sent: number;
  failed: number;
  skipped: number;
  delivered: number;
  undelivered: number;
  date: string;
  failedEntries: { phone: string; error: string }[];
  undeliveredEntries: { phone: string; errorCode: string }[];
  clicks: number;
  hasLink: boolean;
  attributedBookings: number;
  attributedRevenue: number;
}

function BulkSmsCampaign() {
  const queryClient = useQueryClient();
  const [bulkMessage, setBulkMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "has_upcoming" | "no_upcoming" | "manual">("all");
  const [manualNumbers, setManualNumbers] = useState("");
  const [viewFailedCampaign, setViewFailedCampaign] = useState<string | null>(null);
  const [viewDetailsCampaign, setViewDetailsCampaign] = useState<string | null>(null);

  const TEMPLATES = [
    { label: "Appointment Reminder", text: "Hi! Reminder: Your dog's grooming appointment at Fluff & Scruff Studio is tomorrow. Please arrive 5 minutes early. Call 01708 606655 if you need to reschedule. See you soon! 🐾" },
    { label: "Booking Confirmation", text: "Your grooming appointment at Fluff & Scruff Studio has been confirmed! We look forward to seeing you and your furry friend. 📍 138 Hillview Avenue, Hornchurch RM11 2DL" },
    { label: "Follow Up", text: "Hi! Thank you for visiting Fluff & Scruff Studio. We hope your pup is looking fabulous! Ready to rebook? Call 01708 606655 or visit fluffandscruff.co.uk/book 🐾" },
  ];

  // Fetch customer phone numbers for count + unreachable count
  const { data: customerStats } = useQuery({
    queryKey: ["bulk-sms-customer-stats"],
    queryFn: async () => {
      const phoneSet = new Set<string>();
      let unreachableCount = 0;
      let optOutCount = 0;

      const { data: mc } = await supabase.from("migrated_customers").select("phone, sms_unreachable, sms_opt_out").not("phone", "is", null);
      for (const c of (mc || [])) {
        if (c.phone) {
          const n = normalizePhone(c.phone);
          if (n) {
            if (c.sms_opt_out) { optOutCount++; continue; }
            if (c.sms_unreachable) { unreachableCount++; continue; }
            phoneSet.add(n);
          }
        }
      }

      const { data: bk } = await supabase.from("bookings").select("customer_phone").not("customer_phone", "is", null);
      for (const b of (bk || [])) {
        if (b.customer_phone) {
          const n = normalizePhone(b.customer_phone);
          if (n) phoneSet.add(n);
        }
      }

      return { total: phoneSet.size, unreachable: unreachableCount, optOut: optOutCount };
    },
  });

  // Fetch click data
  const { data: clickData } = useQuery({
    queryKey: ["sms-link-clicks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_link_clicks")
        .select("campaign_name, phone_hash, clicked_at");
      if (error) throw error;
      // Group by campaign
      const clickMap = new Map<string, number>();
      for (const click of (data || [])) {
        const key = click.campaign_name || "";
        clickMap.set(key, (clickMap.get(key) || 0) + 1);
      }
      return clickMap;
    },
  });

  // Fetch attributed bookings for SMS campaigns
  const { data: smsAttributedBookings } = useQuery({
    queryKey: ["sms-attributed-bookings-detail"],
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

  // Fetch campaign history with delivery status
  const { data: campaignHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["bulk-sms-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulk_sms_log")
        .select("campaign_name, message, status, delivery_status, sent_at, phone, error_message, error_code")
        .order("sent_at", { ascending: false });
      if (error) throw error;

      const campaigns = new Map<string, CampaignData>();
      for (const log of (data || [])) {
        const key = log.campaign_name || "Unknown";
        if (!campaigns.has(key)) {
          const bookings = (smsAttributedBookings || []).filter(b => b.attributed_sms_campaign === key);
          campaigns.set(key, {
            name: key, message: log.message, sent: 0, failed: 0, skipped: 0,
            delivered: 0, undelivered: 0, date: log.sent_at,
            failedEntries: [], undeliveredEntries: [],
            clicks: clickData?.get(key) || 0,
            hasLink: /https?:\/\//.test(log.message),
            attributedBookings: bookings.length,
            attributedRevenue: bookings.reduce((sum, b) => sum + Number(b.total_price), 0),
          });
        }
        const c = campaigns.get(key)!;

        // Count by initial send status
        if (log.status === "sent") c.sent++;
        else if (log.status === "failed") {
          c.failed++;
          c.failedEntries.push({ phone: log.phone, error: log.error_message || "Unknown" });
        } else c.skipped++;

        // Count by delivery status (from webhook)
        if (log.delivery_status === "delivered") c.delivered++;
        else if (log.delivery_status === "undelivered") {
          c.undelivered++;
          c.undeliveredEntries.push({ phone: log.phone, errorCode: log.error_code || "" });
        } else if (log.delivery_status === "failed") {
          // Already counted in send failures
        }
      }
      return Array.from(campaigns.values());
    },
    enabled: clickData !== undefined && smsAttributedBookings !== undefined,
  });

  // Best performing campaign
  const bestCampaign = useMemo(() => {
    if (!campaignHistory?.length) return null;
    const withDelivery = campaignHistory.filter(c => c.delivered > 0);
    if (!withDelivery.length) return null;
    return withDelivery.reduce((best, c) => {
      const rate = c.sent > 0 ? c.delivered / c.sent : 0;
      const bestRate = best.sent > 0 ? best.delivered / best.sent : 0;
      return rate > bestRate ? c : best;
    });
  }, [campaignHistory]);

  const STOP_SUFFIX = " Reply STOP to unsubscribe.";
  const fullMessageLength = bulkMessage.length + STOP_SUFFIX.length;
  const bulkCharCount = bulkMessage.length;
  const bulkSmsCount = Math.ceil(fullMessageLength / 160) || 1;

  const manualNumberList = useMemo(() => {
    if (filter !== "manual") return [];
    return manualNumbers
      .split(/[\n,;]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);
  }, [manualNumbers, filter]);

  const recipientCount = filter === "manual" ? manualNumberList.length : (customerStats?.total || 0);
  const unreachableCount = customerStats?.unreachable || 0;
  const optOutCount = customerStats?.optOut || 0;
  const estimatedCost = (recipientCount * bulkSmsCount * 0.04).toFixed(2);

  const sendBulkMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { message: bulkMessage, filter };
      if (filter === "manual") {
        payload.manualNumbers = manualNumberList;
      }
      const { data, error } = await supabase.functions.invoke("send-bulk-sms", {
        body: payload,
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bulk-sms-history"] });
      if (data.remaining > 0) {
        toast.info(`Sent ${data.sent} so far — ${data.remaining} remaining. Click "Continue Sending" to resume.`);
      } else {
        toast.success(`Bulk SMS complete! ${data.sent} sent, ${data.failed || 0} failed.`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const retryMutation = useMutation({
    mutationFn: async (campaignName: string) => {
      const campaign = campaignHistory?.find(c => c.name === campaignName);
      const { data, error } = await supabase.functions.invoke("send-bulk-sms", {
        body: { message: campaign?.message || bulkMessage, retryFailed: true, existingCampaignName: campaignName },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bulk-sms-history"] });
      if (data.noFailedToRetry) {
        toast.info("No failed SMS to retry — all were successful!");
      } else {
        toast.success(`Retry complete! ${data.sent} sent, ${data.failed || 0} still failed.`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const detailsCampaign = viewDetailsCampaign
    ? campaignHistory?.find(c => c.name === viewDetailsCampaign)
    : null;

  const failedCampaignEntries = viewFailedCampaign
    ? campaignHistory?.find(c => c.name === viewFailedCampaign)?.failedEntries || []
    : [];

  return (
    <>
      <Card className="border-2 border-dashed border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-primary" />
            Bulk SMS Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Unreachable warning */}
          {(unreachableCount > 0 || optOutCount > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">
                {unreachableCount > 0 && <><span className="font-medium">{unreachableCount} unreachable</span> · </>}
                {optOutCount > 0 && <><span className="font-medium">{optOutCount} opted out (STOP)</span> · </>}
                These are excluded from bulk sends automatically.
              </p>
            </div>
          )}

          {/* Quick Templates */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Quick Templates</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.label} onClick={() => setBulkMessage(t.text)} className="text-left border rounded-lg p-2.5 hover:bg-muted/50 transition-colors space-y-0.5">
                  <p className="text-xs font-medium">{t.label}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{t.text}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Message</span>
              <span>{fullMessageLength}/160 ({bulkSmsCount} SMS per recipient)</span>
            </label>
            <Textarea
              value={bulkMessage}
              onChange={e => setBulkMessage(e.target.value)}
              placeholder="Type your bulk SMS message..."
              className="min-h-[100px] resize-none"
              maxLength={480 - STOP_SUFFIX.length}
            />
            <p className="text-[10px] text-muted-foreground italic">
              "Reply STOP to unsubscribe." will be added automatically
            </p>
          </div>

          {/* Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Recipients</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all" as const, label: "All customers" },
                { value: "has_upcoming" as const, label: "Has upcoming booking" },
                { value: "no_upcoming" as const, label: "No upcoming booking" },
                { value: "manual" as const, label: "Manual numbers" },
              ].map(f => (
                <Button
                  key={f.value}
                  variant={filter === f.value ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            {filter === "manual" && (
              <div className="mt-2 space-y-1">
                <Textarea
                  value={manualNumbers}
                  onChange={e => setManualNumbers(e.target.value)}
                  placeholder={"Enter phone numbers, one per line or comma-separated:\n07912345678\n+447912345678\n07987654321"}
                  className="min-h-[100px] resize-none font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  {manualNumberList.length} number{manualNumberList.length !== 1 ? "s" : ""} entered. UK mobile formats accepted (07..., +447..., 447...).
                </p>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="bg-muted/50 border rounded-lg p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                This will send {bulkSmsCount} SMS × {recipientCount} customers = ~{recipientCount * bulkSmsCount} messages
              </span>
            </div>
            {filter !== "manual" && (optOutCount > 0 || unreachableCount > 0) && (
              <p className="text-xs text-muted-foreground">
                {recipientCount} recipients — {optOutCount > 0 && `${optOutCount} excluded (SMS opt-out)`}{optOutCount > 0 && unreachableCount > 0 && ", "}{unreachableCount > 0 && `${unreachableCount} excluded (unreachable)`}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Estimated cost: £{estimatedCost} (at £0.04 per SMS segment)
            </p>
            {/https?:\/\//.test(bulkMessage) && (
              <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                <LinkIcon className="h-3 w-3" /> Links will be tracked automatically
              </p>
            )}
          </div>

          {/* Send */}
          <Button
            onClick={() => sendBulkMutation.mutate()}
            disabled={!bulkMessage.trim() || sendBulkMutation.isPending || recipientCount === 0}
            className="gap-1.5"
            size="lg"
          >
            {sendBulkMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
            ) : (
              <><Send className="h-4 w-4" /> Confirm &amp; Send Bulk SMS</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Best Campaign */}
      {bestCampaign && (
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm font-medium text-primary flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Best performing campaign: <span className="font-bold">{bestCampaign.name}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {bestCampaign.sent > 0 ? Math.round((bestCampaign.delivered / bestCampaign.sent) * 100) : 0}% delivery rate
            {bestCampaign.hasLink && bestCampaign.delivered > 0 && ` · ${Math.round((bestCampaign.clicks / bestCampaign.delivered) * 100)}% click rate`}
          </p>
        </div>
      )}

      {/* Campaign History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Bulk SMS Campaign Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !campaignHistory?.length ? (
            <p className="text-center text-muted-foreground py-8">No bulk SMS campaigns sent yet.</p>
          ) : (
            <div className="space-y-3">
              {campaignHistory.map(c => {
                const deliveryRate = c.sent > 0 ? Math.round((c.delivered / c.sent) * 100) : null;
                const clickRate = c.delivered > 0 && c.hasLink ? Math.round((c.clicks / c.delivered) * 100) : null;

                return (
                  <div key={c.name} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{c.message}</p>
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(c.date), "d MMM yyyy HH:mm")}
                      </p>
                    </div>

                    {/* Stats badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="gap-1 text-xs bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="h-3 w-3" /> {c.sent} sent
                      </Badge>
                      {c.delivered > 0 && (
                        <Badge variant="outline" className="gap-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> {c.delivered} delivered
                        </Badge>
                      )}
                      {c.undelivered > 0 && (
                        <Badge variant="outline" className="gap-1 text-xs bg-amber-50 text-amber-700 border-amber-200">
                          <AlertTriangle className="h-3 w-3" /> {c.undelivered} undelivered
                        </Badge>
                      )}
                      {c.failed > 0 && (
                        <Badge variant="outline" className="gap-1 text-xs bg-red-50 text-red-700 border-red-200">
                          <XCircle className="h-3 w-3" /> {c.failed} failed
                        </Badge>
                      )}
                      {c.hasLink && (
                        <Badge variant="outline" className="gap-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                          <LinkIcon className="h-3 w-3" /> {c.clicks} clicks
                        </Badge>
                      )}
                      {c.attributedBookings > 0 && (
                        <Badge variant="outline" className="gap-1 text-xs bg-purple-50 text-purple-700 border-purple-200">
                          <Target className="h-3 w-3" /> {c.attributedBookings} bookings · £{c.attributedRevenue.toFixed(0)}
                        </Badge>
                      )}
                    </div>

                    {/* Rate indicators */}
                    {(deliveryRate !== null || clickRate !== null) && (
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {deliveryRate !== null && (
                          <span>Delivery: <span className={`font-medium ${deliveryRate >= 90 ? "text-green-600" : deliveryRate >= 70 ? "text-amber-600" : "text-red-600"}`}>{deliveryRate}%</span></span>
                        )}
                        {clickRate !== null && (
                          <span>Click rate: <span className="font-medium text-blue-600">{clickRate}%</span></span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="outline" size="sm" className="text-xs h-6 gap-1" onClick={() => setViewDetailsCampaign(c.name)}>
                        <Eye className="h-3 w-3" /> View Details
                      </Button>
                      {c.failed > 0 && (
                        <>
                          <Button variant="ghost" size="sm" className="text-xs h-6 text-red-600" onClick={() => setViewFailedCampaign(c.name)}>
                            View Failed
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs h-6 gap-1" onClick={() => retryMutation.mutate(c.name)} disabled={retryMutation.isPending}>
                            {retryMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Retry Failed
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Details Dialog */}
      <Dialog open={!!viewDetailsCampaign} onOpenChange={() => setViewDetailsCampaign(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Campaign Details</DialogTitle>
          </DialogHeader>
          {detailsCampaign && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{detailsCampaign.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{detailsCampaign.message}</p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{detailsCampaign.sent}</p>
                  <p className="text-[10px] text-muted-foreground">Sent</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-emerald-600">{detailsCampaign.delivered}</p>
                  <p className="text-[10px] text-muted-foreground">Delivered</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-primary">
                    {detailsCampaign.sent > 0 ? Math.round((detailsCampaign.delivered / detailsCampaign.sent) * 100) : 0}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Delivery Rate</p>
                </div>
              </div>

              {detailsCampaign.hasLink && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-blue-600">{detailsCampaign.clicks}</p>
                    <p className="text-[10px] text-muted-foreground">Link Clicks</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-blue-600">
                      {detailsCampaign.delivered > 0 ? Math.round((detailsCampaign.clicks / detailsCampaign.delivered) * 100) : 0}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Click Rate</p>
                  </div>
                </div>
              )}

              {/* Booking Attribution */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-primary">{detailsCampaign.attributedBookings}</p>
                  <p className="text-[10px] text-muted-foreground">Bookings Attributed</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-primary">£{detailsCampaign.attributedRevenue.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">Revenue Attributed</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-primary">
                    {detailsCampaign.sent > 0 ? ((detailsCampaign.attributedBookings / detailsCampaign.sent) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Conversion Rate</p>
                </div>
              </div>

              {/* Undelivered numbers */}
              {detailsCampaign.undeliveredEntries.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2 text-amber-700">Undelivered Numbers ({detailsCampaign.undeliveredEntries.length})</p>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-1">
                      {detailsCampaign.undeliveredEntries.map((e, i) => (
                        <div key={i} className="text-xs flex justify-between border rounded px-2 py-1.5">
                          <span className="font-mono">{e.phone}</span>
                          {e.errorCode && <span className="text-muted-foreground">Error: {e.errorCode}</span>}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Failed Dialog */}
      <Dialog open={!!viewFailedCampaign} onOpenChange={() => setViewFailedCampaign(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Failed SMS Sends</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-2 pr-3">
              {failedCampaignEntries.map((f, i) => (
                <div key={i} className="border rounded-md p-3 space-y-1">
                  <p className="text-sm font-medium">{f.phone}</p>
                  <p className="text-xs text-muted-foreground">{f.error}</p>
                </div>
              ))}
              {!failedCampaignEntries.length && (
                <p className="text-muted-foreground text-center py-6">No failed sends found.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let phone = raw.trim().replace(/\s+/g, "").replace(/-/g, "");
  if (phone.startsWith("07")) phone = "+44" + phone.slice(1);
  else if (phone.startsWith("447")) phone = "+" + phone;
  else if (!phone.startsWith("+447")) return null;
  if (!/^\+44\d{10}$/.test(phone)) return null;
  if (!phone.startsWith("+447")) return null;
  return phone;
}

// ─── AUTOMATED REMINDERS LOG ────────────────────────────
function SmsRemindersLog() {
  const { data: reminderMessages, isLoading } = useQuery({
    queryKey: ["sms-reminder-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_messages")
        .select("*, bookings(customer_name, booking_date, booking_time, status)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).filter(m =>
        m.booking_id != null ||
        m.body.toLowerCase().includes("reminder") ||
        m.body.toLowerCase().includes("appt at fluff")
      );
    },
  });

  const reminders = reminderMessages?.filter(m =>
    m.body.toLowerCase().includes("reminder") || m.body.toLowerCase().includes("upcoming") || m.body.toLowerCase().includes("appt at fluff")
  ) || [];

  const sent24h = reminders.filter(m => m.body.toLowerCase().includes("tomorrow") || m.body.toLowerCase().includes("appt at fluff")).length;
  const sent2h = reminders.filter(m => m.body.toLowerCase().includes("2 hours")).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-500" /> Automated SMS Reminders
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{reminders.length}</p>
            <p className="text-xs text-muted-foreground">Total Sent</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{sent24h}</p>
            <p className="text-xs text-muted-foreground">24h Reminders</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{sent2h}</p>
            <p className="text-xs text-muted-foreground">2h Reminders</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !reminders.length ? (
          <div className="text-center py-8">
            <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No automated reminders sent yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Reminders run every 30 minutes for confirmed bookings with valid phone numbers.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {reminders.map(m => {
              const is24h = m.body.toLowerCase().includes("tomorrow") || m.body.toLowerCase().includes("appt at fluff");
              const booking = m.bookings as any;
              return (
                <div key={m.id} className="flex items-start gap-3 border rounded-lg p-3">
                  <div className={`p-1.5 rounded-full shrink-0 ${m.status === "sent" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                    {m.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-medium">{booking?.customer_name || m.phone_number}</p>
                      <Badge variant={is24h ? "default" : "secondary"} className="text-[10px]">
                        {is24h ? "24h Reminder" : "2h Reminder"}
                      </Badge>
                      <Badge variant={m.status === "sent" ? "outline" : "destructive"} className="text-[10px]">
                        {m.status}
                      </Badge>
                    </div>
                    {booking && (
                      <p className="text-xs text-muted-foreground">
                        Appt: {format(new Date(booking.booking_date), "d MMM yyyy")} at {booking.booking_time?.substring(0, 5)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{m.phone_number}</p>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(m.created_at), "d MMM yyyy HH:mm")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
