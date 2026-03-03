import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CustomerList } from "@/components/messaging/CustomerList";
import { ChatWindow } from "@/components/messaging/ChatWindow";
import { CustomerSidebar } from "@/components/messaging/CustomerSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CustomerContact } from "@/pages/MessagesPage";

interface GroomerMessagesTabProps {
  staffId: string;
}

type MobilePanel = "list" | "chat" | "info";

export function GroomerMessagesTab({ staffId }: GroomerMessagesTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [templateText, setTemplateText] = useState("");
  const [pendingNoAnswer, setPendingNoAnswer] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("list");

  const { data: staffRecord } = useQuery({
    queryKey: ["staff-name", staffId],
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("name").eq("id", staffId).maybeSingle();
      return data;
    },
    enabled: !!staffId,
  });

  // Customers from groomer's bookings only
  const { data: rawCustomers } = useQuery({
    queryKey: ["groomer-msg-customers", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("customer_name, customer_phone, customer_email")
        .eq("staff_id", staffId)
        .not("customer_phone", "is", null)
        .order("booking_date", { ascending: false });
      if (error) throw error;

      const map = new Map<string, CustomerContact>();
      data?.forEach((b) => {
        if (b.customer_phone && !map.has(b.customer_phone)) {
          map.set(b.customer_phone, {
            customer_name: b.customer_name,
            customer_phone: b.customer_phone,
            customer_email: b.customer_email,
          });
        }
      });
      return Array.from(map.values());
    },
    enabled: !!staffId,
  });

  // Last messages per phone
  const { data: lastMsgMap } = useQuery({
    queryKey: ["groomer-sms-last-messages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sms_messages")
        .select("phone_number, body, created_at")
        .order("created_at", { ascending: false });

      const map = new Map<string, { body: string; created_at: string }>();
      data?.forEach((m) => {
        if (!map.has(m.phone_number)) {
          map.set(m.phone_number, { body: m.body, created_at: m.created_at });
        }
      });
      return map;
    },
  });

  const normalizePhone = useCallback((p: string) => {
    const t = p.trim();
    if (t.startsWith("+")) return t;
    if (t.startsWith("0")) return "+44" + t.slice(1);
    return "+44" + t;
  }, []);

  const customers = useMemo(() => {
    if (!rawCustomers) return [];
    return rawCustomers
      .map((c) => ({
        ...c,
        last_message: lastMsgMap?.get(normalizePhone(c.customer_phone))?.body,
        last_message_at: lastMsgMap?.get(normalizePhone(c.customer_phone))?.created_at,
      }))
      .sort((a, b) => {
        if (a.last_message_at && b.last_message_at)
          return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
        if (a.last_message_at) return -1;
        if (b.last_message_at) return 1;
        return a.customer_name.localeCompare(b.customer_name);
      });
  }, [rawCustomers, lastMsgMap, normalizePhone]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("groomer-sms-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sms_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["sms-messages"] });
          queryClient.invalidateQueries({ queryKey: ["groomer-sms-last-messages"] });
          queryClient.invalidateQueries({ queryKey: ["sms-unread-counts"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const selected = customers.find((c) => c.customer_phone === selectedPhone) || null;

  const handleSelect = (phone: string) => {
    setSelectedPhone(phone);
    if (isMobile) setMobilePanel("chat");
  };

  const handleTemplateSelect = (text: string, isNoAnswer?: boolean) => {
    setTemplateText(text);
    setPendingNoAnswer(!!isNoAnswer);
    if (isMobile) setMobilePanel("chat");
  };

  return (
    <div className="h-[calc(100vh-14rem)] md:h-[calc(100vh-14rem)] flex border border-border rounded-lg overflow-hidden">
      {(!isMobile || mobilePanel === "list") && (
        <CustomerList
          customers={customers}
          selectedPhone={selectedPhone}
          onSelect={handleSelect}
        />
      )}
      {(!isMobile || mobilePanel === "chat") && (
        <ChatWindow
          customer={selected}
          templateText={templateText}
          onTemplateClear={() => setTemplateText("")}
          pendingNoAnswer={pendingNoAnswer}
          onNoAnswerHandled={() => setPendingNoAnswer(false)}
          userId={user?.id}
          senderName={staffRecord?.name || undefined}
          onBack={() => setMobilePanel("list")}
          onInfoToggle={() => setMobilePanel("info")}
        />
      )}
      {(!isMobile || mobilePanel === "info") && (
        <CustomerSidebar
          customer={selected}
          onTemplateSelect={handleTemplateSelect}
          onBack={() => setMobilePanel("chat")}
        />
      )}
    </div>
  );
}
