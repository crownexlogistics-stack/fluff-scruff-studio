import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, Crown } from "lucide-react";

const PRIORITY_OPTIONS = [
  { value: "1", label: "1st Priority", emoji: "🥇" },
  { value: "2", label: "2nd Priority", emoji: "🥈" },
  { value: "3", label: "3rd Priority", emoji: "🥉" },
  { value: "4", label: "4th Priority", emoji: "4️⃣" },
  { value: "none", label: "No Priority", emoji: "" },
  { value: "block", label: "No New Bookings", emoji: "🚫" },
];

function getPriorityBadge(priority: number | null, blocked?: boolean) {
  if (blocked) return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 text-xs">🚫 No New Bookings</Badge>;
  if (priority === 1) return <Badge className="bg-amber-400 text-amber-900 hover:bg-amber-400 text-xs">🥇 1st</Badge>;
  if (priority === 2) return <Badge className="bg-gray-300 text-gray-800 hover:bg-gray-300 text-xs">🥈 2nd</Badge>;
  if (priority === 3) return <Badge className="bg-amber-600 text-white hover:bg-amber-600 text-xs">🥉 3rd</Badge>;
  if (priority === 4) return <Badge variant="secondary" className="text-xs">4️⃣ 4th</Badge>;
  return <Badge variant="outline" className="text-xs text-muted-foreground">No Priority</Badge>;
}

const BookingPriorityPage = () => {
  const queryClient = useQueryClient();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const { data: groomers = [], isLoading } = useQuery({
    queryKey: ["staff-priority"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, name, role, booking_priority, is_accepting_bookings, block_new_bookings")
        .ilike("role", "%groomer%")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; role: string; booking_priority: number | null; is_accepting_bookings: boolean; block_new_bookings: boolean }[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase
        .from("staff")
        .update({ [field]: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["staff-priority"] });
      setSavedIds(prev => new Set(prev).add(variables.id));
      setTimeout(() => {
        setSavedIds(prev => {
          const next = new Set(prev);
          next.delete(variables.id);
          return next;
        });
      }, 2000);
    },
  });

  const handlePriorityChange = (staffId: string, value: string) => {
    const priority = value === "none" ? null : parseInt(value);
    updateMutation.mutate({ id: staffId, field: "booking_priority", value: priority });
  };

  const handleAcceptingChange = (staffId: string, checked: boolean) => {
    updateMutation.mutate({ id: staffId, field: "is_accepting_bookings", value: checked });
  };

  // Build priority order preview
  const sortedByPriority = [...groomers]
    .filter(g => g.is_accepting_bookings)
    .sort((a, b) => {
      const pa = a.booking_priority ?? 999;
      const pb = b.booking_priority ?? 999;
      return pa - pb;
    });

  const prioritised = sortedByPriority.filter(g => g.booking_priority != null);
  const noPriority = sortedByPriority.filter(g => g.booking_priority == null);
  const notAccepting = groomers.filter(g => !g.is_accepting_bookings);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-heading text-foreground flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            Booking Priority Order
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set which groomers are assigned first when customers book with "No preference"
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Groomer cards */}
            <div className="space-y-3">
              {groomers.map((groomer) => (
                <Card key={groomer.id} className={!groomer.is_accepting_bookings ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Initials avatar */}
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                        {groomer.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>

                      {/* Name + saved indicator */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{groomer.name}</p>
                          {savedIds.has(groomer.id) && (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5 animate-in fade-in">
                              <Check className="h-3 w-3" /> Saved
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {getPriorityBadge(groomer.booking_priority)}
                        </div>
                      </div>

                      {/* Priority dropdown */}
                      <Select
                        value={groomer.booking_priority != null ? String(groomer.booking_priority) : "none"}
                        onValueChange={(v) => handlePriorityChange(groomer.id, v)}
                      >
                        <SelectTrigger className="w-[140px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.emoji} {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Accepting toggle */}
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={groomer.is_accepting_bookings}
                          onCheckedChange={(checked) => handleAcceptingChange(groomer.id, checked)}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {groomer.is_accepting_bookings ? "Active" : "Off"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Live preview */}
            <Card className="bg-muted/50">
              <CardContent className="p-5">
                <h3 className="font-heading text-sm font-semibold text-foreground mb-3">Current Booking Order</h3>
                <div className="space-y-2">
                  {prioritised.map((g, i) => (
                    <div key={g.id} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground w-8">
                        {g.booking_priority === 1 ? "🥇" : g.booking_priority === 2 ? "🥈" : g.booking_priority === 3 ? "🥉" : `${g.booking_priority}th`}
                      </span>
                      <span className="text-foreground font-medium">{g.name}</span>
                    </div>
                  ))}
                  {noPriority.length > 0 && (
                    <div className="border-t border-border pt-2 mt-2">
                      <p className="text-xs text-muted-foreground mb-1">No Priority (last resort)</p>
                      {noPriority.map(g => (
                        <div key={g.id} className="flex items-center gap-2 text-sm pl-8">
                          <span className="text-muted-foreground">{g.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {notAccepting.length > 0 && (
                    <div className="border-t border-border pt-2 mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Not Accepting Bookings</p>
                      {notAccepting.map(g => (
                        <div key={g.id} className="flex items-center gap-2 text-sm pl-8">
                          <span className="text-muted-foreground line-through">{g.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {prioritised.length === 0 && noPriority.length === 0 && (
                    <p className="text-sm text-muted-foreground">No groomers are currently accepting bookings</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default BookingPriorityPage;
