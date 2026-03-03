import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, User, FileText, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { CustomerContact } from "@/pages/MessagesPage";

const quickTemplates = [
  {
    label: "No answer on call",
    text: "Hi, we tried to reach you by phone but couldn't get through. Please call us back at 01708 606655 when you get a chance. Thank you!",
    isNoAnswer: true,
    variant: "destructive" as const,
  },
  {
    label: "Running late",
    text: "Hi, just to let you know we're running slightly behind schedule today. We'll have your pup ready as soon as possible. Thank you for your patience!",
  },
  {
    label: "Ready for collection",
    text: "Great news! Your pup is all groomed and ready for collection. We look forward to seeing you soon!",
  },
  {
    label: "Booking reminder",
    text: "Just a friendly reminder about your upcoming appointment with Fluff & Scruff Studio. We look forward to seeing you and your pup!",
  },
  {
    label: "Thank you",
    text: "Thank you for visiting Fluff & Scruff Studio today! We hope you and your pup are happy with the groom. See you next time!",
  },
];

interface CustomerSidebarProps {
  customer: CustomerContact | null;
  onTemplateSelect: (text: string, isNoAnswer?: boolean) => void;
}

export function CustomerSidebar({ customer, onTemplateSelect }: CustomerSidebarProps) {
  // Customer notes
  const { data: notes } = useQuery({
    queryKey: ["customer-notes-sidebar", customer?.customer_email],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_notes")
        .select("*")
        .eq("customer_email", customer!.customer_email!)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!customer?.customer_email,
  });

  // Recent bookings
  const { data: bookings } = useQuery({
    queryKey: ["customer-bookings-sidebar", customer?.customer_phone],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("booking_date, booking_time, dog_name, status, staff(name)")
        .eq("customer_phone", customer!.customer_phone)
        .order("booking_date", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!customer?.customer_phone,
  });

  if (!customer) {
    return (
      <div className="w-72 border-l border-border bg-muted/20 flex items-center justify-center shrink-0">
        <p className="text-xs text-muted-foreground">Select a customer</p>
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-border bg-muted/20 flex flex-col overflow-hidden shrink-0">
      {/* Customer Info */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{customer.customer_name}</p>
          </div>
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{customer.customer_phone}</span>
          </div>
          {customer.customer_email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{customer.customer_email}</span>
            </div>
          )}
        </div>

        {/* Recent bookings */}
        {bookings && bookings.length > 0 && (
          <div className="pt-2 space-y-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Recent Bookings
            </span>
            {bookings.map((b: any, i: number) => (
              <div key={i} className="text-[11px] flex items-center justify-between">
                <span>
                  {format(new Date(b.booking_date), "dd MMM")} · {b.dog_name}
                </span>
                <Badge
                  variant={b.status === "Confirmed" ? "default" : "secondary"}
                  className="text-[9px] px-1 py-0"
                >
                  {b.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="p-3 border-b border-border flex-1 overflow-y-auto min-h-0">
        <div className="flex items-center gap-1.5 mb-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Recent Notes</span>
        </div>
        {!notes?.length ? (
          <p className="text-[10px] text-muted-foreground italic">No notes yet</p>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="text-[11px] bg-background rounded-lg p-2 border border-border/50">
                <p className="leading-relaxed">{n.note}</p>
                <p className="text-muted-foreground mt-1">
                  {format(new Date(n.created_at), "dd MMM, HH:mm")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Response Templates */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Quick Responses</span>
        </div>
        <div className="space-y-1.5">
          {quickTemplates.map((t) => (
            <Button
              key={t.label}
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs h-auto py-1.5 px-2.5"
              onClick={() => onTemplateSelect(t.text, t.isNoAnswer)}
            >
              {t.isNoAnswer && (
                <Badge variant="destructive" className="text-[9px] px-1 py-0 mr-1.5">
                  !
                </Badge>
              )}
              {t.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
