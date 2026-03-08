import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { GroomerLayout } from "@/components/GroomerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Mail, Phone, Dog, Calendar, Send,
  Pencil, Check, X, MessageSquare, MailOpen, Ban, CalendarPlus, UserCheck, ChevronDown, ChevronUp,
} from "lucide-react";
import { AdminPetTools } from "@/components/customer-profile/AdminPetTools";
import { format, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { logAudit } from "@/lib/auditLog";
import { NewAppointmentDialog } from "@/components/customer-profile/NewAppointmentDialog";
import { ViewOrderDialog } from "@/components/booking-calendar/ViewOrderDialog";

export default function CustomerProfilePage() {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();
  const decodedEmail = decodeURIComponent(email || "");
  const { user } = useAuth();
  const { role } = useUserRole(user?.id);
  const queryClient = useQueryClient();
  const isGroomer = role === "groomer";

  const [newNote, setNewNote] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [bookingTab, setBookingTab] = useState("upcoming");
  const [newApptOpen, setNewApptOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [viewBookingOpen, setViewBookingOpen] = useState(false);
  const [viewBookingData, setViewBookingData] = useState<any>(null);

  // Pet edit dialog
  const [editingPet, setEditingPet] = useState<any>(null);
  const [petForm, setPetForm] = useState({ pet_name: "", breed_id: "", dog_age_years: 0, dog_age_months: 0, notes: "" });
  const [expandedPetId, setExpandedPetId] = useState<string | null>(null);

  // Booking edit dialog
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [bookingForm, setBookingForm] = useState({
    booking_date: "", booking_time: "", service_id: "", breed_id: "", staff_id: "",
    total_price: 0, deposit_paid: 0, notes: "",
  });

  // ── Get groomer's staff record ──
  const { data: groomerStaff } = useQuery({
    queryKey: ["groomer-staff-record", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff")
        .select("id, name")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // ── Data queries ──────────────────────────────────────────────────

  const { data: bookings } = useQuery({
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

  // Fetch migrated bookings for this customer
  const { data: migratedBookings } = useQuery({
    queryKey: ["customer-migrated-bookings", decodedEmail],
    queryFn: async () => {
      // Find migrated customer by email
      const { data: mc } = await supabase
        .from("migrated_customers")
        .select("id")
        .ilike("email", decodedEmail)
        .limit(1);
      if (!mc || mc.length === 0) return [];
      const { data, error } = await supabase
        .from("migrated_bookings")
        .select("*")
        .eq("migrated_customer_id", mc[0].id)
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return (data || []).map((b: any) => ({ ...b, _source: "wix" }));
    },
    enabled: !!decodedEmail,
  });

  // Check if this customer is "owned" by the groomer
  const isOwnCustomer = !isGroomer || (bookings || []).some(
    (b) => b.staff_id === groomerStaff?.id
  );
  const canManageCustomer = !isGroomer || isOwnCustomer;

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
    enabled: !!decodedEmail && isOwnCustomer,
  });

  // Emails: combine outbound (customer_communications) + inbound (customer_messages)
  const { data: outboundEmails } = useQuery({
    queryKey: ["customer-emails-out", decodedEmail],
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
    enabled: !!decodedEmail && isOwnCustomer,
  });

  const { data: inboundEmails } = useQuery({
    queryKey: ["customer-emails-in", decodedEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_messages")
        .select("*")
        .eq("from_email", decodedEmail)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!decodedEmail && isOwnCustomer,
  });

  // Combine & sort all emails
  const allEmails = [
    ...(outboundEmails || []).map((e) => ({ ...e, direction: "outbound" as const, displaySubject: e.subject })),
    ...(inboundEmails || []).map((e) => ({
      id: e.id,
      created_at: e.created_at,
      direction: "inbound" as const,
      displaySubject: e.subject || "(No subject)",
      body: e.body || "",
      from_name: e.from_name,
      sent_by: null as string | null,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Lookup data for edit dialogs
  const { data: allBreeds } = useQuery({
    queryKey: ["breeds-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breeds").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allServices } = useQuery({
    queryKey: ["services-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allStaff } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase.from("customer_notes").insert({
        customer_email: decodedEmail, note, created_by: user!.id,
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
        customer_email: decodedEmail, type: "message", body, direction: "outbound", sent_by: user!.id,
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
      queryClient.invalidateQueries({ queryKey: ["customer-emails-out", decodedEmail] });
      toast({ title: "Email sent successfully" });
    },
    onError: (err: any) => toast({ title: `Failed to send email: ${err.message}`, variant: "destructive" }),
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (updates: { name: string; email: string; phone: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ customer_name: updates.name, customer_email: updates.email, customer_phone: updates.phone })
        .eq("customer_email", decodedEmail);
      if (error) throw error;
      if (updates.email !== decodedEmail) {
        await supabase.from("customer_notes").update({ customer_email: updates.email }).eq("customer_email", decodedEmail);
        await supabase.from("customer_communications").update({ customer_email: updates.email }).eq("customer_email", decodedEmail);
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

  // Pet update mutation
  const updatePetMutation = useMutation({
    mutationFn: async (pet: { id: string; pet_name: string; breed_id: string | null; dog_age_years: number | null; dog_age_months: number | null; notes: string | null }) => {
      const { error } = await supabase.from("customer_pets").update({
        pet_name: pet.pet_name,
        breed_id: pet.breed_id || null,
        dog_age_years: pet.dog_age_years,
        dog_age_months: pet.dog_age_months,
        notes: pet.notes || null,
      }).eq("id", pet.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingPet(null);
      queryClient.invalidateQueries({ queryKey: ["customer-profile-pets"] });
      toast({ title: "Pet updated" });
    },
    onError: () => toast({ title: "Failed to update pet", variant: "destructive" }),
  });

  // Booking update mutation
  const updateBookingMutation = useMutation({
    mutationFn: async () => {
      if (!editingBooking) return;
      const { error } = await supabase.from("bookings").update({
        booking_date: bookingForm.booking_date,
        booking_time: bookingForm.booking_time,
        service_id: bookingForm.service_id || null,
        breed_id: bookingForm.breed_id || null,
        staff_id: bookingForm.staff_id || null,
        total_price: bookingForm.total_price,
        deposit_paid: bookingForm.deposit_paid,
        notes: bookingForm.notes || null,
      }).eq("id", editingBooking.id);
      if (error) throw error;
      logAudit({
        staffId: bookingForm.staff_id || undefined,
        action: "BOOKING_EDITED",
        details: `Edited booking for ${editingBooking.customer_name} on ${bookingForm.booking_date}`,
      });
    },
    onSuccess: () => {
      setEditingBooking(null);
      queryClient.invalidateQueries({ queryKey: ["customer-profile-bookings", decodedEmail] });
      toast({ title: "Booking updated" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from("bookings").update({ status: "Cancelled" }).eq("id", bookingId);
      if (error) throw error;
      logAudit({ action: "BOOKING_CANCELLED", details: `Cancelled booking ${bookingId}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-profile-bookings", decodedEmail] });
      toast({ title: "Booking cancelled" });
    },
    onError: () => toast({ title: "Failed to cancel", variant: "destructive" }),
  });

  // ── Derived data ──────────────────────────────────────────────────

  const customerName = bookings?.[0]?.customer_name || "Customer";
  const customerPhone = bookings?.find((b) => b.customer_phone)?.customer_phone || "";
  const initials = customerName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const today = new Date().toISOString().split("T")[0];
  const upcomingBookings = bookings?.filter((b) => b.booking_date >= today && b.status !== "Cancelled") || [];
  const pastBookings = [
    ...(bookings?.filter((b) => b.booking_date < today || b.status === "Cancelled") || []),
    ...migratedAsBookings,
  ].sort((a, b) => b.booking_date.localeCompare(a.booking_date));
  const fallbackDogsFromBookings = Array.from(
    new Map(
      (bookings || [])
        .filter((b) => b.dog_name?.trim())
        .map((b) => [
          b.dog_name.trim().toLowerCase(),
          {
            id: `booking-dog-${b.id}`,
            pet_name: b.dog_name,
            breed_id: b.breed_id || null,
            dog_age_years: null,
            dog_age_months: null,
            notes: null,
            breed: b.breed || null,
            is_from_booking: true,
          },
        ])
    ).values()
  );
  const visibleDogs = customerPets && customerPets.length > 0 ? customerPets : fallbackDogsFromBookings;

  // Own Customer status — true if ANY booking for this customer is flagged
  const customerIsOwn = (bookings || []).some((b) => b.is_groomers_own_customer);

  const toggleOwnCustomerMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const { error } = await supabase
        .from("bookings")
        .update({ is_groomers_own_customer: newValue } as any)
        .eq("customer_email", decodedEmail);
      if (error) throw error;
      logAudit({
        action: newValue ? "CUSTOMER_MARKED_OWN" : "CUSTOMER_UNMARKED_OWN",
        details: `${customerName} (${decodedEmail}) marked as ${newValue ? "Own Customer" : "Salon Customer"}`,
      });
    },
    onSuccess: (_, newValue) => {
      queryClient.invalidateQueries({ queryKey: ["customer-profile-bookings", decodedEmail] });
      toast({ title: newValue ? "Marked as Own Customer (50% commission)" : "Set to Salon Customer (40% commission)" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const getStaffName = (userId: string) => staffProfiles?.find((p) => p.id === userId)?.full_name || "Unknown";

  const startEditing = () => { setEditName(customerName); setEditEmail(decodedEmail); setEditPhone(customerPhone); setIsEditing(true); };

  const saveEdits = () => {
    if (!editName.trim() || !editEmail.trim()) { toast({ title: "Name and email are required", variant: "destructive" }); return; }
    updateCustomerMutation.mutate({ name: editName.trim(), email: editEmail.trim(), phone: editPhone.trim() });
  };

  const openPetEdit = (pet: any) => {
    setEditingPet(pet);
    setPetForm({
      pet_name: pet.pet_name,
      breed_id: pet.breed_id || "",
      dog_age_years: pet.dog_age_years || 0,
      dog_age_months: pet.dog_age_months || 0,
      notes: pet.notes || "",
    });
  };

  const openBookingEdit = (booking: any) => {
    setEditingBooking(booking);
    setBookingForm({
      booking_date: booking.booking_date,
      booking_time: booking.booking_time?.slice(0, 5) || "",
      service_id: booking.service_id || "",
      breed_id: booking.breed_id || "",
      staff_id: booking.staff_id || "",
      total_price: Number(booking.total_price),
      deposit_paid: Number(booking.deposit_paid),
      notes: booking.notes || "",
    });
  };

  const tabTriggerClass = "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4";

  // Find last groomer for non-own customers
  const lastGroomerName = bookings?.[0]?.staff ? (bookings[0].staff as any).name : null;

  // ── Layout wrapper ────────────────────────────────────────────────
  const Layout = isGroomer ? GroomerLayout : AppLayout;

  // ── LIMITED VIEW for groomers viewing non-own customer ────────────
  if (isGroomer && !isOwnCustomer && bookings) {
    return (
      <Layout>
        <div className="space-y-0 max-w-5xl px-0">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-lg sm:text-xl font-bold text-muted-foreground">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-heading font-bold truncate">{customerName}</h1>
                  {lastGroomerName && (
                    <p className="text-sm text-muted-foreground mt-1">Last groomed by <span className="font-medium">{lastGroomerName}</span></p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rebook action */}
          <Card className="mt-4">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <CalendarPlus className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Book This Customer</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                This customer was last groomed by {lastGroomerName || "another groomer"}. You can create a new booking for them.
              </p>
              <Button onClick={() => navigate("/book")}>
                <CalendarPlus className="h-4 w-4 mr-2" /> Create Booking
              </Button>
            </CardContent>
          </Card>

          {/* Notes section - visible to groomer, management, director */}
          <Card className="mt-4">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold">Notes</h3>
              <div className="flex gap-2">
                <Textarea placeholder="Add a note about this customer..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[60px]" />
                <Button size="icon" className="shrink-0 self-end" disabled={!newNote.trim() || addNoteMutation.isPending} onClick={() => addNoteMutation.mutate(newNote.trim())}><Send className="h-4 w-4" /></Button>
              </div>
              {(() => {
                const staffNotes = (notes || []).map((n: any) => ({
                  type: "staff" as const, id: n.id, text: n.note, date: new Date(n.created_at), author: getStaffName(n.created_by),
                }));
                const bookingNotes = (bookings || [])
                  .filter((b: any) => b.notes && b.notes.trim())
                  .map((b: any) => ({
                    type: "customer" as const, id: `booking-note-${b.id}`, text: b.notes, date: new Date(b.created_at),
                    serviceName: (b.service as any)?.name || "Grooming", bookingDate: b.booking_date,
                  }));
                const allNotes = [...staffNotes, ...bookingNotes].sort((a, b) => b.date.getTime() - a.date.getTime());
                if (allNotes.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>;
                return (
                  <div className="space-y-2">
                    {allNotes.map((note) =>
                      note.type === "customer" ? (
                        <div key={note.id} className="p-3 rounded-lg border" style={{ borderLeft: "4px solid #FF6B35", backgroundColor: "#FFF3E0" }}>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#FF6B35" }}>🐾 Customer Note</span>
                          <p className="text-sm mt-1" style={{ color: "#2D1B0E" }}>{note.text}</p>
                          <p className="text-xs mt-1.5" style={{ color: "#2D1B0E", opacity: 0.6 }}>From booking — {note.serviceName} on {format(new Date(note.bookingDate), "dd MMM yyyy")}</p>
                        </div>
                      ) : (
                        <div key={note.id} className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-sm">{note.text}</p>
                          <p className="text-xs text-muted-foreground mt-1">{note.author} • {format(note.date, "dd MMM yyyy, HH:mm")}</p>
                        </div>
                      )
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // ── FULL RENDER (admin/manager/director OR groomer's own customer) ──

  return (
    <Layout>
      <div className="space-y-0 max-w-5xl px-0">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        {/* ═══ HEADER CARD ═══ */}
        <Card className="rounded-b-none">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
              <div className="flex items-center gap-3 sm:block">
                <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-lg sm:text-xl font-bold text-primary">{initials}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-lg sm:text-xl font-bold h-9 w-full" />
                    ) : (
                      <h1 className="text-xl sm:text-2xl font-heading font-bold truncate">{customerName}</h1>
                    )}
                  </div>
                  {canManageCustomer && (
                    <div className="flex gap-2 shrink-0">
                      {isEditing ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}><X className="h-4 w-4" /><span className="hidden sm:inline ml-1">Cancel</span></Button>
                          <Button size="sm" onClick={saveEdits} disabled={updateCustomerMutation.isPending}><Check className="h-4 w-4" /><span className="hidden sm:inline ml-1">Save</span></Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={startEditing}><Pencil className="h-4 w-4" /><span className="hidden sm:inline ml-1">Edit</span></Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="secondary">{bookings?.length || 0} booking{(bookings?.length || 0) !== 1 ? "s" : ""}</Badge>
                  {(bookings?.length || 0) >= 2 && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Returning</Badge>
                  )}
                  {customerIsOwn && (
                    <Badge className="bg-accent/15 text-accent border-accent/30"><UserCheck className="h-3 w-3 mr-1" />Own Customer</Badge>
                  )}
                </div>
              </div>
            </div>
            <Separator className="my-5" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> Primary email</p>
                {isEditing ? <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8 text-sm" /> : <p className="text-sm font-medium truncate">{decodedEmail}</p>}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Phone className="h-3 w-3" /> Primary phone</p>
                {isEditing ? <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-8 text-sm" placeholder="+44 ..." /> : <p className="text-sm font-medium">{customerPhone || "—"}</p>}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Total spend</p>
                <p className="text-sm font-medium">£{bookings?.reduce((sum, b) => sum + Number(b.total_price), 0).toFixed(2) || "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ TABS ═══ */}
        <Tabs defaultValue="overview" className="w-full">
          <div className="border border-t-0 rounded-b-lg bg-card px-2">
            <TabsList className="bg-transparent h-auto min-h-[3rem] w-full justify-start gap-0 rounded-none border-b flex-wrap py-1">
              <TabsTrigger value="overview" className={tabTriggerClass}>Overview</TabsTrigger>
              <TabsTrigger value="notes" className={tabTriggerClass}>Notes {((notes?.length || 0) + (bookings?.filter((b: any) => b.notes?.trim()).length || 0)) > 0 && `(${(notes?.length || 0) + (bookings?.filter((b: any) => b.notes?.trim()).length || 0)})`}</TabsTrigger>
              <TabsTrigger value="bookings" className={tabTriggerClass}>Bookings</TabsTrigger>
              {isOwnCustomer && (
                <>
                  <TabsTrigger value="messages" className={tabTriggerClass}><MessageSquare className="h-3.5 w-3.5 mr-1.5" />Messages {messages && messages.length > 0 && `(${messages.length})`}</TabsTrigger>
                  <TabsTrigger value="email" className={tabTriggerClass}><MailOpen className="h-3.5 w-3.5 mr-1.5" />Email {allEmails.length > 0 && `(${allEmails.length})`}</TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Own Customer Toggle */}
            {canManageCustomer && (
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserCheck className="h-5 w-5 text-accent" />
                    <div>
                      <p className="text-sm font-semibold">Own Customer</p>
                      <p className="text-xs text-muted-foreground">
                        {customerIsOwn ? "50% commission rate applies" : "40% standard commission rate"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={customerIsOwn}
                    onCheckedChange={(checked) => toggleOwnCustomerMutation.mutate(checked)}
                    disabled={toggleOwnCustomerMutation.isPending}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Dog className="h-4 w-4" /> Registered Dogs</h3>
                {visibleDogs.length > 0 ? (
                  <div className="space-y-2">
                    {visibleDogs.map((pet: any) => (
                      <div key={pet.id}>
                        <div
                          className={`flex items-center justify-between p-3 rounded-lg border ${canManageCustomer && !pet.is_from_booking ? "hover:bg-muted/30 cursor-pointer" : ""} transition-colors`}
                          onClick={() => {
                            if (canManageCustomer && !pet.is_from_booking) {
                              setExpandedPetId(expandedPetId === pet.id ? null : pet.id);
                            }
                          }}
                        >
                          <div>
                            <p className="font-medium text-sm">{pet.pet_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(pet.breed as any)?.name || "Breed not set"}
                              {pet.dog_age_years != null && ` • ${pet.dog_age_years}y ${pet.dog_age_months || 0}m`}
                              {(pet.breed as any)?.size_category && ` • ${(pet.breed as any).size_category}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {canManageCustomer && !pet.is_from_booking && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openPetEdit(pet); }}>
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
                            {canManageCustomer && !pet.is_from_booking && (
                              expandedPetId === pet.id
                                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        {expandedPetId === pet.id && canManageCustomer && !pet.is_from_booking && customerUserId && (
                          <AdminPetTools
                            petId={pet.id}
                            petName={pet.pet_name}
                            customerUserId={customerUserId}
                            customerEmail={decodedEmail}
                            staffId={groomerStaff?.id || null}
                            staffName={groomerStaff?.name || "Staff"}
                          />
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
              <MiniStat label="Completed" value={String(bookings?.filter((b) => b.status === "Completed").length || 0)} />
              <MiniStat label="No Shows" value={String(bookings?.filter((b) => b.status === "No Show").length || 0)} />
            </div>
          </TabsContent>

          {/* ── Notes ── */}
          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex gap-2">
                  <Textarea placeholder="Add a note about this customer..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[60px]" />
                  <Button size="icon" className="shrink-0 self-end" disabled={!newNote.trim() || addNoteMutation.isPending} onClick={() => addNoteMutation.mutate(newNote.trim())}><Send className="h-4 w-4" /></Button>
                </div>
                {(() => {
                  // Merge staff notes + customer booking notes, sorted newest first
                  const staffNotes = (notes || []).map((n: any) => ({
                    type: "staff" as const,
                    id: n.id,
                    text: n.note,
                    date: new Date(n.created_at),
                    author: getStaffName(n.created_by),
                  }));
                  const bookingNotes = (bookings || [])
                    .filter((b: any) => b.notes && b.notes.trim())
                    .map((b: any) => ({
                      type: "customer" as const,
                      id: `booking-note-${b.id}`,
                      text: b.notes,
                      date: new Date(b.created_at),
                      serviceName: (b.service as any)?.name || "Grooming",
                      bookingDate: b.booking_date,
                    }));
                  const allNotes = [...staffNotes, ...bookingNotes].sort((a, b) => b.date.getTime() - a.date.getTime());

                  if (allNotes.length === 0) {
                    return <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>;
                  }

                  return (
                    <div className="space-y-2">
                      {allNotes.map((note) =>
                        note.type === "customer" ? (
                          <div
                            key={note.id}
                            className="p-3 rounded-lg border"
                            style={{ borderLeft: "4px solid #FF6B35", backgroundColor: "#FFF3E0" }}
                          >
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: "#FF6B35" }}
                            >
                              🐾 Customer Note
                            </span>
                            <p className="text-sm mt-1" style={{ color: "#2D1B0E" }}>{note.text}</p>
                            <p className="text-xs mt-1.5" style={{ color: "#2D1B0E", opacity: 0.6 }}>
                              From booking — {note.serviceName} on {format(new Date(note.bookingDate), "dd MMM yyyy")}
                            </p>
                          </div>
                        ) : (
                          <div key={note.id} className="p-3 rounded-lg border bg-muted/30">
                            <p className="text-sm">{note.text}</p>
                            <p className="text-xs text-muted-foreground mt-1">{note.author} • {format(note.date, "dd MMM yyyy, HH:mm")}</p>
                          </div>
                        )
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Bookings ── */}
          <TabsContent value="bookings" className="mt-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Bookings</h3>
                  <Button size="sm" onClick={() => setNewApptOpen(true)}>
                    <CalendarPlus className="h-4 w-4 mr-1.5" /> New Appointment
                  </Button>
                </div>
                <Tabs value={bookingTab} onValueChange={setBookingTab}>
                  <TabsList className="bg-transparent h-9 p-0 gap-4 justify-start">
                    <TabsTrigger value="upcoming" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 h-auto text-sm">Upcoming ({upcomingBookings.length})</TabsTrigger>
                    <TabsTrigger value="past" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 h-auto text-sm">Past ({pastBookings.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upcoming" className="mt-3">
                    {upcomingBookings.length > 0 ? (
                      <div className="space-y-2">
                        {upcomingBookings.map((b) => (
                          <BookingRow key={b.id} booking={b} onEdit={canManageCustomer ? () => openBookingEdit(b) : undefined} onCancel={canManageCustomer ? () => cancelBookingMutation.mutate(b.id) : undefined} showActions={canManageCustomer} onClick={() => {
                            setViewBookingData({
                              ...b,
                              staff_name: (b.staff as any)?.name || "Unassigned",
                              breed_name: (b.breed as any)?.name || "",
                              service_name: (b.service as any)?.name || "",
                            });
                            setViewBookingOpen(true);
                          }} />
                        ))}
                      </div>
                    ) : <EmptyBookings />}
                  </TabsContent>
                  <TabsContent value="past" className="mt-3">
                    {pastBookings.length > 0 ? (
                      <div className="space-y-2">
                        {pastBookings.map((b) => (
                          <BookingRow key={b.id} booking={b} onClick={() => {
                            setViewBookingData({
                              ...b,
                              staff_name: (b.staff as any)?.name || "Unassigned",
                              breed_name: (b.breed as any)?.name || "",
                              service_name: (b.service as any)?.name || "",
                            });
                            setViewBookingOpen(true);
                          }} />
                        ))}
                      </div>
                    ) : <EmptyBookings />}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Messages ── */}
          {isOwnCustomer && (
            <TabsContent value="messages" className="mt-4">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-1"><MessageSquare className="h-4 w-4" /> Send Message</h3>
                  <div className="flex gap-2">
                    <Textarea placeholder="Type a message to this customer..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="min-h-[60px]" />
                    <Button size="icon" className="shrink-0 self-end" disabled={!newMessage.trim() || sendMessageMutation.isPending} onClick={() => sendMessageMutation.mutate(newMessage.trim())}><Send className="h-4 w-4" /></Button>
                  </div>
                  <Separator />
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message History</h4>
                  {messages && messages.length > 0 ? (
                    <div className="space-y-2">
                      {messages.map((msg) => (
                        <div key={msg.id} className="p-3 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{msg.direction === "outbound" ? "Sent" : "Received"}</Badge>
                            <span className="text-xs text-muted-foreground">{format(new Date(msg.created_at), "dd MMM yyyy, HH:mm")}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          {msg.sent_by && <p className="text-xs text-muted-foreground mt-1">by {getStaffName(msg.sent_by)}</p>}
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
          )}

          {/* ── Email ── */}
          {isOwnCustomer && (
            <TabsContent value="email" className="mt-4">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-1"><MailOpen className="h-4 w-4" /> Send Email</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">To: {decodedEmail}</p>
                      <Input placeholder="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                    </div>
                    <Textarea placeholder="Write your email here..." value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className="min-h-[120px]" />
                    <div className="flex justify-end">
                      <Button disabled={!emailSubject.trim() || !emailBody.trim() || sendEmailMutation.isPending} onClick={() => sendEmailMutation.mutate({ subject: emailSubject.trim(), body: emailBody.trim() })}>
                        <Send className="h-4 w-4 mr-2" />{sendEmailMutation.isPending ? "Sending..." : "Send Email"}
                      </Button>
                    </div>
                  </div>
                  <Separator />
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email History</h4>
                  {allEmails.length > 0 ? (
                    <div className="space-y-2">
                      {allEmails.map((em) => (
                        <div key={em.id} className="p-3 rounded-lg border bg-muted/30">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant={em.direction === "inbound" ? "default" : "outline"} className="text-[10px] px-1.5 py-0 shrink-0">
                                {em.direction === "inbound" ? "Received" : "Sent"}
                              </Badge>
                              <p className="text-sm font-medium truncate">{em.displaySubject}</p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{format(new Date(em.created_at), "dd MMM yyyy, HH:mm")}</span>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{em.body}</p>
                          {em.direction === "inbound" && (em as any).from_name && (
                            <p className="text-xs text-muted-foreground mt-1">From: {(em as any).from_name}</p>
                          )}
                          {em.direction === "outbound" && em.sent_by && (
                            <p className="text-xs text-muted-foreground mt-1">Sent by {getStaffName(em.sent_by)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Mail className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="font-medium text-sm">No emails yet</p>
                      <p className="text-xs text-muted-foreground">Compose an email above or wait for customer replies.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ═══ EDIT PET DIALOG ═══ */}
      {canManageCustomer && (
        <Dialog open={!!editingPet} onOpenChange={(open) => { if (!open) setEditingPet(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Dog — {petForm.pet_name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Dog Name</Label>
                <Input value={petForm.pet_name} onChange={(e) => setPetForm({ ...petForm, pet_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Breed</Label>
                <Select value={petForm.breed_id} onValueChange={(v) => setPetForm({ ...petForm, breed_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select breed" /></SelectTrigger>
                  <SelectContent>
                    {allBreeds?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Age (years)</Label>
                  <Input
                    inputMode="numeric"
                    value={petForm.dog_age_years === 0 ? "" : String(petForm.dog_age_years)}
                    placeholder="e.g. 3"
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setPetForm({ ...petForm, dog_age_years: val ? parseInt(val, 10) : 0 });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Age (months)</Label>
                  <Input
                    inputMode="numeric"
                    value={petForm.dog_age_months === 0 ? "" : String(petForm.dog_age_months)}
                    placeholder="e.g. 6"
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      const num = val ? parseInt(val, 10) : 0;
                      setPetForm({ ...petForm, dog_age_months: Math.min(num, 11) });
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea value={petForm.notes} onChange={(e) => setPetForm({ ...petForm, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPet(null)}>Cancel</Button>
              <Button
                disabled={!petForm.pet_name.trim() || updatePetMutation.isPending}
                onClick={() => updatePetMutation.mutate({
                  id: editingPet.id,
                  pet_name: petForm.pet_name.trim(),
                  breed_id: petForm.breed_id || null,
                  dog_age_years: petForm.dog_age_years || null,
                  dog_age_months: petForm.dog_age_months || null,
                  notes: petForm.notes.trim() || null,
                })}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ═══ EDIT BOOKING DIALOG ═══ */}
      {canManageCustomer && (
        <Dialog open={!!editingBooking} onOpenChange={(open) => { if (!open) setEditingBooking(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Appointment — {editingBooking?.customer_name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={bookingForm.booking_date} onChange={(e) => setBookingForm({ ...bookingForm, booking_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Time</Label>
                  <Input type="time" value={bookingForm.booking_time} onChange={(e) => setBookingForm({ ...bookingForm, booking_time: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Staff Member</Label>
                <Select value={bookingForm.staff_id} onValueChange={(v) => setBookingForm({ ...bookingForm, staff_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>{allStaff?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1">
                  <Label>Service</Label>
                  <Select value={bookingForm.service_id} onValueChange={(v) => setBookingForm({ ...bookingForm, service_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                    <SelectContent>{allServices?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Breed</Label>
                  <Select value={bookingForm.breed_id} onValueChange={(v) => setBookingForm({ ...bookingForm, breed_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select breed" /></SelectTrigger>
                    <SelectContent>{allBreeds?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1">
                  <Label>Total Price (£)</Label>
                  <NumericInput value={bookingForm.total_price} onValueChange={(v) => setBookingForm({ ...bookingForm, total_price: v })} />
                </div>
                <div className="space-y-1">
                  <Label>Deposit (£)</Label>
                  <NumericInput value={bookingForm.deposit_paid} onValueChange={(v) => setBookingForm({ ...bookingForm, deposit_paid: v })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea value={bookingForm.notes} onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingBooking(null)}>Cancel</Button>
              <Button onClick={() => updateBookingMutation.mutate()} disabled={updateBookingMutation.isPending}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ═══ NEW APPOINTMENT DIALOG ═══ */}
      <NewAppointmentDialog
        open={newApptOpen}
        onOpenChange={setNewApptOpen}
        customerName={customerName}
        customerEmail={decodedEmail}
        customerPhone={customerPhone}
        dogName={visibleDogs?.[0]?.pet_name || bookings?.[0]?.dog_name || ""}
        breedId={visibleDogs?.[0]?.breed_id || bookings?.find((b) => !!b.breed_id)?.breed_id || ""}
        serviceId={bookings?.find((b) => !!b.service_id)?.service_id || ""}
        lastStaffId={bookings?.find((b) => !!b.staff_id)?.staff_id || ""}
      />

      {/* ═══ VIEW BOOKING DETAILS DIALOG ═══ */}
      <ViewOrderDialog
        open={viewBookingOpen}
        onOpenChange={setViewBookingOpen}
        booking={viewBookingData}
        userRole={role}
        onRefundComplete={() => queryClient.invalidateQueries({ queryKey: ["customer-profile-bookings", decodedEmail] })}
      />
    </Layout>
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

function BookingRow({ booking, onEdit, onCancel, showActions, onClick }: { booking: any; onEdit?: () => void; onCancel?: () => void; showActions?: boolean; onClick?: () => void }) {
  const staffName = (booking.staff as any)?.name;
  const serviceName = (booking.service as any)?.name;
  const breedName = (booking.breed as any)?.name;
  const deposit = Number(booking.deposit_paid);
  const total = Number(booking.total_price);
  const balanceDue = Math.max(0, total - deposit);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer" onClick={onClick}>
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {serviceName || "Service"} — {booking.dog_name}
          {breedName && <span className="text-muted-foreground"> ({breedName})</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(booking.booking_date), "EEE, dd MMM yyyy")} at {booking.booking_time?.slice(0, 5)}
          {staffName && ` • with ${staffName}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={booking.status === "Confirmed" ? "default" : booking.status === "Completed" ? "secondary" : booking.status === "No Show" || booking.status === "Cancelled" ? "destructive" : "secondary"}>
          {booking.status}
        </Badge>
        <div className="text-right">
          <span className="text-sm font-medium block">£{total.toFixed(2)}</span>
          {balanceDue > 0 && booking.status !== "Cancelled" && booking.status !== "Refunded" && (
            <span className="text-[10px] text-muted-foreground">Due: £{balanceDue.toFixed(2)}</span>
          )}
        </div>
        {showActions && (
          <>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit?.(); }} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onCancel?.(); }} title="Cancel">
              <Ban className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
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
