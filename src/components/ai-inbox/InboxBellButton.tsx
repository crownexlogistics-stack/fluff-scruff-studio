import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Notification {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  case_id: string | null;
}

export function InboxBellButton() {
  const { staff } = useCurrentStaff();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = async () => {
    if (!staff?.id) return;
    const { data } = await supabase
      .from("ai_inbox_notifications")
      .select("id, message, is_read, created_at, case_id")
      .eq("staff_id", staff.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications((data as Notification[]) || []);
  };

  useEffect(() => {
    if (!staff?.id) return;
    load();
    const channel = supabase
      .channel(`ai_inbox_notif_${staff.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_inbox_notifications", filter: `staff_id=eq.${staff.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [staff?.id]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = async (id: string) => {
    await supabase.from("ai_inbox_notifications").update({ is_read: true }).eq("id", id);
    load();
  };

  const markAllRead = async () => {
    if (!staff?.id) return;
    await supabase
      .from("ai_inbox_notifications")
      .update({ is_read: true })
      .eq("staff_id", staff.id)
      .eq("is_read", false);
    load();
  };

  if (!staff) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                markRead(n.id);
                navigate("/ai-inbox");
              }}
              className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-accent/50 ${
                !n.is_read ? "bg-accent/20" : ""
              }`}
            >
              <p className="text-sm leading-snug">{n.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(n.created_at).toLocaleString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "short",
                })}
              </p>
            </button>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}