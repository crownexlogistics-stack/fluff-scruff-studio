import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MailOpen, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["customer-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_messages")
        .select("*, bookings(customer_name, dog_name, booking_date)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customer_messages")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-messages"] }),
  });

  const toggleExpand = (id: string, isRead: boolean) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!isRead) markRead.mutate(id);
    }
  };

  const unreadCount = messages?.filter(m => !m.is_read).length ?? 0;

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">Messages</h1>
            <p className="text-sm text-muted-foreground">
              Customer replies to booking emails
              {unreadCount > 0 && ` · ${unreadCount} unread`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : !messages?.length ? (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Customer replies to booking emails will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg: any) => (
              <Card
                key={msg.id}
                className={`cursor-pointer transition-colors ${!msg.is_read ? "border-primary/30 bg-primary/[0.02]" : ""}`}
                onClick={() => toggleExpand(msg.id, msg.is_read)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {msg.is_read ? (
                        <MailOpen className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Mail className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium truncate ${!msg.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                          {msg.from_name || msg.from_email}
                        </span>
                        {!msg.is_read && <Badge variant="default" className="text-xs px-1.5 py-0">New</Badge>}
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {format(new Date(msg.created_at), "dd MMM, HH:mm")}
                        </span>
                        {expandedId === msg.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <p className={`text-sm ${!msg.is_read ? "font-medium" : ""}`}>
                        {msg.subject || "(no subject)"}
                      </p>
                      {expandedId !== msg.id && msg.body && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {msg.body.slice(0, 120)}
                        </p>
                      )}
                      {expandedId === msg.id && (
                        <div className="mt-3 space-y-3 animate-fade-in">
                          <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">
                            {msg.body || "(empty message)"}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{msg.from_email}</span>
                            {msg.bookings && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {msg.bookings.customer_name} — {msg.bookings.dog_name} ({msg.bookings.booking_date})
                              </span>
                            )}
                          </div>
                          {!msg.is_read && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); markRead.mutate(msg.id); }}
                            >
                              Mark as read
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
