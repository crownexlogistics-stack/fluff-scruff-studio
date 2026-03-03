import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadSmsCount() {
  const queryClient = useQueryClient();

  const { data: unreadMap } = useQuery({
    queryKey: ["sms-unread-counts"],
    queryFn: async () => {
      // Get all inbound messages that have no outbound reply after them
      const { data: inbound } = await supabase
        .from("sms_messages")
        .select("phone_number, created_at")
        .eq("direction", "inbound")
        .order("created_at", { ascending: false });

      const { data: outbound } = await supabase
        .from("sms_messages")
        .select("phone_number, created_at")
        .eq("direction", "outbound")
        .order("created_at", { ascending: false });

      // Build map of last outbound per phone
      const lastOutbound = new Map<string, string>();
      outbound?.forEach((m) => {
        if (!lastOutbound.has(m.phone_number)) {
          lastOutbound.set(m.phone_number, m.created_at);
        }
      });

      // Count inbound messages after last outbound per phone
      const counts = new Map<string, number>();
      inbound?.forEach((m) => {
        const lastOut = lastOutbound.get(m.phone_number);
        if (!lastOut || new Date(m.created_at) > new Date(lastOut)) {
          counts.set(m.phone_number, (counts.get(m.phone_number) || 0) + 1);
        }
      });

      return counts;
    },
    refetchInterval: 10000,
  });

  // Realtime refresh
  useEffect(() => {
    const channel = supabase
      .channel("sms-unread-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sms_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["sms-unread-counts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const totalUnread = unreadMap ? Array.from(unreadMap.values()).reduce((a, b) => a + b, 0) : 0;

  return { unreadMap: unreadMap || new Map<string, number>(), totalUnread };
}
