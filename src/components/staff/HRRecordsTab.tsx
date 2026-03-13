import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarIcon, Plus, Upload, Download, FileText, AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EVENT_TYPES = [
  "Contract Signed",
  "Contract Renewed",
  "Verbal Warning",
  "Written Warning",
  "Final Warning",
  "Suspension",
  "Performance Review",
  "Salary/Commission Change",
  "Last Working Day",
  "Termination",
  "Resignation",
  "Other",
];

const SENSITIVE_EVENTS = ["Verbal Warning", "Written Warning", "Final Warning", "Suspension", "Termination", "Resignation"];
const POSITIVE_EVENTS = ["Contract Signed", "Contract Renewed", "Joined"];

const STATUS_OPTIONS = ["Active", "Suspended", "Terminated", "Resigned"];

interface Props {
  staffId: string;
  staffCreatedAt: string;
  staffName: string;
}

export const HRRecordsTab = ({ staffId, staffCreatedAt, staffName }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ event_type: "", event_date: null as Date | null, notes: "" });
  const [uploadingFile, setUploadingFile] = useState(false);

  // Fetch HR events
  const { data: hrEvents } = useQuery({
    queryKey: ["hr_events", staffId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("hr_events" as any) as any)
        .select("*")
        .eq("staff_id", staffId)
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch employment status
  const { data: employmentStatus } = useQuery({
    queryKey: ["hr_employment_status", staffId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("hr_employment_status" as any) as any)
        .select("*")
        .eq("staff_id", staffId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Fetch HR documents
  const { data: hrDocs } = useQuery({
    queryKey: ["hr_documents", staffId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("hr_documents" as any) as any)
        .select("*")
        .eq("staff_id", staffId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch staff for start_date and employment_end_date
  const { data: staffData } = useQuery({
    queryKey: ["staff", staffId],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").eq("id", staffId).single();
      if (error) throw error;
      return data;
    },
  });

  const addEventMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("hr_events" as any) as any).insert({
        staff_id: staffId,
        event_type: eventForm.event_type,
        event_date: format(eventForm.event_date!, "yyyy-MM-dd"),
        notes: eventForm.notes || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr_events", staffId] });
      setAddEventOpen(false);
      setEventForm({ event_type: "", event_date: null, notes: "" });
      toast.success("Event added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const existing = employmentStatus;
      if (existing) {
        const { error } = await (supabase.from("hr_employment_status" as any) as any)
          .update({ ...updates, updated_by: user!.id, updated_at: new Date().toISOString() })
          .eq("staff_id", staffId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("hr_employment_status" as any) as any)
          .insert({ staff_id: staffId, ...updates, updated_by: user!.id });
        if (error) throw error;
      }

      // Auto-block access on Terminated/Resigned
      if (updates.current_status === "Terminated" || updates.current_status === "Resigned") {
        await supabase.from("staff").update({ account_blocked: true } as any).eq("id", staffId);
        queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr_employment_status", staffId] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const path = `${staffId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("hr-documents").upload(path, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await (supabase.from("hr_documents" as any) as any).insert({
        staff_id: staffId,
        filename: file.name,
        storage_path: path,
        uploaded_by: user!.id,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["hr_documents", staffId] });
      toast.success("Document uploaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage.from("hr-documents").download(doc.storage_path);
    if (error) { toast.error("Download failed"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteDocMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("hr-documents").remove([doc.storage_path]);
      const { error } = await (supabase.from("hr_documents" as any) as any).delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr_documents", staffId] });
      toast.success("Document deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentStatus = employmentStatus?.current_status || "Active";
  const isTerminatedOrResigned = currentStatus === "Terminated" || currentStatus === "Resigned";

  // Build timeline with "Joined" entry
  const timelineEvents = [
    ...(hrEvents || []),
    { id: "joined", event_type: "Joined", event_date: staffCreatedAt?.split("T")[0] || format(new Date(), "yyyy-MM-dd"), notes: null, created_at: staffCreatedAt },
  ].sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

  return (
    <div className="space-y-6">
      {/* Terminated/Resigned Banner */}
      {isTerminatedOrResigned && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="font-medium text-destructive">{currentStatus} — {staffName}</span>
        </div>
      )}

      {/* Employment Timeline */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">Employment Timeline</CardTitle>
            <Button size="sm" onClick={() => setAddEventOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Event
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-0">
            {timelineEvents.map((evt, i) => {
              const isSensitive = SENSITIVE_EVENTS.includes(evt.event_type);
              const isPositive = POSITIVE_EVENTS.includes(evt.event_type);
              const dotColor = isSensitive ? "bg-destructive" : isPositive ? "bg-emerald-500" : "bg-primary";

              return (
                <div key={evt.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Line */}
                  {i < timelineEvents.length - 1 && (
                    <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
                  )}
                  {/* Dot */}
                  <div className={cn("relative z-10 mt-1.5 h-4 w-4 rounded-full border-2 border-background shrink-0", dotColor)} />
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{evt.event_type}</span>
                      {isSensitive && <Badge variant="destructive" className="text-xs">Sensitive</Badge>}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(evt.event_date), "dd MMM yyyy")}
                      </span>
                    </div>
                    {evt.notes && <p className="text-sm text-muted-foreground mt-1">{evt.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Employment Status */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="font-heading text-lg">Employment Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current Status</Label>
              <Select
                value={currentStatus}
                onValueChange={(v) => updateStatusMutation.mutate({ current_status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                readOnly
                value={staffData?.start_date ? format(new Date(staffData.start_date), "dd MMM yyyy") : "—"}
                className="bg-muted/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Last Working Day</Label>
              <Input
                readOnly
                value={(staffData as any)?.employment_end_date ? format(new Date((staffData as any).employment_end_date), "dd MMM yyyy") : "—"}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Notice Period</Label>
              <Input
                value={employmentStatus?.notice_period || ""}
                onChange={(e) => updateStatusMutation.mutate({ notice_period: e.target.value })}
                placeholder="e.g. 1 month"
              />
            </div>
          </div>

          {isTerminatedOrResigned && (
            <div className="space-y-2">
              <Label>Reason for Leaving</Label>
              <Textarea
                value={employmentStatus?.reason_for_leaving || ""}
                onChange={(e) => updateStatusMutation.mutate({ reason_for_leaving: e.target.value })}
                placeholder="Describe the reason..."
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">HR Documents</CardTitle>
            <Button size="sm" variant="outline" asChild disabled={uploadingFile}>
              <label className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" /> {uploadingFile ? "Uploading..." : "Upload"}
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
              </label>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Private — only visible to admin. Upload contracts, ID documents, warning letters, etc.</p>
        </CardHeader>
        <CardContent>
          {!hrDocs || hrDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {hrDocs.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {format(new Date(doc.created_at), "dd MMM yyyy")}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => handleDownload(doc)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteDocMutation.mutate(doc)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Event Dialog */}
      <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add HR Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Event Type *</Label>
              <Select value={eventForm.event_type} onValueChange={(v) => setEventForm({ ...eventForm, event_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select event type" /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !eventForm.event_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {eventForm.event_date ? format(eventForm.event_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={eventForm.event_date ?? undefined} onSelect={(d) => setEventForm({ ...eventForm, event_date: d ?? null })} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={eventForm.notes} onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })} placeholder="Optional details..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEventOpen(false)}>Cancel</Button>
            <Button onClick={() => addEventMutation.mutate()} disabled={!eventForm.event_type || !eventForm.event_date || addEventMutation.isPending}>
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
