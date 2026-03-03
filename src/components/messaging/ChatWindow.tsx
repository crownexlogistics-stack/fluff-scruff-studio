import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare, ArrowLeft, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CustomerContact } from "@/pages/MessagesPage";

interface ChatWindowProps {
  customer: CustomerContact | null;
  templateText: string;
  onTemplateClear: () => void;
  pendingNoAnswer: boolean;
  onNoAnswerHandled: () => void;
  userId?: string;
  senderName?: string;
  className?: string;
  onBack?: () => void;
  onInfoToggle?: () => void;
}

export function ChatWindow({
  customer,
  templateText,
  onTemplateClear,
  pendingNoAnswer,
  onNoAnswerHandled,
  userId,
  senderName,
  className,
  onBack,
  onInfoToggle,
}: ChatWindowProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // When template text changes, populate the input
  useEffect(() => {
    if (templateText) {
      setMessage(templateText);
      onTemplateClear();
    }
  }, [templateText, onTemplateClear]);

  // Normalize phone to E.164 for DB lookups
  const normalizedPhone = (() => {
    if (!customer?.customer_phone) return null;
    const p = customer.customer_phone.trim();
    if (p.startsWith("+")) return p;
    if (p.startsWith("0")) return "+44" + p.slice(1);
    return "+44" + p;
  })();

  const { data: messages } = useQuery({
    queryKey: ["sms-messages", normalizedPhone],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_messages")
        .select("*")
        .eq("phone_number", normalizedPhone!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!normalizedPhone,
    refetchInterval: 5000,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !customer?.customer_phone) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-sms", {
        body: {
          phone: customer.customer_phone,
          body: message.trim(),
          senderName: senderName || "F&S Studio",
        },
      });
      if (error) throw error;

      // Handle "No Answer" workflow - add note to customer profile
      if (pendingNoAnswer && customer.customer_email && userId) {
        await supabase.from("customer_notes").insert({
          customer_email: customer.customer_email,
          created_by: userId,
          note: `Attempted call - no answer - SMS sent (${format(new Date(), "dd/MM/yyyy HH:mm")})`,
        });
        onNoAnswerHandled();
        queryClient.invalidateQueries({ queryKey: ["customer-notes-sidebar"] });
      }

      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["sms-messages"] });
      queryClient.invalidateQueries({ queryKey: ["sms-last-messages"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-sms-last-messages"] });
      toast.success("Message sent");
    } catch (e: any) {
      toast.error(e.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (!customer) {
    return (
      <div className={cn("flex-1 flex items-center justify-center bg-muted/10 hidden md:flex", className)}>
        <div className="text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a customer to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 flex flex-col min-w-0", className)}>
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center px-3 gap-2 shrink-0 bg-background">
        {onBack && (
          <Button variant="ghost" size="icon" className="shrink-0 md:hidden h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{customer.customer_name}</p>
          <p className="text-xs text-muted-foreground">{customer.customer_phone}</p>
        </div>
        {onInfoToggle && (
          <Button variant="ghost" size="icon" className="shrink-0 md:hidden h-8 w-8" onClick={onInfoToggle}>
            <Info className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages - outbound only */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5">
        {!messages?.length ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Send the first message below.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] md:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-sm bg-primary text-primary-foreground rounded-br-md">
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-primary-foreground/60">
                  <span>{(m as any).sent_by_name || "F&S Studio"}</span>
                  <span>·</span>
                  <span>{format(new Date(m.created_at), "dd MMM, HH:mm")}</span>
                  {m.status === "failed" && (
                    <span className="text-destructive font-medium">· Failed</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0 bg-background">
        {pendingNoAnswer && (
          <div className="text-[10px] text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1">
            <span className="font-medium">⚠ "No Answer" mode</span>
            <span>— a note will be added to the customer profile when sent</span>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="min-h-[2.5rem] max-h-32 resize-none"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="shrink-0 self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Note: Customers cannot reply to these branded notifications.
        </p>
      </div>
    </div>
  );
}
