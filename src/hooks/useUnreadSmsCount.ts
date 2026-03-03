import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadSmsCount() {
  const queryClient = useQueryClient();

  const { data: unreadMap } = useQuery({
    queryKey: ["sms-unread-counts"],
    queryFn: async () => {
      const { data: inbound } = await supabase
        .from("sms_messages")
        .select("phone_number")
        .eq("direction", "inbound")
        .eq("is_read", false);

      const counts = new Map<string, number>();
      inbound?.forEach((m) => {
        counts.set(m.phone_number, (counts.get(m.phone_number) || 0) + 1);
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

/** Mark all inbound messages for a phone number as read */
export async function markConversationRead(phoneNumber: string) {
  await supabase
    .from("sms_messages")
    .update({ is_read: true })
    .eq("phone_number", phoneNumber)
    .eq("direction", "inbound")
    .eq("is_read", false);
}
