import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const WorkSchedulePage = () => {
  const queryClient = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const { data: staff } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name, role").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: availability, isLoading: avLoading } = useQuery({
    queryKey: ["staff-availability", selectedStaffId],
    queryFn: async () => {
      if (!selectedStaffId) return [];
      const { data, error } = await supabase
        .from("staff_availability")
        .select("*")
        .eq("staff_id", selectedStaffId)
        .order("day_of_week");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStaffId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (params: {
      staffId: string;
      dayOfWeek: number;
      isAvailable: boolean;
      startTime: string;
      endTime: string;
      existingId?: string;
    }) => {
      if (params.existingId) {
        const { error } = await supabase
          .from("staff_availability")
          .update({
            is_available: params.isAvailable,
            start_time: params.startTime,
            end_time: params.endTime,
          })
          .eq("id", params.existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff_availability").insert({
          staff_id: params.staffId,
          day_of_week: params.dayOfWeek,
          is_available: params.isAvailable,
          start_time: params.startTime,
          end_time: params.endTime,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-availability", selectedStaffId] });
      toast.success("Schedule updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getDay = (dayIndex: number) => {
    return availability?.find((a) => a.day_of_week === dayIndex);
  };

  const handleToggle = (dayIndex: number, checked: boolean) => {
    const existing = getDay(dayIndex);
    upsertMutation.mutate({
      staffId: selectedStaffId!,
      dayOfWeek: dayIndex,
      isAvailable: checked,
      startTime: existing?.start_time ?? "09:00",
      endTime: existing?.end_time ?? "17:00",
      existingId: existing?.id,
    });
  };

  const handleTimeChange = (dayIndex: number, field: "start_time" | "end_time", value: string) => {
    const existing = getDay(dayIndex);
    upsertMutation.mutate({
      staffId: selectedStaffId!,
      dayOfWeek: dayIndex,
      isAvailable: existing?.is_available ?? true,
      startTime: field === "start_time" ? value : (existing?.start_time ?? "09:00"),
      endTime: field === "end_time" ? value : (existing?.end_time ?? "17:00"),
      existingId: existing?.id,
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-heading">Work Schedule</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage weekly availability for each team member
          </p>
        </div>

        <Select
          value={selectedStaffId ?? ""}
          onValueChange={(v) => setSelectedStaffId(v)}
        >
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select staff member" />
          </SelectTrigger>
          <SelectContent>
            {staff?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} — {s.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedStaffId && (
          <Card className="rounded-xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-body font-semibold">
                Weekly Availability
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {avLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
              ) : (
                DAYS.map((dayName, idx) => {
                  const dayData = getDay(idx);
                  const isAvailable = dayData?.is_available ?? false;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                    >
                      <Switch
                        checked={isAvailable}
                        onCheckedChange={(v) => handleToggle(idx, v)}
                      />
                      <span className="w-24 text-sm font-medium">{dayName}</span>
                      {isAvailable && (
                        <div className="flex items-center gap-2 text-sm">
                          <Input
                            type="time"
                            className="w-28 h-8"
                            value={dayData?.start_time?.slice(0, 5) ?? "09:00"}
                            onChange={(e) => handleTimeChange(idx, "start_time", e.target.value)}
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            className="w-28 h-8"
                            value={dayData?.end_time?.slice(0, 5) ?? "17:00"}
                            onChange={(e) => handleTimeChange(idx, "end_time", e.target.value)}
                          />
                        </div>
                      )}
                      {!isAvailable && (
                        <span className="text-xs text-muted-foreground">Day off</span>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default WorkSchedulePage;
