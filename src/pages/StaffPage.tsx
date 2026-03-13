import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface StaffForm { name: string; role: string; is_self_employed: boolean; }
const emptyForm: StaffForm = { name: "", role: "", is_self_employed: false };

const FLAGGED_EVENT_TYPES = ["Verbal Warning", "Written Warning", "Final Warning", "Suspension", "Termination", "Resignation"];

const StaffPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const { user } = useAuth();
  const { role: currentUserRole } = useUserRole(user?.id);
  const isManagerOrDirector = currentUserRole === "director" || currentUserRole === "manager";

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch HR events for flag indicators (admin only)
  const { data: hrEventsAll } = useQuery({
    queryKey: ["hr_events_all"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("hr_events" as any) as any)
        .select("staff_id, event_type");
      if (error) throw error;
      return data as { staff_id: string; event_type: string }[];
    },
    enabled: isManagerOrDirector,
  });

  // Build a set of staff IDs that have flagged events
  const flaggedStaffMap = new Map<string, string>();
  if (hrEventsAll) {
    for (const evt of hrEventsAll) {
      if (FLAGGED_EVENT_TYPES.includes(evt.event_type)) {
        const isTermination = evt.event_type === "Termination" || evt.event_type === "Resignation";
        if (isTermination || !flaggedStaffMap.has(evt.staff_id)) {
          flaggedStaffMap.set(evt.staff_id, isTermination ? "red" : "amber");
        }
      }
    }
  }

  const addMutation = useMutation({
    mutationFn: async (s: StaffForm) => {
      const { error } = await supabase.from("staff").insert(s);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff"] }); toast.success("Staff added"); setAddOpen(false); setForm(emptyForm); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff"] }); toast.success("Staff deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.name.trim() || !form.role.trim()) { toast.error("Name and role required"); return; }
    addMutation.mutate(form);
  };

  const statusColor = (status: string) => ({
    draft: "bg-muted text-muted-foreground",
    sent: "bg-primary/15 text-primary",
    signed: "bg-success/15 text-success",
  }[status] || "bg-muted text-muted-foreground");

  const getStaffStatusBadge = (s: any) => {
    if (s.account_blocked) {
      return <Badge variant="destructive" className="text-xs">Access Blocked</Badge>;
    }
    if (s.employment_end_date) {
      const endDate = new Date(s.employment_end_date);
      const now = new Date();
      const daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) {
        return <Badge variant="secondary" className="text-xs text-muted-foreground">No longer active</Badge>;
      }
      if (daysUntil <= 30) {
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 text-xs">Leaving {format(endDate, "dd MMM")}</Badge>;
      }
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold">Staff</h1>
            <p className="text-muted-foreground mt-1">Manage your grooming team</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setForm(emptyForm)}><Plus className="mr-2 h-4 w-4" /> Add Staff</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Add Staff</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
                <div className="space-y-2"><Label>Role</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Senior Groomer" /></div>
                <div className="flex items-center justify-between">
                  <Label>Self-Employed</Label>
                  <Switch checked={form.is_self_employed} onCheckedChange={(v) => setForm({ ...form, is_self_employed: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : staff?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No staff yet.</TableCell></TableRow>
                ) : (
                  <TooltipProvider>
                    {[...(staff || [])].sort((a: any, b: any) => {
                      const scoreA = a.account_blocked ? 3 : (a.employment_end_date && new Date(a.employment_end_date) < new Date() ? 2 : 0);
                      const scoreB = b.account_blocked ? 3 : (b.employment_end_date && new Date(b.employment_end_date) < new Date() ? 2 : 0);
                      return scoreA - scoreB;
                    }).map((s: any) => {
                      const isInactive = s.account_blocked || (s.employment_end_date && new Date(s.employment_end_date) < new Date());
                      const statusBadge = getStaffStatusBadge(s);
                      const flagColor = isManagerOrDirector ? flaggedStaffMap.get(s.id) : undefined;
                      return (
                        <TableRow
                          key={s.id}
                          className={cn(
                            "cursor-pointer hover:bg-muted/50",
                            isInactive && "opacity-50",
                            s.account_blocked && "border-l-2 border-l-destructive",
                            s.employment_end_date && !s.account_blocked && new Date(s.employment_end_date) >= new Date() && Math.ceil((new Date(s.employment_end_date).getTime() - Date.now()) / 86400000) <= 30 && "border-l-2 border-l-amber-500"
                          )}
                          onClick={() => navigate(`/staff/${s.id}`)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {s.name}
                              {flagColor && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={cn(
                                      "inline-block h-2.5 w-2.5 rounded-full shrink-0",
                                      flagColor === "red" ? "bg-destructive" : "bg-amber-500"
                                    )} />
                                  </TooltipTrigger>
                                  <TooltipContent>HR events on record</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{s.role}</TableCell>
                          <TableCell>{statusBadge || <span className="text-success text-sm font-medium">Active</span>}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-xs capitalize ${statusColor(s.contract_status)}`}>
                              {s.contract_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(s.id); }} className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TooltipProvider>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default StaffPage;
