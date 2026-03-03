import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { MessageSquare, Send, Loader2, Phone, ArrowUpRight, ArrowDownLeft, Bell, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

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
              { label: "Follow Up", text: "Hi! Thank you for visiting Fluff & Scruff Studio. We hope your pup is looking fabulous! Ready to rebook? Call 01708 606655 or visit fluff-scruff-studio.lovable.app/book 🐾" },
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

function SmsRemindersLog() {
  const { data: reminderMessages, isLoading } = useQuery({
    queryKey: ["sms-reminder-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_messages")
        .select("*, bookings(customer_name, booking_date, booking_time, status)")
        .not("booking_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Separate automated reminders from manual SMS (reminders contain "reminder" in body)
  const reminders = reminderMessages?.filter(m =>
    m.body.toLowerCase().includes("reminder") || m.body.toLowerCase().includes("upcoming") || m.body.toLowerCase().includes("appt at fluff")
  ) || [];

  // Count stats
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
        {/* Stats */}
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
