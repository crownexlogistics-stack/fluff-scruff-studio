import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import { useMigratedBookings } from "@/hooks/useMigratedBookings";

interface TodayPrepNotesProps {
  staffId: string;
}

export function TodayPrepNotes({ staffId }: TodayPrepNotesProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: migratedBookings = [] } = useMigratedBookings(staffId);

  const { data: appointments = [] } = useQuery({
    queryKey: ["groomer-prep-notes", staffId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, booking_time, customer_name, customer_email, dog_name, breed_id, breeds(name), services:service_id(name), status")
        .eq("staff_id", staffId)
        .eq("booking_date", today)
        .not("status", "in", '("Cancelled","No Show")')
        .order("booking_time");
      if (error) throw error;
      return data as any[];
    },
  });

  // Build migrated visit counts by email
  const migratedCounts = new Map<string, number>();
  for (const mb of migratedBookings) {
    const email = ((mb as any).migrated_customers?.email || "").toLowerCase();
    if (email) {
      migratedCounts.set(email, (migratedCounts.get(email) || 0) + 1);
    }
  }

  // Get visit counts and last visit for each customer (including migrated)
  const { data: visitData = {} } = useQuery({
    queryKey: ["groomer-visit-counts", staffId, appointments.map(a => a.customer_email).join(","), migratedBookings.length],
    queryFn: async () => {
      const emails = [...new Set(appointments.map(a => a.customer_email).filter(Boolean))];
      if (emails.length === 0) return {};
      
      const result: Record<string, { count: number; lastVisit: string | null }> = {};
      
      for (const email of emails) {
        const { data, error } = await supabase
          .from("bookings")
          .select("booking_date")
          .eq("staff_id", staffId)
          .eq("customer_email", email)
          .eq("status", "Completed")
          .order("booking_date", { ascending: false })
          .limit(50);
        
        if (!error && data) {
          const migratedCount = migratedCounts.get(email.toLowerCase()) || 0;
          
          // Find last migrated visit for this customer
          let lastMigratedDate: string | null = null;
          for (const mb of migratedBookings) {
            const mc = (mb as any).migrated_customers;
            if (mc?.email?.toLowerCase() === email.toLowerCase()) {
              if (!lastMigratedDate || mb.booking_date > lastMigratedDate) {
                lastMigratedDate = mb.booking_date;
              }
            }
          }

          const lastBookingDate = data.length > 0 ? data[0].booking_date : null;
          let lastVisit = lastBookingDate;
          if (lastMigratedDate && (!lastVisit || lastMigratedDate > lastVisit)) {
            lastVisit = lastMigratedDate;
          }

          result[email] = {
            count: data.length + migratedCount,
            lastVisit,
          };
        }
      }
      return result;
    },
    enabled: appointments.length > 0,
  });

  // Get customer notes
  const { data: notesData = {} } = useQuery({
    queryKey: ["groomer-customer-notes", appointments.map(a => a.customer_email).join(",")],
    queryFn: async () => {
      const emails = [...new Set(appointments.map(a => a.customer_email).filter(Boolean))];
      if (emails.length === 0) return {};
      
      const result: Record<string, any[]> = {};
      
      for (const email of emails) {
        const { data } = await supabase
          .from("customer_notes")
          .select("note, created_at")
          .eq("customer_email", email)
          .order("created_at", { ascending: false })
          .limit(3);
        if (data) result[email] = data;
      }
      return result;
    },
    enabled: appointments.length > 0,
  });

  if (appointments.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          🗒️ Today's Dogs — Be Prepared
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {appointments.map((apt) => {
          const email = apt.customer_email;
          const visit = visitData[email];
          const notes = notesData[email] || [];
          const visitCount = visit ? visit.count + 1 : 1; // +1 for today

          return (
            <div key={apt.id} className="rounded-xl border border-border p-4 space-y-2 bg-card/50">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">{apt.booking_time?.slice(0, 5)}</Badge>
                    <span className="font-semibold text-sm text-foreground">{apt.customer_name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    🐕 {apt.dog_name}
                    {apt.breeds?.name && <span className="text-muted-foreground/70"> ({apt.breeds.name})</span>}
                  </p>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                  {apt.dog_name}'s {visitCount === 1 ? "1st" : visitCount === 2 ? "2nd" : visitCount === 3 ? "3rd" : `${visitCount}th`} visit
                </Badge>
              </div>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>📋 {(apt as any).services?.name || "Service TBC"}</span>
                {visit?.lastVisit && (
                  <span>📅 Last visit: {format(new Date(visit.lastVisit + "T00:00:00"), "d MMM yyyy")}</span>
                )}
              </div>

              {notes.length > 0 ? (
                <div className="bg-muted/50 rounded-lg p-2.5 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notes</p>
                  {notes.map((n: any, i: number) => (
                    <p key={i} className="text-xs text-foreground/80 leading-relaxed">
                      {n.note}
                      <span className="text-muted-foreground/60 ml-1 text-[10px]">
                        ({format(new Date(n.created_at), "d MMM")})
                      </span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">No notes yet — first time with you or new dog</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
