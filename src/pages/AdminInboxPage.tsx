import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Inbox, Clock, UserCheck, MessageSquare, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { label: "Pending", variant: "destructive", icon: Clock },
  assigned: { label: "Assigned", variant: "default", icon: UserCheck },
  replied: { label: "Replied", variant: "secondary", icon: MessageSquare },
  closed: { label: "Closed", variant: "outline", icon: CheckCircle },
};

export default function AdminInboxPage() {
  const queryClient = useQueryClient();
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["salon-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salon_emails")
        .select("*, staff:assigned_staff_id(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["email-replies", selectedEmail?.id],
    enabled: !!selectedEmail,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_replies")
        .select("*, staff:replied_by(name)")
        .eq("email_id", selectedEmail.id)
        .order("replied_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ emailId, staffId }: { emailId: string; staffId: string }) => {
      const { error } = await supabase
        .from("salon_emails")
        .update({ assigned_staff_id: staffId, status: "assigned" })
        .eq("id", emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salon-emails"] });
      toast({ title: "Email assigned", description: "The email has been assigned to the groomer." });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase.from("salon_emails").update({ status: "closed" }).eq("id", emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salon-emails"] });
      setSelectedEmail(null);
      toast({ title: "Email closed" });
    },
  });

  const filtered = statusFilter === "all" ? emails : emails.filter((e: any) => e.status === statusFilter);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <Inbox className="h-6 w-6" /> Shared Inbox
            </h1>
            <p className="text-muted-foreground text-sm">Manage and assign incoming emails</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="replied">Replied</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No emails found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((email: any) => {
              const sc = statusConfig[email.status] || statusConfig.pending;
              const Icon = sc.icon;
              return (
                <Card
                  key={email.id}
                  className="cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => setSelectedEmail(email)}
                >
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={sc.variant} className="text-xs">
                          <Icon className="h-3 w-3 mr-1" />
                          {sc.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(email.created_at), "dd MMM yyyy HH:mm")}
                        </span>
                      </div>
                      <p className="font-medium text-foreground truncate">{email.subject || "(No subject)"}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {email.customer_name || email.customer_email}
                      </p>
                    </div>
                    <div className="shrink-0 w-48" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={email.assigned_staff_id || ""}
                        onValueChange={(val) => assignMutation.mutate({ emailId: email.id, staffId: val })}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Assign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {staffList.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEmail?.subject || "(No subject)"}</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>From:</strong> {selectedEmail.customer_name} &lt;{selectedEmail.customer_email}&gt;</p>
                <p><strong>Received:</strong> {format(new Date(selectedEmail.created_at), "dd MMM yyyy HH:mm")}</p>
                <p><strong>Status:</strong> {statusConfig[selectedEmail.status]?.label}</p>
                {selectedEmail.staff && <p><strong>Assigned to:</strong> {(selectedEmail.staff as any).name}</p>}
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                {selectedEmail.body || "(No body)"}
              </div>

              {replies.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">Replies</h3>
                  {replies.map((r: any) => (
                    <div key={r.id} className="bg-primary/5 rounded-lg p-3 text-sm">
                      <p className="text-xs text-muted-foreground mb-1">
                        {(r.staff as any)?.name || "Staff"} — {format(new Date(r.replied_at), "dd MMM HH:mm")}
                      </p>
                      <p className="whitespace-pre-wrap">{r.reply_body}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                {selectedEmail.status !== "closed" && (
                  <Button variant="outline" onClick={() => closeMutation.mutate(selectedEmail.id)}>
                    Close Email
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
