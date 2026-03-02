import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Mail, Phone, Dog, Calendar, StickyNote, Send,
  Pencil, Check, X, User, MessageSquare, MailOpen,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function CustomerProfilePage() {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();
  const decodedEmail = decodeURIComponent(email || "");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [newNote, setNewNote] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [bookingTab, setBookingTab] = useState("upcoming");

  // Message state
  const [newMessage, setNewMessage] = useState("");

  // Email state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // ── Data queries ──────────────────────────────────────────────────

  const { data: bookings, isLoading: loadingBookings } = useQuery({
    queryKey: ["customer-profile-bookings", decodedEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, staff:staff_id(name), service:service_id(name), breed:breed_id(name)")
        .eq("customer_email", decodedEmail)
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!decodedEmail,
  });

  const { data: customerUserId } = useQuery({
    queryKey: ["customer-user-id", decodedEmail],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_id_by_email", { _email: decodedEmail });
      if (error) return null;
      return data as string | null;
    },
    enabled: !!decodedEmail,
  });

  const { data: customerPets } = useQuery({
    queryKey: ["customer-profile-pets", customerUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_pets")
        .select("*, breed:breed_id(name, size_category)")
        .eq("user_id", customerUserId!);
      if (error) return [];
      return data;
    },
    enabled: !!customerUserId,
  });

  const { data: notes } = useQuery({
    queryKey: ["customer-notes", decodedEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_notes")
        .select("*")
        .eq("customer_email", decodedEmail)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!decodedEmail,
  });

  const { data: staffProfiles } = useQuery({
    queryKey: ["staff-profiles-for-notes"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data || [];
    },
  });

  // Communications (messages + emails)
  const { data: messages } = useQuery({
    queryKey: ["customer-messages", decodedEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_communications")
        .select("*")
        .eq("customer_email", decodedEmail)
        .eq("type", "message")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!decodedEmail,
  });

  const { data: emails } = useQuery({
    queryKey: ["customer-emails", decodedEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_communications")
        .select("*")
        .eq("customer_email", decodedEmail)
        .eq("type", "email")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!decodedEmail,
  });

  // ── Mutations ─────────────────────────────────────────────────────

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase.from("customer_notes").insert({
        customer_email: decodedEmail,
        note,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewNote("");
      queryClient.invalidateQueries({ queryKey: ["customer-notes", decodedEmail] });
      toast({ title: "Note added" });
    },
    onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("customer_communications").insert({
        customer_email: decodedEmail,
        type: "message",
        body,
        direction: "outbound",
        sent_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["customer-messages", decodedEmail] });
      toast({ title: "Message saved" });
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({ subject, body }: { subject: string; body: string }) => {
      const { data, error } = await supabase.functions.invoke("send-customer-email", {
        body: { customer_email: decodedEmail, subject, body },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      setEmailSubject("");
      setEmailBody("");
      queryClient.invalidateQueries({ queryKey: ["customer-emails", decodedEmail] });
      toast({ title: "Email sent successfully" });
    },
    onError: (err: any) => toast({ title: `Failed to send email: ${err.message}`, variant: "destructive" }),
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (updates: { name: string; email: string; phone: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({
          customer_name: updates.name,
          customer_email: updates.email,
          customer_phone: updates.phone,
        })
        .eq("customer_email", decodedEmail);
      if (error) throw error;

      if (updates.email !== decodedEmail) {
        await supabase
          .from("customer_notes")
          .update({ customer_email: updates.email })
          .eq("customer_email", decodedEmail);
        await supabase
          .from("customer_communications")
          .update({ customer_email: updates.email })
          .eq("customer_email", decodedEmail);
      }
    },
    onSuccess: (_, variables) => {
      setIsEditing(false);
      toast({ title: "Customer details updated" });
      if (variables.email !== decodedEmail) {
        navigate(`/admin/customers/${encodeURIComponent(variables.email)}`, { replace: true });
      }
      queryClient.invalidateQueries({ queryKey: ["customer-profile-bookings"] });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  // ── Derived data ──────────────────────────────────────────────────

  const customerName = bookings?.[0]?.customer_name || "Customer";
  const customerPhone = bookings?.find((b) => b.customer_phone)?.customer_phone || "";
  const initials = customerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const today = new Date().toISOString().split("T")[0];
  const upcomingBookings =
    bookings?.filter((b) => b.booking_date >= today && b.status !== "Cancelled") || [];
  const pastBookings =
    bookings?.filter((b) => b.booking_date < today || b.status === "Cancelled") || [];

  const getStaffName = (userId: string) =>
    staffProfiles?.find((p) => p.id === userId)?.full_name || "Unknown";

  const startEditing = () => {
    setEditName(customerName);
    setEditEmail(decodedEmail);
    setEditPhone(customerPhone);
    setIsEditing(true);
  };

  const saveEdits = () => {
    if (!editName.trim() || !editEmail.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    updateCustomerMutation.mutate({
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
    });
  };

  const tabTriggerClass = "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4";

  // ── Render ────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-0 max-w-5xl">
        {/* Back */}
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        {/* ═══ HEADER CARD ═══ */}
        <Card className="rounded-b-none">
          <CardContent className="p-6">
            <div className="flex items-start gap-5">
              <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-primary">{initials}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  {isEditing ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-xl font-bold h-9 max-w-xs"
                    />
                  ) : (
                    <h1 className="text-2xl font-heading font-bold truncate">{customerName}</h1>
                  )}
                </div>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary">
                    {bookings?.length || 0} booking{(bookings?.length || 0) !== 1 ? "s" : ""}
                  </Badge>
                  {(bookings?.length || 0) >= 2 && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Returning Customer
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                {isEditing ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveEdits}
                      disabled={updateCustomerMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" /> Save
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={startEditing}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
              </div>
            </div>

            <Separator className="my-5" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Primary email
                </p>
                {isEditing ? (
                  <Input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium truncate">{decodedEmail}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Primary phone
                </p>
                {isEditing ? (
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="+44 ..."
                  />
                ) : (
                  <p className="text-sm font-medium">{customerPhone || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Total spend</p>
                <p className="text-sm font-medium">
                  £{bookings?.reduce((sum, b) => sum + Number(b.total_price), 0).toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ TABS ═══ */}
        <Tabs defaultValue="overview" className="w-full">
          <div className="border border-t-0 rounded-b-lg bg-card px-2">
            <TabsList className="bg-transparent h-12 w-full justify-start gap-0 rounded-none border-b">
              <TabsTrigger value="overview" className={tabTriggerClass}>Overview</TabsTrigger>
              <TabsTrigger value="notes" className={tabTriggerClass}>
                Notes {notes && notes.length > 0 && `(${notes.length})`}
              </TabsTrigger>
              <TabsTrigger value="bookings" className={tabTriggerClass}>Bookings</TabsTrigger>
              <TabsTrigger value="messages" className={tabTriggerClass}>
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Messages {messages && messages.length > 0 && `(${messages.length})`}
              </TabsTrigger>
              <TabsTrigger value="email" className={tabTriggerClass}>
                <MailOpen className="h-3.5 w-3.5 mr-1.5" />
                Email {emails && emails.length > 0 && `(${emails.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Dog className="h-4 w-4" /> Registered Dogs
                </h3>
                {customerPets && customerPets.length > 0 ? (
                  <div className="space-y-2">
                    {customerPets.map((pet) => (
                      <div
                        key={pet.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div>
                          <p className="font-medium text-sm">{pet.pet_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(pet.breed as any)?.name || "Breed not set"}
                            {pet.dog_age_years != null &&
                              ` • ${pet.dog_age_years}y ${pet.dog_age_months || 0}m`}
                            {(pet.breed as any)?.size_category &&
                              ` • ${(pet.breed as any).size_category}`}
                          </p>
                        </div>
                        {pet.notes && (
                          <p className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {pet.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No dogs registered yet.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Total Bookings" value={String(bookings?.length || 0)} />
              <MiniStat label="Upcoming" value={String(upcomingBookings.length)} />
              <MiniStat
                label="Completed"
                value={String(bookings?.filter((b) => b.status === "Completed").length || 0)}
              />
              <MiniStat
                label="No Shows"
                value={String(bookings?.filter((b) => b.status === "No Show").length || 0)}
              />
            </div>
          </TabsContent>

          {/* ── Notes ── */}
          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a note about this customer..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <Button
                    size="icon"
                    className="shrink-0 self-end"
                    disabled={!newNote.trim() || addNoteMutation.isPending}
                    onClick={() => addNoteMutation.mutate(newNote.trim())}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {notes && notes.length > 0 ? (
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div key={note.id} className="p-3 rounded-lg border bg-muted/30">
                        <p className="text-sm">{note.note}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getStaffName(note.created_by)} •{" "}
                          {format(new Date(note.created_at), "dd MMM yyyy, HH:mm")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Bookings ── */}
          <TabsContent value="bookings" className="mt-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Bookings
                  </h3>
                </div>

                <Tabs value={bookingTab} onValueChange={setBookingTab}>
                  <TabsList className="bg-transparent h-9 p-0 gap-4 justify-start">
                    <TabsTrigger
                      value="upcoming"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 h-auto text-sm"
                    >
                      Upcoming ({upcomingBookings.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="past"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 h-auto text-sm"
                    >
                      Past ({pastBookings.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="upcoming" className="mt-3">
                    {upcomingBookings.length > 0 ? (
                      <div className="space-y-2">
                        {upcomingBookings.map((b) => (
                          <BookingRow key={b.id} booking={b} />
                        ))}
                      </div>
                    ) : (
                      <EmptyBookings />
                    )}
                  </TabsContent>

                  <TabsContent value="past" className="mt-3">
                    {pastBookings.length > 0 ? (
                      <div className="space-y-2">
                        {pastBookings.map((b) => (
                          <BookingRow key={b.id} booking={b} />
                        ))}
                      </div>
                    ) : (
                      <EmptyBookings />
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Messages ── */}
          <TabsContent value="messages" className="mt-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
                  <MessageSquare className="h-4 w-4" /> Send Message
                </h3>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type a message to this customer..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <Button
                    size="icon"
                    className="shrink-0 self-end"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    onClick={() => sendMessageMutation.mutate(newMessage.trim())}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                <Separator />

                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message History</h4>

                {messages && messages.length > 0 ? (
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div key={msg.id} className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {msg.direction === "outbound" ? "Sent" : "Received"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.created_at), "dd MMM yyyy, HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        {msg.sent_by && (
                          <p className="text-xs text-muted-foreground mt-1">
                            by {getStaffName(msg.sent_by)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="font-medium text-sm">No messages yet</p>
                    <p className="text-xs text-muted-foreground">Send a message to start the conversation.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Email ── */}
          <TabsContent value="email" className="mt-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
                  <MailOpen className="h-4 w-4" /> Send Email
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">To: {decodedEmail}</p>
                    <Input
                      placeholder="Subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </div>
                  <Textarea
                    placeholder="Write your email here..."
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="min-h-[120px]"
                  />
                  <div className="flex justify-end">
                    <Button
                      disabled={!emailSubject.trim() || !emailBody.trim() || sendEmailMutation.isPending}
                      onClick={() =>
                        sendEmailMutation.mutate({
                          subject: emailSubject.trim(),
                          body: emailBody.trim(),
                        })
                      }
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email History</h4>

                {emails && emails.length > 0 ? (
                  <div className="space-y-2">
                    {emails.map((em) => (
                      <div key={em.id} className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium">{em.subject || "(No subject)"}</p>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(em.created_at), "dd MMM yyyy, HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{em.body}</p>
                        {em.sent_by && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Sent by {getStaffName(em.sent_by)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Mail className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="font-medium text-sm">No emails sent yet</p>
                    <p className="text-xs text-muted-foreground">Compose an email above to get started.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-2xl font-bold font-heading">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function BookingRow({ booking }: { booking: any }) {
  const staffName = (booking.staff as any)?.name;
  const serviceName = (booking.service as any)?.name;
  const breedName = (booking.breed as any)?.name;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {serviceName || "Service"} — {booking.dog_name}
          {breedName && <span className="text-muted-foreground"> ({breedName})</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(booking.booking_date), "EEE, dd MMM yyyy")} at{" "}
          {booking.booking_time?.slice(0, 5)}
          {staffName && ` • with ${staffName}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant={
            booking.status === "Confirmed"
              ? "default"
              : booking.status === "Completed"
              ? "secondary"
              : booking.status === "No Show" || booking.status === "Cancelled"
              ? "destructive"
              : "secondary"
          }
        >
          {booking.status}
        </Badge>
        <span className="text-sm font-medium">£{Number(booking.total_price).toFixed(2)}</span>
      </div>
    </div>
  );
}

function EmptyBookings() {
  return (
    <div className="text-center py-10">
      <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
      <p className="font-medium text-sm">No bookings found</p>
      <p className="text-xs text-muted-foreground">This section will update as bookings come in.</p>
    </div>
  );
}
