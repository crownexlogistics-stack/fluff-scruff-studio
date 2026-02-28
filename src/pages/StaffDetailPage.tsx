import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CalendarIcon, Save, FileText, Send, CheckCircle2, User, Clock, Scissors, StickyNote, Cake } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ContractPreviewDialog } from "@/components/staff/ContractPreviewDialog";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const StaffDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [contractOpen, setContractOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const { user } = useAuth();
  const { role: currentUserRole } = useUserRole(user?.id);
  const isDirector = currentUserRole === "director";

  // Basic form state
  const [form, setForm] = useState({
    name: "", role: "", email: "", contact_number: "", is_self_employed: false, start_date: null as Date | null, date_of_birth: null as Date | null,
  });

  // Availability state: array of 7 days
  const [availability, setAvailability] = useState(
    DAYS.map((_, i) => ({ day_of_week: i, start_time: "09:00", end_time: "17:00", is_available: i < 5 }))
  );

  // Assigned services state
  const [assignedServiceIds, setAssignedServiceIds] = useState<string[]>([]);

  // Fetch staff
  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch availability
  const { data: availData } = useQuery({
    queryKey: ["staff_availability", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_availability").select("*").eq("staff_id", id!).order("day_of_week");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch assigned services
  const { data: staffServicesData } = useQuery({
    queryKey: ["staff_services", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_services").select("service_id").eq("staff_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch all services
  const { data: allServices } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch HR notes (director only)
  const { data: staffNotes } = useQuery({
    queryKey: ["staff_notes", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_notes" as any).select("*").eq("staff_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id && isDirector,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase.from("staff_notes" as any).insert({ staff_id: id!, note, created_by: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff_notes", id] }); setNewNote(""); toast.success("Note added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Populate form when data loads
  useEffect(() => {
    if (staff) {
      setForm({
        name: staff.name, role: staff.role, email: staff.email || "",
        contact_number: staff.contact_number || "",
        is_self_employed: staff.is_self_employed, start_date: staff.start_date ? new Date(staff.start_date) : null,
        date_of_birth: (staff as any).date_of_birth ? new Date((staff as any).date_of_birth) : null,
      });
    }
  }, [staff]);

  useEffect(() => {
    if (availData && availData.length > 0) {
      setAvailability(DAYS.map((_, i) => {
        const existing = availData.find((a) => a.day_of_week === i);
        return existing
          ? { day_of_week: i, start_time: existing.start_time.slice(0, 5), end_time: existing.end_time.slice(0, 5), is_available: existing.is_available }
          : { day_of_week: i, start_time: "09:00", end_time: "17:00", is_available: i < 5 };
      }));
    }
  }, [availData]);

  useEffect(() => {
    if (staffServicesData) {
      setAssignedServiceIds(staffServicesData.map((s) => s.service_id));
    }
  }, [staffServicesData]);

  // Save mutations
  const saveBasicMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff").update({
        name: form.name, role: form.role, email: form.email || null,
        contact_number: form.contact_number || null,
        is_self_employed: form.is_self_employed,
        start_date: form.start_date ? format(form.start_date, "yyyy-MM-dd") : null,
        date_of_birth: form.date_of_birth ? format(form.date_of_birth, "yyyy-MM-dd") : null,
      } as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff", id] }); toast.success("Details saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAvailabilityMutation = useMutation({
    mutationFn: async () => {
      // Delete existing then insert
      await supabase.from("staff_availability").delete().eq("staff_id", id!);
      const rows = availability.map((a) => ({
        staff_id: id!, day_of_week: a.day_of_week, start_time: a.start_time, end_time: a.end_time, is_available: a.is_available,
      }));
      const { error } = await supabase.from("staff_availability").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff_availability", id] }); toast.success("Working hours saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveServicesMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("staff_services").delete().eq("staff_id", id!);
      if (assignedServiceIds.length > 0) {
        const rows = assignedServiceIds.map((sid) => ({ staff_id: id!, service_id: sid }));
        const { error } = await supabase.from("staff_services").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff_services", id] }); toast.success("Assigned services saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendForSignatureMutation = useMutation({
    mutationFn: async () => {
      if (!staff?.email) {
        throw new Error("Please add an email address for this staff member before sending.");
      }
      const signingUrl = `${window.location.origin}/contract/sign/${id}`;
      const { error: fnError } = await supabase.functions.invoke("send-contract-email", {
        body: { staff_id: id, type: "send_for_signature", signing_url: signingUrl },
      });
      if (fnError) throw fnError;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff", id] }); toast.success("Contract emailed to " + staff?.email); },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateContractMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff").update({ contract_status: "draft" }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff", id] }); setContractOpen(true); toast.success("Contract generated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSaveAll = () => {
    saveBasicMutation.mutate();
    saveAvailabilityMutation.mutate();
    saveServicesMutation.mutate();
  };

  const toggleService = (serviceId: string) => {
    setAssignedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((s) => s !== serviceId) : [...prev, serviceId]
    );
  };

  const updateAvail = (dayIndex: number, field: string, value: any) => {
    setAvailability((prev) => prev.map((a, i) => i === dayIndex ? { ...a, [field]: value } : a));
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div></AppLayout>;
  }

  if (!staff) {
    return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Staff member not found.</div></AppLayout>;
  }

  const statusColor = { draft: "bg-muted text-muted-foreground", sent: "bg-primary/15 text-primary", signed: "bg-success/15 text-success" }[staff.contract_status] || "bg-muted text-muted-foreground";

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/staff")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-heading font-bold">{staff.name}</h1>
              <p className="text-muted-foreground text-sm">{staff.role} {staff.is_self_employed && "· Self-Employed"}</p>
            </div>
          </div>
          <Button onClick={handleSaveAll} disabled={saveBasicMutation.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save All Changes
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: Basic + HR */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Details */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="font-heading text-lg flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Basic Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Groomer">Groomer</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Volunteer">Volunteer</SelectItem>
                        <SelectItem value="Work Placement">Work Placement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} placeholder="07700 900000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Cake className="h-4 w-4" /> Date of Birth</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.date_of_birth && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.date_of_birth ? format(form.date_of_birth, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.date_of_birth ?? undefined} onSelect={(d) => setForm({ ...form, date_of_birth: d ?? null })} initialFocus className="p-3 pointer-events-auto" captionLayout="dropdown-buttons" fromYear={1950} toYear={2010} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Label>Self-Employed Contractor</Label>
                  <Switch checked={form.is_self_employed} onCheckedChange={(v) => setForm({ ...form, is_self_employed: v })} />
                </div>
              </CardContent>
            </Card>

            {/* Working Hours */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="font-heading text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Working Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-[120px_1fr_auto_1fr] gap-3 items-center text-xs font-medium text-muted-foreground px-1">
                    <span>Day</span><span>Start</span><span></span><span>End</span>
                  </div>
                  {DAYS.map((day, i) => (
                    <div key={day} className={cn("grid grid-cols-[120px_1fr_auto_1fr] gap-3 items-center rounded-lg px-3 py-2", availability[i].is_available ? "bg-card" : "bg-muted/50 opacity-60")}>
                      <div className="flex items-center gap-2">
                        <Switch checked={availability[i].is_available} onCheckedChange={(v) => updateAvail(i, "is_available", v)} className="scale-75" />
                        <span className="text-sm font-medium">{day}</span>
                      </div>
                      <Input type="time" value={availability[i].start_time} onChange={(e) => updateAvail(i, "start_time", e.target.value)} disabled={!availability[i].is_available} className="h-9" />
                      <span className="text-muted-foreground text-xs">to</span>
                      <Input type="time" value={availability[i].end_time} onChange={(e) => updateAvail(i, "end_time", e.target.value)} disabled={!availability[i].is_available} className="h-9" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: HR & Services */}
          <div className="space-y-6">
            {/* HR & Contracts */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="font-heading text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> HR & Contracts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.start_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.start_date ? format(form.start_date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.start_date ?? undefined} onSelect={(d) => setForm({ ...form, start_date: d ?? null })} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Contract Status</span>
                    <Badge variant="secondary" className={cn("capitalize text-xs", statusColor)}>{staff.contract_status}</Badge>
                  </div>

                  {staff.signed_at && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Signed {format(new Date(staff.signed_at), "PPP 'at' p")}</p>
                      {(staff as any).signed_ip && <p>IP: {(staff as any).signed_ip}</p>}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" onClick={() => setContractOpen(true)} className="w-full justify-start">
                      <FileText className="mr-2 h-3.5 w-3.5" /> View Contract
                    </Button>
                    {staff.contract_status === "draft" && (
                      <Button size="sm" onClick={() => sendForSignatureMutation.mutate()} className="w-full justify-start">
                        <Send className="mr-2 h-3.5 w-3.5" /> Send for Signature
                      </Button>
                    )}
                    {staff.contract_status === "signed" && (
                      <div className="flex items-center gap-2 text-success text-sm">
                        <CheckCircle2 className="h-4 w-4" /> Contract signed
                      </div>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => generateContractMutation.mutate()} className="w-full justify-start">
                      <FileText className="mr-2 h-3.5 w-3.5" /> Generate Contract
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <span className="text-sm font-medium">Signing Link</span>
                  <p className="text-xs text-muted-foreground break-all">
                    {window.location.origin}/contract/sign/{staff.id}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Assigned Services */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="font-heading text-lg flex items-center gap-2"><Scissors className="h-5 w-5 text-primary" /> Assigned Services</CardTitle>
              </CardHeader>
              <CardContent>
                {!allServices || allServices.filter((s) => s.is_active).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active services. Enable services in the Services page first.</p>
                ) : (
                  <div className="space-y-2">
                    {allServices.filter((s) => s.is_active).map((svc) => (
                      <label key={svc.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                        <Checkbox checked={assignedServiceIds.includes(svc.id)} onCheckedChange={() => toggleService(svc.id)} />
                        <div>
                          <span className="text-sm font-medium">{svc.name}</span>
                          {svc.description && <p className="text-xs text-muted-foreground">{svc.description}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* HR Notes - Director only */}
            {isDirector && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="font-heading text-lg flex items-center gap-2"><StickyNote className="h-5 w-5 text-primary" /> HR Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a confidential HR note..."
                      rows={3}
                    />
                    <Button
                      size="sm"
                      onClick={() => { if (newNote.trim()) addNoteMutation.mutate(newNote.trim()); }}
                      disabled={!newNote.trim() || addNoteMutation.isPending}
                    >
                      Add Note
                    </Button>
                  </div>

                  {staffNotes && staffNotes.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <Separator />
                      {staffNotes.map((n: any) => (
                        <div key={n.id} className="rounded-lg border bg-muted/30 p-3 space-y-1">
                          <p className="text-sm">{n.note}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(n.created_at), "dd MMM yyyy 'at' HH:mm")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <ContractPreviewDialog staff={staff} open={contractOpen} onOpenChange={setContractOpen} />
    </AppLayout>
  );
};

export default StaffDetailPage;
