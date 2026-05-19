import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GroomerLayout } from "@/components/GroomerLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, Phone, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Link, useNavigate } from "react-router-dom";
import { AddPlacementDialog } from "@/components/placements/AddPlacementDialog";
import { placementDurationLabel, formatDateNice } from "@/lib/placementDuration";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { toast } from "sonner";

interface Placement {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  education_place: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  added_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  added_by_name?: string | null;
  completed_by_name?: string | null;
}

export default function PlacementsPage() {
  const { user } = useAuth();
  const { role } = useUserRole(user?.id);
  const { staff } = useCurrentStaff();
  const isGroomer = role === "groomer";
  const canManage = role === "manager" || role === "director";
  const Layout = isGroomer ? GroomerLayout : AppLayout;

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [completing, setCompleting] = useState<Placement | null>(null);
  const [completeDate, setCompleteDate] = useState(new Date().toISOString().slice(0, 10));
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("work_placements")
      .select("*");
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Placement[];
    const staffIds = Array.from(new Set(
      rows.flatMap((r) => [r.added_by, r.completed_by]).filter(Boolean) as string[]
    ));
    let nameMap = new Map<string, string>();
    if (staffIds.length) {
      const { data: s } = await supabase.from("staff").select("id,name").in("id", staffIds);
      (s ?? []).forEach((x: any) => nameMap.set(x.id, x.name));
    }
    setPlacements(rows.map((r) => ({
      ...r,
      added_by_name: r.added_by ? nameMap.get(r.added_by) ?? null : null,
      completed_by_name: r.completed_by ? nameMap.get(r.completed_by) ?? null : null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = placements
    .filter((p) => p.status === "active")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = placements
    .filter((p) => p.status === "completed")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  const handleConfirmComplete = async () => {
    if (!completing) return;
    const { error } = await supabase
      .from("work_placements")
      .update({
        status: "completed",
        end_date: completeDate,
        completed_by: staff?.id ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", completing.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("placement_logs").insert({
      placement_id: completing.id,
      staff_id: staff?.id ?? null,
      staff_name: staff?.name ?? null,
      log_entry: `${staff?.name ?? "Staff"} marked placement as completed on ${formatDateNice(completeDate)}`,
    });
    toast.success("Placement marked as completed");
    setCompleting(null);
    load();
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" />
            <h1 className="font-heading text-2xl md:text-3xl font-bold">Placements</h1>
          </div>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add New Placement
          </Button>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3 mt-4">
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : active.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                No active placements at the moment. Add one using the button above.
              </Card>
            ) : active.map((p) => (
              <Card key={p.id} className="p-4 border-l-4 border-l-green-500">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg md:text-xl font-semibold">{p.first_name} {p.last_name}</h3>
                    {p.education_place && <p className="text-sm text-muted-foreground">{p.education_place}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Started {formatDateNice(p.start_date)} · <span className="font-medium text-foreground">{placementDurationLabel(p.start_date)}</span>
                    </p>
                    {p.phone && (
                      <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 text-sm text-primary mt-1">
                        <Phone className="h-3 w-3" /> {p.phone}
                      </a>
                    )}
                    {p.added_by_name && (
                      <p className="text-xs text-muted-foreground mt-1">Added by {p.added_by_name}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/placements/${p.id}`)}>
                      <User className="h-3 w-3 mr-1" /> View Profile
                    </Button>
                    {canManage && (
                      <Button size="sm" onClick={() => { setCompleting(p); setCompleteDate(new Date().toISOString().slice(0, 10)); }}>
                        Mark as Completed
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="past" className="space-y-3 mt-4">
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : past.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">No past placements yet.</Card>
            ) : past.map((p) => (
              <Card key={p.id} className="p-4 border-l-4 border-l-muted">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base md:text-lg font-semibold">{p.first_name} {p.last_name}</h3>
                    {p.education_place && <p className="text-sm text-muted-foreground">{p.education_place}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateNice(p.start_date)} – {formatDateNice(p.end_date)} · {placementDurationLabel(p.start_date, p.end_date)}
                    </p>
                    {p.completed_by_name && (
                      <p className="text-xs text-muted-foreground mt-1">Completed by {p.completed_by_name}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/placements/${p.id}`}><User className="h-3 w-3 mr-1" /> View Profile</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <AddPlacementDialog open={addOpen} onOpenChange={setAddOpen} onSaved={load} />

      <AlertDialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {completing?.first_name} {completing?.last_name} as completed?</AlertDialogTitle>
            <AlertDialogDescription>Set the placement end date below.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="cd">End date</Label>
            <Input id="cd" type="date" value={completeDate} onChange={(e) => setCompleteDate(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmComplete}>Mark as Completed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}