import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MailOpen, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface GroomerMessagesTabProps {
  staffId: string;
}

export function GroomerMessagesTab({ staffId }: GroomerMessagesTabProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["groomer-messages", staffId],
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
      // Groomers can't update messages per RLS, but let's try
      // If RLS blocks it, we just skip
      await supabase.from("customer_messages").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groomer-messages"] }),
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
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Messages from your customers
          {unreadCount > 0 && ` · ${unreadCount} unread`}
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
      ) : !messages?.length ? (
        <div className="text-center py-12">
          <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No messages yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg: any) => (
            <Card
              key={msg.id}
              className={`cursor-pointer transition-colors ${!msg.is_read ? "border-primary/30 bg-primary/[0.02]" : ""}`}
              onClick={() => toggleExpand(msg.id, msg.is_read)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {msg.is_read ? (
                      <MailOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Mail className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm font-medium truncate ${!msg.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                        {msg.from_name || msg.from_email}
                      </span>
                      {!msg.is_read && <Badge variant="default" className="text-[10px] px-1 py-0">New</Badge>}
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {format(new Date(msg.created_at), "dd MMM, HH:mm")}
                      </span>
                      {expandedId === msg.id ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <p className={`text-xs ${!msg.is_read ? "font-medium" : ""}`}>
                      {msg.subject || "(no subject)"}
                    </p>
                    {expandedId !== msg.id && msg.body && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{msg.body.slice(0, 100)}</p>
                    )}
                    {expandedId === msg.id && (
                      <div className="mt-2 space-y-2 animate-fade-in">
                        <div className="text-xs whitespace-pre-wrap bg-muted/50 rounded-lg p-2">{msg.body || "(empty)"}</div>
                        {msg.bookings && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="h-2.5 w-2.5" />
                            {msg.bookings.customer_name} — {msg.bookings.dog_name} ({msg.bookings.booking_date})
                          </div>
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
  );
}
