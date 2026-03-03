import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { CustomerList } from "@/components/messaging/CustomerList";
import { ChatWindow } from "@/components/messaging/ChatWindow";
import { CustomerSidebar } from "@/components/messaging/CustomerSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export interface CustomerContact {
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  last_message?: string;
  last_message_at?: string;
}

type MobilePanel = "list" | "chat" | "info";

export default function MessagesPage() {
  const { user } = useAuth();
  const { role } = useUserRole(user?.id);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [templateText, setTemplateText] = useState("");
  const [pendingNoAnswer, setPendingNoAnswer] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("list");

  // Groomer's staff record
  const { data: myStaff } = useQuery({
    queryKey: ["my-staff-record", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff")
        .select("id")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && role === "groomer",
  });

  // Customer list from bookings
  const { data: rawCustomers } = useQuery({
    queryKey: ["msg-customers", role, myStaff?.id],
    queryFn: async () => {
      let query = supabase
        .from("bookings")
        .select("customer_name, customer_phone, customer_email")
        .not("customer_phone", "is", null)
        .order("booking_date", { ascending: false });

      if (role === "groomer" && myStaff?.id) {
        query = query.eq("staff_id", myStaff.id);
      }

      const { data, error } = await query;
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
    enabled: !!role && (role !== "groomer" || !!myStaff?.id),
  });

  // Last messages per phone for list preview
  const { data: lastMsgMap } = useQuery({
    queryKey: ["sms-last-messages"],
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

  // Enrich and sort customers
  const customers = useMemo(() => {
    if (!rawCustomers) return [];
    return rawCustomers
      .map((c) => ({
        ...c,
        last_message: lastMsgMap?.get(c.customer_phone)?.body,
        last_message_at: lastMsgMap?.get(c.customer_phone)?.created_at,
      }))
      .sort((a, b) => {
        if (a.last_message_at && b.last_message_at)
          return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
        if (a.last_message_at) return -1;
        if (b.last_message_at) return 1;
        return a.customer_name.localeCompare(b.customer_name);
      });
  }, [rawCustomers, lastMsgMap]);

  // Real-time subscription for SMS messages
  useEffect(() => {
    const channel = supabase
      .channel("sms-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sms_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["sms-messages"] });
          queryClient.invalidateQueries({ queryKey: ["sms-last-messages"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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
    <AppLayout>
      <div className="-m-4 md:-m-6 h-[calc(100vh-3.5rem)] flex overflow-hidden">
        {/* Customer List - show on desktop always, on mobile only when panel=list */}
        {(!isMobile || mobilePanel === "list") && (
          <CustomerList
            customers={customers}
            selectedPhone={selectedPhone}
            onSelect={handleSelect}
          />
        )}

        {/* Chat Window - show on desktop always, on mobile only when panel=chat */}
        {(!isMobile || mobilePanel === "chat") && (
          <ChatWindow
            customer={selected}
            templateText={templateText}
            onTemplateClear={() => setTemplateText("")}
            pendingNoAnswer={pendingNoAnswer}
            onNoAnswerHandled={() => setPendingNoAnswer(false)}
            userId={user?.id}
            onBack={() => setMobilePanel("list")}
            onInfoToggle={() => setMobilePanel("info")}
          />
        )}

        {/* Customer Sidebar - show on desktop always, on mobile only when panel=info */}
        {(!isMobile || mobilePanel === "info") && (
          <CustomerSidebar
            customer={selected}
            onTemplateSelect={handleTemplateSelect}
            onBack={() => setMobilePanel("chat")}
          />
        )}
      </div>
    </AppLayout>
  );
}
