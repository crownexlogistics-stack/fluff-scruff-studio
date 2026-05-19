import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GroomerLayout } from "@/components/GroomerLayout";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Phone, Mail, Pencil } from "lucide-react";
import { toast } from "sonner";
import { placementDurationLabel, formatDateNice } from "@/lib/placementDuration";
import { AddPlacementDialog } from "@/components/placements/AddPlacementDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Placement {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  education_place: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  added_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
}

interface LogEntry {
  id: string;
  placement_id: string;
  staff_id: string | null;
  staff_name: string | null;
  log_entry: string;
  created_at: string;
}

export default function PlacementProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useUserRole(user?.id);
  const { staff } = useCurrentStaff();
  const isGroomer = role === "groomer";
  const canManage = role === "manager" || role === "director";
  const Layout = isGroomer ? GroomerLayout : AppLayout;

  const [placement, setPlacement] = useState<Placement | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [addedByName, setAddedByName] = useState<string | null>(null);
  const [completedByName, setCompletedByName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newLog, setNewLog] = useState("");
  const [savingLog, setSavingLog] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeDate, setCompleteDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: p, error } = await supabase.from("work_placements").select("*").eq("id", id).maybeSingle();
    if (error || !p) { toast.error("Placement not found"); setLoading(false); return; }
    setPlacement(p as Placement);
    const { data: l } = await supabase.from("placement_logs").select("*").eq("placement_id", id).order("created_at", { ascending: true });
    setLogs((l ?? []) as LogEntry[]);
    const ids = [p.added_by, p.completed_by].filter(Boolean) as string[];
    if (ids.length) {
      const { data: s } = await supabase.from("staff").select("id,name").in("id", ids);
      const map = new Map<string, string>();
      (s ?? []).forEach((x: any) => map.set(x.id, x.name));
      setAddedByName(p.added_by ? map.get(p.added_by) ?? null : null);
      setCompletedByName(p.completed_by ? map.get(p.completed_by) ?? null : null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const submitLog = async () => {
    if (!newLog.trim() || !id) return;
    setSavingLog(true);
    const { error } = await supabase.from("placement_logs").insert({
      placement_id: id,
      staff_id: staff?.id ?? null,
      staff_name: staff?.name ?? null,
      log_entry: newLog.trim(),
    });
    setSavingLog(false);
    if (error) { toast.error(error.message); return; }
    setNewLog("");
    load();
  };

  const handleConfirmComplete = async () => {
    if (!placement) return;
    const { error } = await supabase.from("work_placements").update({
      status: "completed",
      end_date: completeDate,
      completed_by: staff?.id ?? null,
      completed_at: new Date().toISOString(),
    }).eq("id", placement.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("placement_logs").insert({
      placement_id: placement.id,
      staff_id: staff?.id ?? null,
      staff_name: staff?.name ?? null,
      log_entry: `${staff?.name ?? "Staff"} marked placement as completed on ${formatDateNice(completeDate)}`,
    });
    toast.success("Placement completed");
    setCompleting(false);
    navigate("/placements");
  };

  if (loading) return <Layout><div className="p-6 text-muted-foreground">Loading…</div></Layout>;
  if (!placement) return <Layout><div className="p-6">Not found</div></Layout>;

  const isActive = placement.status === "active";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/placements"><ArrowLeft className="h-4 w-4 mr-1" /> Back to placements</Link>
        </Button>

        <Card className={`p-5 border-l-4 ${isActive ? "border-l-green-500" : "border-l-muted"}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold">{placement.first_name} {placement.last_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={isActive ? "bg-green-600 hover:bg-green-600" : ""} variant={isActive ? "default" : "secondary"}>
                  {isActive ? "Active" : "Completed"}
                </Badge>
                {placement.education_place && <span className="text-sm text-muted-foreground">{placement.education_place}</span>}
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                {isActive && (
                  <Button size="sm" onClick={() => setCompleting(true)}>Mark as Completed</Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Start date:</span> {formatDateNice(placement.start_date)}</div>
            <div><span className="text-muted-foreground">End date:</span> {placement.end_date ? formatDateNice(placement.end_date) : "Ongoing"}</div>
            <div><span className="text-muted-foreground">Duration:</span> {placementDurationLabel(placement.start_date, placement.end_date)}</div>
            {addedByName && (
              <div><span className="text-muted-foreground">Added by:</span> {addedByName} on {formatDateNice(placement.created_at.slice(0, 10))}</div>
            )}
            {completedByName && placement.completed_at && (
              <div className="sm:col-span-2"><span className="text-muted-foreground">Completed by:</span> {completedByName} on {formatDateNice(placement.completed_at.slice(0, 10))}</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Contact</h2>
          <div className="space-y-2 text-sm">
            {placement.email && (
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${placement.email}`} className="text-primary">{placement.email}</a>
              </div>
            )}
            {placement.phone && (
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${placement.phone}`} className="text-primary">{placement.phone}</a>
              </div>
            )}
            {placement.emergency_contact_name && (
              <div><span className="text-muted-foreground">Emergency contact:</span> {placement.emergency_contact_name}</div>
            )}
            {placement.emergency_contact_phone && (
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${placement.emergency_contact_phone}`} className="text-primary">{placement.emergency_contact_phone}</a>
              </div>
            )}
            {!placement.email && !placement.phone && !placement.emergency_contact_name && !placement.emergency_contact_phone && (
              <p className="text-muted-foreground">No contact details on file.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Progress log</h2>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm mb-3">No log entries yet.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {logs.map((l, i) => (
                <div key={l.id} className={`pl-3 border-l-4 ${i === 0 ? "border-l-green-500" : "border-l-muted"} py-1`}>
                  <p className="text-sm whitespace-pre-wrap">{l.log_entry}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {l.staff_name ?? "Staff"} · {new Date(l.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              ))}
            </div>
          )}
          <Label htmlFor="note">Add a note</Label>
          <Textarea id="note" rows={3} value={newLog} onChange={(e) => setNewLog(e.target.value)} placeholder="Write an update…" />
          <div className="mt-2 flex justify-end">
            <Button onClick={submitLog} disabled={savingLog || !newLog.trim()}>Add Note</Button>
          </div>
        </Card>
      </div>

      <AddPlacementDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={load}
        existing={placement}
      />

      <AlertDialog open={completing} onOpenChange={setCompleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {placement.first_name} {placement.last_name} as completed?</AlertDialogTitle>
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