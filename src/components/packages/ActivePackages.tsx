import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Package, Eye, Loader2, FileCheck, Clock } from "lucide-react";
import { format } from "date-fns";
import { PackageDetailDialog } from "./PackageDetailDialog";

export function ActivePackages() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: packageBookings, isLoading, refetch } = useQuery({
    queryKey: ["package-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_bookings" as any)
        .select("*, packages(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: nextSessions } = useQuery({
    queryKey: ["package-next-sessions"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("package_sessions" as any)
        .select("package_booking_id, scheduled_date, scheduled_time, session_number")
        .gte("scheduled_date", today)
        .in("status", ["scheduled"])
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!packageBookings?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No package bookings yet</p>
        </CardContent>
      </Card>
    );
  }

  const getNextSession = (pbId: string) => {
    return nextSessions?.find((s: any) => s.package_booking_id === pbId);
  };

  const statusColor = (status: string) => {
    if (status === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (status === "completed") return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <>
      <div className="grid gap-4">
        {packageBookings.map((pb: any) => {
          const used = pb.sessions_used || 0;
          const total = pb.sessions_total || 1;
          const pct = Math.round((used / total) * 100);
          const next = getNextSession(pb.id);
          const pkg = pb.packages;

          return (
            <Card key={pb.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{pb.customer_name}</span>
                    {pb.dog_name && (
                      <span className="text-muted-foreground">— {pb.dog_name}</span>
                    )}
                    <Badge className={statusColor(pb.status)}>
                      {pb.status === "active" ? "Active" : pb.status === "completed" ? "Completed" : "Cancelled"}
                    </Badge>
                    {pb.tc_signed ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        <FileCheck className="h-3 w-3 mr-1" /> T&C Signed
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                        <Clock className="h-3 w-3 mr-1" /> Awaiting Signature
                      </Badge>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    📦 {pkg?.name || "Package"} • {used} of {total} sessions used
                  </div>

                  <div className="flex items-center gap-3">
                    <Progress value={pct} className="h-2 flex-1 max-w-xs" />
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>

                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Paid: £{Number(pb.total_paid).toFixed(2)}</span>
                    {next && (
                      <span>Next: {format(new Date(next.scheduled_date), "dd MMM yyyy")}</span>
                    )}
                  </div>
                </div>

                <Button variant="outline" size="sm" onClick={() => setSelectedId(pb.id)}>
                  <Eye className="h-4 w-4 mr-1" /> View Details
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedId && (
        <PackageDetailDialog
          packageBookingId={selectedId}
          open={!!selectedId}
          onClose={() => { setSelectedId(null); refetch(); }}
        />
      )}
    </>
  );
}
