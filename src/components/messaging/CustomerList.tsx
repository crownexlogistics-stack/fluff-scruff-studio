import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { useUnreadSmsCount } from "@/hooks/useUnreadSmsCount";
import type { CustomerContact } from "@/pages/MessagesPage";

interface CustomerListProps {
  customers: CustomerContact[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  className?: string;
}

function formatMessageDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd MMM");
}

export function CustomerList({ customers, selectedPhone, onSelect, className }: CustomerListProps) {
  const [search, setSearch] = useState("");
  const { unreadMap } = useUnreadSmsCount();

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.customer_name.toLowerCase().includes(q) ||
      c.customer_phone.includes(q) ||
      c.customer_email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className={cn("w-full md:w-80 border-r border-border flex flex-col bg-muted/30 md:shrink-0", className)}>
      <div className="p-3 border-b border-border">
        <h2 className="font-heading font-bold text-lg mb-2">Messages</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No customers found
          </div>
        ) : (
          filtered.map((c) => (
            <button
              key={c.customer_phone}
              className={cn(
                "w-full text-left px-3 py-3 border-b border-border/50 hover:bg-accent/50 transition-colors",
                selectedPhone === c.customer_phone && "bg-accent"
              )}
              onClick={() => onSelect(c.customer_phone)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn(
                  "font-medium text-sm truncate",
                  (unreadMap.get(c.customer_phone) || 0) > 0 && "font-bold"
                )}>
                  {c.customer_name}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(unreadMap.get(c.customer_phone) || 0) > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full">
                      {unreadMap.get(c.customer_phone)}
                    </Badge>
                  )}
                  {c.last_message_at && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatMessageDate(c.last_message_at)}
                    </span>
                  )}
                </div>
              </div>
              {c.last_message && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {c.last_message}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {c.customer_phone}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
