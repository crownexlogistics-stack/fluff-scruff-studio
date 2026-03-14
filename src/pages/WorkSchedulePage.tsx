import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Clock, CalendarDays, X, User } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday, isSameDay } from "date-fns";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatTime12(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const WorkSchedulePage = () => {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [filterStaff, setFilterStaff] = useState("all");
  const [editCell, setEditCell] = useState<{ staffId: string; staffName: string; date: Date; startTime: string; endTime: string; overrideId?: string; isWorking: boolean } | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const { data: staff } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name, role").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: availability } = useQuery({
    queryKey: ["all-staff-availability"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_availability").select("*");
      if (error) throw error;
      return data;
    },
  });

  const weekEndDate = weekDates[6];
  const { data: overrides } = useQuery({
    queryKey: ["schedule-overrides", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_schedule_overrides")
        .select("*")
        .gte("override_date", format(weekStart, "yyyy-MM-dd"))
        .lte("override_date", format(weekEndDate, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (params: { staffId: string; date: Date }) => {
      const dateStr = format(params.date, "yyyy-MM-dd");
      const { error } = await supabase.from("staff_schedule_overrides").upsert(
        { staff_id: params.staffId, override_date: dateStr, is_working: false, start_time: null, end_time: null },
        { onConflict: "staff_id,override_date" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] });
      toast.success("Shift removed for the day");
      setEditCell(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async (params: { staffId: string; date: Date; startTime: string; endTime: string }) => {
      const dateStr = format(params.date, "yyyy-MM-dd");
      const { error } = await supabase.from("staff_schedule_overrides").upsert(
        { staff_id: params.staffId, override_date: dateStr, is_working: true, start_time: params.startTime, end_time: params.endTime },
        { onConflict: "staff_id,override_date" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] });
      toast.success("Shift updated for the day");
      setEditCell(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (params: { overrideId: string }) => {
      const { error } = await supabase.from("staff_schedule_overrides").delete().eq("id", params.overrideId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] });
      toast.success("Shift restored to default");
      setEditCell(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function getShiftForCell(staffId: string, date: Date) {
    const dateStr = format(date, "yyyy-MM-dd");
    const override = overrides?.find((o) => o.staff_id === staffId && o.override_date === dateStr);
    if (override) {
      return override.is_working
        ? { startTime: override.start_time?.slice(0, 5) ?? "09:00", endTime: override.end_time?.slice(0, 5) ?? "17:00", overrideId: override.id, isWorking: true }
        : { startTime: "", endTime: "", overrideId: override.id, isWorking: false };
    }
    const dayOfWeek = (date.getDay() + 6) % 7; // 0=Mon
    const avail = availability?.find((a) => a.staff_id === staffId && a.day_of_week === dayOfWeek);
    if (avail?.is_available) {
      return { startTime: avail.start_time?.slice(0, 5) ?? "09:00", endTime: avail.end_time?.slice(0, 5) ?? "17:00", isWorking: true };
    }
    return null;
  }

  const filteredStaff = filterStaff === "all" ? staff : staff?.filter((s) => s.id === filterStaff);
  const weekLabel = `${format(weekStart, "MMM d, yyyy")}–${format(weekDates[6], "MMM d, yyyy")}`;

  return (
    <AppLayout>
      <div className="space-y-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold">Work Schedule</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage when staff members are available for the week.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap bg-card border border-border rounded-xl p-3">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {weekLabel}
          </div>
          <div className="ml-auto">
            <Select value={filterStaff} onValueChange={setFilterStaff}>
              <SelectTrigger className="w-48 h-8 text-sm">
                <SelectValue placeholder="All staff members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff members</SelectItem>
                {staff?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr>
                <th className="text-left p-3 w-48 border-b border-border" />
                {weekDates.map((d, i) => {
                  const today = isToday(d);
                  return (
                    <th key={i} className={`p-3 text-center border-b border-border ${today ? "border-b-2 border-b-primary" : ""}`}>
                      <div className={`text-lg font-semibold ${today ? "text-primary" : "text-foreground"}`}>
                        {format(d, "d")}
                      </div>
                      <div className={`text-xs ${today ? "text-primary" : "text-muted-foreground"}`}>
                        {DAY_LABELS[i]}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredStaff?.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-b-0">
                  <td className="p-3 w-48">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium truncate">{s.name}</span>
                    </div>
                  </td>
                  {weekDates.map((d, di) => {
                    const shift = getShiftForCell(s.id, d);
                    const cellKey = `${s.id}-${di}`;
                    const isOpen = editCell?.staffId === s.id && isSameDay(editCell.date, d);

                    return (
                      <td key={cellKey} className="p-1.5 text-center align-middle">
                        {shift?.isWorking ? (
                          <Popover
                            open={isOpen}
                            onOpenChange={(open) => {
                              if (open) {
                                setEditCell({ staffId: s.id, staffName: s.name, date: d, startTime: shift.startTime, endTime: shift.endTime, overrideId: shift.overrideId, isWorking: true });
                                setEditStart(shift.startTime);
                                setEditEnd(shift.endTime);
                              } else {
                                setEditCell(null);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button className="w-full rounded-lg bg-muted/60 hover:bg-muted px-2 py-2 text-xs font-medium transition-colors cursor-pointer text-foreground">
                                {formatTime12(shift.startTime)} - {formatTime12(shift.endTime)}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="center">
                              <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold">{s.name}</h4>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditCell(null)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    <div className="flex items-center gap-1">
                                      <Input type="time" className="w-28 h-7 text-xs" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                                      <span>-</span>
                                      <Input type="time" className="w-28 h-7 text-xs" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4" />
                                    <span>{format(d, "MMM d, yyyy")}</span>
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => removeMutation.mutate({ staffId: s.id, date: d })}
                                  >
                                    Remove
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => editMutation.mutate({ staffId: s.id, date: d, startTime: editStart, endTime: editEnd })}
                                  >
                                    Save
                                  </Button>
                                </div>
                                {editCell?.overrideId && (
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => restoreMutation.mutate({ overrideId: editCell.overrideId! })}
                                  >
                                    Restore default schedule
                                  </Button>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Popover
                            open={isOpen}
                            onOpenChange={(open) => {
                              if (open) {
                                setEditCell({ staffId: s.id, staffName: s.name, date: d, startTime: "09:00", endTime: "17:00", isWorking: false });
                                setEditStart("09:00");
                                setEditEnd("17:00");
                              } else {
                                setEditCell(null);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button className="w-full h-9 rounded-lg border border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer flex items-center justify-center">
                                <span className="text-xs text-muted-foreground/50 group-hover:text-primary">+</span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="center">
                              <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-semibold">{s.name}</h4>
                                    <p className="text-xs text-muted-foreground">Open for {format(d, "MMM d, yyyy")}</p>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditCell(null)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  <div className="flex items-center gap-1">
                                    <Input type="time" className="w-28 h-7 text-xs" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                                    <span>-</span>
                                    <Input type="time" className="w-28 h-7 text-xs" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => editMutation.mutate({ staffId: s.id, date: d, startTime: editStart, endTime: editEnd })}
                                >
                                  Open Day
                                </Button>
                                {shift?.overrideId && (
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => restoreMutation.mutate({ overrideId: shift.overrideId! })}
                                  >
                                    Restore default schedule
                                  </Button>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {(!filteredStaff || filteredStaff.length === 0) && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                    No staff members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded-full border border-border flex items-center justify-center text-[10px]">i</span>
          Click on a shift to make one-time changes. Recurring working hours are managed in each staff member's profile.
        </p>
      </div>
    </AppLayout>
  );
};

export default WorkSchedulePage;
