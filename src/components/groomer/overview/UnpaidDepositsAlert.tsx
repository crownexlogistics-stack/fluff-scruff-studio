import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

interface UnpaidDepositsAlertProps {
  staffId: string;
}

export function UnpaidDepositsAlert({ staffId }: UnpaidDepositsAlertProps) {
  const queryClient = useQueryClient();
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: unpaidBookings = [] } = useQuery({
    queryKey: ["groomer-unpaid-deposits", staffId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, customer_name, customer_email, customer_phone, dog_name, booking_date, booking_time, total_price, deposit_paid, deposit_link_sent_at, services:service_id(name)")
        .eq("staff_id", staffId)
        .in("status", ["Confirmed", "Pending"])
        .gte("booking_date", today)
        .is("deposit_link_sent_at", null)
        .order("booking_date", { ascending: true });
      if (error) throw error;

      // Filter client-side: deposit_paid = 0 or null, no package_booking
      return (data as any[]).filter(b => {
        const dep = Number(b.deposit_paid) || 0;
        return dep === 0;
      });
    },
  });

  // Also fetch ones where link was already sent (to show "sent" state)
  const { data: sentBookings = [] } = useQuery({
    queryKey: ["groomer-sent-deposits", staffId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, customer_name, customer_email, customer_phone, dog_name, booking_date, booking_time, total_price, deposit_paid, deposit_link_sent_at, services:service_id(name)")
        .eq("staff_id", staffId)
        .in("status", ["Confirmed", "Pending"])
        .gte("booking_date", today)
        .not("deposit_link_sent_at", "is", null)
        .order("booking_date", { ascending: true });
      if (error) throw error;
      return (data as any[]).filter(b => (Number(b.deposit_paid) || 0) === 0);
    },
  });

  const allUnpaid = [...unpaidBookings, ...sentBookings];

  const handleSendDepositLink = async (booking: any) => {
    setSendingIds(prev => new Set(prev).add(booking.id));
    try {
      const { data, error } = await supabase.functions.invoke("send-payment-link", {
        body: { booking_id: booking.id, send_via: booking.customer_email ? "email" : "sms" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Mark deposit_link_sent_at
      await supabase
        .from("bookings")
        .update({ deposit_link_sent_at: new Date().toISOString() } as any)
        .eq("id", booking.id);

      toast.success(`Deposit link sent to ${booking.customer_name} ✅`);
      queryClient.invalidateQueries({ queryKey: ["groomer-unpaid-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-sent-deposits"] });
    } catch (e: any) {
      toast.error("Failed to send: " + e.message);
    } finally {
      setSendingIds(prev => {
        const next = new Set(prev);
        next.delete(booking.id);
        return next;
      });
    }
  };

  if (allUnpaid.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 font-medium">✅ All upcoming bookings have deposits — great work!</p>
        </CardContent>
      </Card>
    );
  }

  const totalAtRisk = allUnpaid.reduce((sum, b) => sum + (Number(b.total_price) || 0) * 0.5, 0);

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-heading flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          🚨 Action Needed — Deposits Not Collected
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          You have <span className="font-bold text-foreground">{allUnpaid.length}</span> bookings with no deposit — 
          collecting these protects <span className="font-bold text-destructive">£{totalAtRisk.toFixed(2)}</span> of your potential earnings
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {allUnpaid.map((b) => {
          const daysUntil = differenceInDays(new Date(b.booking_date + "T00:00:00"), new Date());
          const isUrgent = daysUntil < 2;
          const isSent = !!b.deposit_link_sent_at;
          const expectedDeposit = (Number(b.total_price) || 0) * 0.5;
          const serviceName = b.services?.name || "Grooming";

          return (
            <div
              key={b.id}
              className="rounded-xl border bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-3"
              style={{ borderLeftWidth: 4, borderLeftColor: isUrgent ? "hsl(var(--destructive))" : "hsl(25, 95%, 53%)" }}
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="font-semibold text-sm text-foreground">{b.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  🐕 {b.dog_name} · {serviceName}
                </p>
                <p className="text-xs text-muted-foreground">
                  📅 {format(new Date(b.booking_date + "T00:00:00"), "EEE d MMM")} at {b.booking_time?.slice(0, 5)}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium">
                    Total: £{Number(b.total_price).toFixed(2)} · Deposit expected: £{expectedDeposit.toFixed(2)}
                  </span>
                  {isUrgent && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {daysUntil === 0 ? "TODAY" : daysUntil === 1 ? "TOMORROW" : `in ${daysUntil} days`}
                    </Badge>
                  )}
                  {!isUrgent && daysUntil >= 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      in {daysUntil} days
                    </Badge>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {isSent ? (
                  <div className="text-center">
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Link Sent
                    </Badge>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      {format(new Date(b.deposit_link_sent_at), "d MMM HH:mm")}
                    </p>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={sendingIds.has(b.id)}
                    onClick={() => handleSendDepositLink(b)}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sendingIds.has(b.id) ? "Sending…" : "Send Deposit Link"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
