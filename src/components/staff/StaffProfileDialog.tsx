import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, Send, Pencil, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ContractPreviewDialog } from "./ContractPreviewDialog";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  is_self_employed: boolean;
  start_date: string | null;
  contract_status: string;
  signed_at: string | null;
  signed_ip: string | null;
  contact_number: string | null;
  created_at: string;
}

interface Props {
  staff: StaffMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StaffProfileDialog({ staff, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", is_self_employed: false, contact_number: "", start_date: null as Date | null });
  const [contractOpen, setContractOpen] = useState(false);

  const startEditing = () => {
    if (!staff) return;
    setForm({
      name: staff.name,
      role: staff.role,
      is_self_employed: staff.is_self_employed,
      contact_number: staff.contact_number || "",
      start_date: staff.start_date ? new Date(staff.start_date) : null,
    });
    setEditing(true);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!staff) return;
      const { error } = await supabase.from("staff").update({
        name: form.name,
        role: form.role,
        is_self_employed: form.is_self_employed,
        contact_number: form.contact_number || null,
        start_date: form.start_date ? format(form.start_date, "yyyy-MM-dd") : null,
      }).eq("id", staff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Profile updated");
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendForSignatureMutation = useMutation({
    mutationFn: async () => {
      if (!staff) return;
      const { error } = await supabase.from("staff").update({ contract_status: "sent" }).eq("id", staff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Contract sent for signature");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateContractMutation = useMutation({
    mutationFn: async () => {
      if (!staff) return;
      const { error } = await supabase.from("staff").update({ contract_status: "draft" }).eq("id", staff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setContractOpen(true);
      toast.success("Contract generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!staff) return null;

  const statusColor = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-primary/15 text-primary",
    signed: "bg-success/15 text-success",
  }[staff.contract_status] || "bg-muted text-muted-foreground";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl flex items-center justify-between">
              Staff Profile
              {!editing && (
                <Button variant="ghost" size="icon" onClick={startEditing}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Number</Label>
                    <Input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} placeholder="e.g. 07700 900000" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Self-Employed</Label>
                    <Switch checked={form.is_self_employed} onCheckedChange={(v) => setForm({ ...form, is_self_employed: v })} />
                  </div>
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
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setEditing(false)}><X className="mr-1 h-4 w-4" />Cancel</Button>
                    <Button onClick={() => updateMutation.mutate()}><Save className="mr-1 h-4 w-4" />Save</Button>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{staff.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Role</p>
                    <p className="font-medium">{staff.role}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contact</p>
                    <p className="font-medium">{staff.contact_number || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Self-Employed</p>
                    <p className="font-medium">{staff.is_self_employed ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Start Date</p>
                    <p className="font-medium">{staff.start_date ? format(new Date(staff.start_date), "PPP") : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Added</p>
                    <p className="font-medium">{format(new Date(staff.created_at), "PPP")}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Documents Section */}
            <div className="space-y-3">
              <h3 className="font-heading font-semibold text-base">Documents</h3>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Employment Contract</span>
                  </div>
                  <Badge variant="secondary" className={cn("text-xs capitalize", statusColor)}>
                    {staff.contract_status}
                  </Badge>
                </div>

                {staff.signed_at && (
                  <p className="text-xs text-muted-foreground">
                    Signed on {format(new Date(staff.signed_at), "PPP 'at' p")}
                  </p>
                )}

                <div className="flex gap-2 flex-wrap">
                  {staff.contract_status === "draft" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setContractOpen(true)}>
                        <FileText className="mr-1 h-3.5 w-3.5" /> View Contract
                      </Button>
                      <Button size="sm" onClick={() => sendForSignatureMutation.mutate()}>
                        <Send className="mr-1 h-3.5 w-3.5" /> Send for Signature
                      </Button>
                    </>
                  )}
                  {staff.contract_status === "sent" && (
                    <Button size="sm" variant="outline" onClick={() => setContractOpen(true)}>
                      <FileText className="mr-1 h-3.5 w-3.5" /> View Contract
                    </Button>
                  )}
                  {staff.contract_status === "signed" && (
                    <Button size="sm" variant="outline" onClick={() => setContractOpen(true)}>
                      <FileText className="mr-1 h-3.5 w-3.5" /> View Signed Contract
                    </Button>
                  )}
                  {!staff.contract_status || staff.contract_status === "draft" ? (
                    <Button size="sm" variant="secondary" onClick={() => generateContractMutation.mutate()}>
                      Generate Contract
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ContractPreviewDialog staff={staff} open={contractOpen} onOpenChange={setContractOpen} />
    </>
  );
}
