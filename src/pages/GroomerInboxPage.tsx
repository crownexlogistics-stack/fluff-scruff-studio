import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GroomerLayout } from "@/components/GroomerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Inbox, MessageSquare, Send, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function GroomerInboxPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [replyText, setReplyText] = useState("");

  const { data: staffRecord } = useQuery({
    queryKey: ["my-staff-record", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("id, name").eq("auth_user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["my-assigned-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salon_emails")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["email-replies-groomer", selectedEmail?.id],
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

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmail || !replyText.trim() || !staffRecord) return;
      const signedReply = `${replyText.trim()}\n\n— Fluff and Scruff Team`;

      const { error: replyErr } = await supabase.from("email_replies").insert({
        email_id: selectedEmail.id,
        reply_body: signedReply,
        replied_by: staffRecord.id,
      });
      if (replyErr) throw replyErr;

      const { error: updateErr } = await supabase
        .from("salon_emails")
        .update({ status: "replied", last_reply_body: signedReply })
        .eq("id", selectedEmail.id);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["my-assigned-emails"] });
      queryClient.invalidateQueries({ queryKey: ["email-replies-groomer", selectedEmail?.id] });
      toast({ title: "Reply sent", description: "Your reply has been saved." });
    },
    onError: () => {
      toast({ title: "Failed to send reply", variant: "destructive" });
    },
  });

  return (
    <GroomerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6" /> My Messages
          </h1>
          <p className="text-muted-foreground text-sm">Emails assigned to you</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : emails.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No emails assigned to you yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {emails.map((email: any) => (
              <Card
                key={email.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => { setSelectedEmail(email); setReplyText(""); }}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={email.status === "replied" ? "secondary" : "default"} className="text-xs">
                      {email.status === "replied" ? "Replied" : "Needs Reply"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(email.created_at), "dd MMM yyyy HH:mm")}
                    </span>
                  </div>
                  <p className="font-medium text-foreground">{email.subject || "(No subject)"}</p>
                  <p className="text-sm text-muted-foreground">{email.customer_name || email.customer_email}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reply Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {selectedEmail?.subject || "(No subject)"}
            </DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>From:</strong> {selectedEmail.customer_name} &lt;{selectedEmail.customer_email}&gt;</p>
                <p><strong>Received:</strong> {format(new Date(selectedEmail.created_at), "dd MMM yyyy HH:mm")}</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                {selectedEmail.body || "(No body)"}
              </div>

              {replies.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">Previous Replies</h3>
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

              {selectedEmail.status !== "closed" && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Reply will be signed as "Fluff and Scruff Team"
                  </p>
                  <Button
                    onClick={() => replyMutation.mutate()}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {replyMutation.isPending ? "Sending..." : "Send Reply"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </GroomerLayout>
  );
}
