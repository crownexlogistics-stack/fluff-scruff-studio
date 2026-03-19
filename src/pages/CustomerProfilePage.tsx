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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft, Mail, Phone, Dog, Calendar, Send,
  Pencil, Check, X, MessageSquare, MailOpen, Ban, CalendarPlus, UserCheck, ChevronDown, ChevronUp,
  CreditCard, RefreshCw, ExternalLink, Smartphone, Sparkles, RotateCcw, PenLine, Loader2, Plus, ChevronsUpDown,
  MailX, MailCheck, MessageSquareDashed, Package,
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
  const [editSecondaryPhone, setEditSecondaryPhone] = useState("");
  const [bookingTab, setBookingTab] = useState("upcoming");
  const [newApptOpen, setNewApptOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiGenerated, setAiGenerated] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [emailAiOpen, setEmailAiOpen] = useState(false);
  const [emailAiInput, setEmailAiInput] = useState("");
  const [emailAiGenerated, setEmailAiGenerated] = useState<{ subject: string; body: string } | null>(null);
  const [emailAiLoading, setEmailAiLoading] = useState(false);
  const [viewBookingOpen, setViewBookingOpen] = useState(false);
  const [viewBookingData, setViewBookingData] = useState<any>(null);

  // Pay Links state
  const [payLinkAmount, setPayLinkAmount] = useState(0);
  const [payLinkNotes, setPayLinkNotes] = useState("");
  const [payLinkSending, setPayLinkSending] = useState(false);
  const [checkingPayLinkId, setCheckingPayLinkId] = useState<string | null>(null);
  const [payLinkDelivery, setPayLinkDelivery] = useState<"email" | "sms" | "both">("email");

  // Pet edit dialog
  const [editingPet, setEditingPet] = useState<any>(null);
  const [petForm, setPetForm] = useState({ pet_name: "", breed_id: "", dog_age_years: 0, dog_age_months: 0, notes: "" });
  const [expandedPetId, setExpandedPetId] = useState<string | null>(null);
  const [addDogOpen, setAddDogOpen] = useState(false);
  const [newDogForm, setNewDogForm] = useState({ pet_name: "", breed_id: "", dog_age_years: 0, dog_age_months: 0, notes: "" });

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

  // Fetch active package bookings for this customer
  const { data: customerPackages } = useQuery({
    queryKey: ["customer-packages", decodedEmail],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("package_bookings" as any)
        .select("*, packages(name, package_type, session_count, discount_percentage)") as any)
        .eq("customer_email", decodedEmail)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!decodedEmail,
  });

  const hasActivePackage = (customerPackages || []).some((p: any) => p.status === "active");

  const { data: migratedCustomer } = useQuery({
    queryKey: ["migrated-customer-record", decodedEmail],
    queryFn: async () => {
      const { data } = await supabase
        .from("migrated_customers")
        .select("id, full_name, phone, secondary_phone, email, sms_opt_out, sms_opt_out_at")
        .ilike("email", decodedEmail)
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!decodedEmail,
  });

  // Fetch migrated bookings for this customer
  const { data: migratedBookings } = useQuery({
    queryKey: ["customer-migrated-bookings", decodedEmail],
    queryFn: async () => {
      const mcId = migratedCustomer?.id;
      if (!mcId) return [];
      const { data, error } = await supabase
        .from("migrated_bookings")
        .select("*")
        .eq("migrated_customer_id", mcId)
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return (data || []).map((b: any) => ({ ...b, _source: "wix" }));
    },
    enabled: !!decodedEmail && migratedCustomer !== undefined,
  });

  // Realtime refresh so reassignment/rebooking updates access immediately.
  useEffect(() => {
    if (!decodedEmail) return;

    const channel = supabase
      .channel(`customer-profile-access-${decodedEmail}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["customer-profile-bookings", decodedEmail] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "migrated_bookings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["customer-migrated-bookings", decodedEmail] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "migrated_customers" }, () => {
        queryClient.invalidateQueries({ queryKey: ["migrated-customer-record", decodedEmail] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [decodedEmail, queryClient]);

  // Groomer profile access: grant if they have ANY booking (past or future) with that customer.
  const hasLiveAssignedAccess = !!groomerStaff?.id && (bookings || []).some((b) => {
    if (b.staff_id !== groomerStaff.id) return false;
    return ["Pending", "Confirmed", "Completed"].includes(b.status);
  });

  const hasWixAssignedAccess = !!groomerStaff?.name && (migratedBookings || []).some((mb: any) => {
    if (!mb.staff_name) return false;
    return mb.staff_name.trim().toLowerCase() === groomerStaff.name.trim().toLowerCase();
  });

  const isOwnCustomer = !isGroomer || hasLiveAssignedAccess || hasWixAssignedAccess;
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

  // SMS history from sms_messages (automated reminders + manual)
  const { data: smsHistory } = useQuery({
    queryKey: ["customer-sms-history", decodedEmail],
    queryFn: async () => {
      // Get all phone numbers for this customer from bookings
      const { data: custBookings } = await supabase
        .from("bookings")
        .select("customer_phone")
        .eq("customer_email", decodedEmail)
        .not("customer_phone", "is", null);
      const rawPhones = [...new Set((custBookings || []).map((b) => b.customer_phone).filter(Boolean))];
      if (rawPhones.length === 0) return [];
      // Normalize all phone numbers to E.164 for matching (sms_messages stores E.164)
      const normalizePhone = (p: string) => {
        const t = p.trim();
        if (t.startsWith("+")) return t;
        if (t.startsWith("0")) return "+44" + t.slice(1);
        return "+44" + t;
      };
      const phones = [...new Set(rawPhones.flatMap((p) => [p, normalizePhone(p)]))];
      const { data, error } = await supabase
        .from("sms_messages")
        .select("*")
        .in("phone_number", phones)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
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

  // Automated booking emails (confirmations, reminders)
  const { data: bookingEmailLogs } = useQuery({
    queryKey: ["customer-booking-emails", decodedEmail],
    queryFn: async () => {
      // Get booking IDs for this customer
      const { data: custBookings } = await supabase
        .from("bookings")
        .select("id, booking_date, booking_time, dog_name")
        .eq("customer_email", decodedEmail);
      if (!custBookings || custBookings.length === 0) return [];
      const bookingIds = custBookings.map((b) => b.id);
      const { data, error } = await supabase
        .from("booking_emails")
        .select("*")
        .in("booking_id", bookingIds)
        .order("sent_at", { ascending: false });
      if (error) throw error;
      // Enrich with booking info
      const bookingMap = Object.fromEntries(custBookings.map((b) => [b.id, b]));
      return (data || []).map((e) => ({ ...e, booking: bookingMap[e.booking_id] }));
    },
    enabled: !!decodedEmail && isOwnCustomer,
  });

  const emailTypeLabels: Record<string, string> = {
    confirmation: "Booking Confirmation",
    reminder_24h: "24h Reminder",
    reminder_2h: "2h Reminder",
    appointment_updated: "Appointment Updated",
    cancellation: "Cancellation",
  };

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
    ...(bookingEmailLogs || []).map((e: any) => ({
      id: `be-${e.id}`,
      created_at: e.sent_at,
      direction: "outbound" as const,
      displaySubject: emailTypeLabels[e.email_type] || e.email_type,
      body: e.booking ? `${e.booking.dog_name} — ${format(new Date(e.booking.booking_date), "dd MMM yyyy")} at ${e.booking.booking_time?.substring(0, 5)}` : "Automated email",
      sent_by: null as string | null,
      _isAutomated: true,
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

  // Pay Links query
  const { data: payLinks, refetch: refetchPayLinks } = useQuery({
    queryKey: ["customer-pay-links", decodedEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_pay_links")
        .select("*")
        .eq("customer_email", decodedEmail)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!decodedEmail && isOwnCustomer,
  });

  // Marketing opt-out status
  const { data: unsubRecord, refetch: refetchUnsub } = useQuery({
    queryKey: ["customer-unsub-status", decodedEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_unsubscribes")
        .select("email, unsubscribed_at")
        .eq("email", decodedEmail.toLowerCase().trim())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!decodedEmail,
  });

  const toggleMarketingOptOut = useMutation({
    mutationFn: async (optOut: boolean) => {
      if (optOut) {
        await supabase.from("email_unsubscribes").upsert(
          { email: decodedEmail.toLowerCase().trim() },
          { onConflict: "email" }
        );
      } else {
        await supabase.from("email_unsubscribes").delete().eq("email", decodedEmail.toLowerCase().trim());
      }
    },
    onSuccess: (_, optOut) => {
      refetchUnsub();
      toast({ title: optOut ? "Customer unsubscribed from marketing" : "Customer resubscribed to marketing" });
    },
    onError: () => toast({ title: "Failed to update marketing preference", variant: "destructive" }),
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
    mutationFn: async (updates: { name: string; email: string; phone: string; secondary_phone: string }) => {
      // Update bookings table (may match 0 rows for migrated-only customers — that's fine)
      const { error: bookingsUpdateError } = await supabase
        .from("bookings")
        .update({ customer_name: updates.name, customer_email: updates.email, customer_phone: updates.phone })
        .eq("customer_email", decodedEmail);
      if (bookingsUpdateError) throw bookingsUpdateError;

      // Update migrated_customers table
      const { error: migratedUpdateError } = await supabase
        .from("migrated_customers")
        .update({ full_name: updates.name, phone: updates.phone, email: updates.email, secondary_phone: updates.secondary_phone || null })
        .ilike("email", decodedEmail);
      if (migratedUpdateError) throw migratedUpdateError;

      // Update profiles table via migrated_customers link
      const { data: mc, error: mcLookupError } = await supabase
        .from("migrated_customers")
        .select("profile_id")
        .ilike("email", updates.email)
        .maybeSingle();
      if (mcLookupError) throw mcLookupError;

      if (mc?.profile_id) {
        const { error: profileUpdateError } = await supabase
          .from("profiles")
          .update({ full_name: updates.name })
          .eq("id", mc.profile_id);
        if (profileUpdateError) throw profileUpdateError;
      }

      if (updates.email !== decodedEmail) {
        const { error: notesEmailUpdateError } = await supabase
          .from("customer_notes")
          .update({ customer_email: updates.email })
          .eq("customer_email", decodedEmail);
        if (notesEmailUpdateError) throw notesEmailUpdateError;

        const { error: commsEmailUpdateError } = await supabase
          .from("customer_communications")
          .update({ customer_email: updates.email })
          .eq("customer_email", decodedEmail);
        if (commsEmailUpdateError) throw commsEmailUpdateError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(["migrated-customer-record", decodedEmail], (prev: any) => (
        prev
          ? {
              ...prev,
              full_name: variables.name,
              email: variables.email,
              phone: variables.phone,
              secondary_phone: variables.secondary_phone,
            }
          : prev
      ));

      setIsEditing(false);
      toast({ title: "Customer details updated" });

      queryClient.invalidateQueries({ queryKey: ["customer-profile-bookings", decodedEmail] });
      queryClient.invalidateQueries({ queryKey: ["migrated-customer-record", decodedEmail] });
      queryClient.invalidateQueries({ queryKey: ["customer-user-id", decodedEmail] });

      if (variables.email !== decodedEmail) {
        queryClient.invalidateQueries({ queryKey: ["customer-profile-bookings", variables.email] });
        queryClient.invalidateQueries({ queryKey: ["migrated-customer-record", variables.email] });
        queryClient.invalidateQueries({ queryKey: ["customer-user-id", variables.email] });
        navigate(`/admin/customers/${encodeURIComponent(variables.email)}`, { replace: true });
      }
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

  const customerName = bookings?.[0]?.customer_name || migratedCustomer?.full_name || "Customer";
  const customerPhone = bookings?.find((b) => b.customer_phone)?.customer_phone || migratedCustomer?.phone || "";
  const initials = customerName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  // Merge migrated bookings into past bookings display
  const migratedAsBookings = (migratedBookings || []).map((mb: any) => ({
    id: `migrated-${mb.id}`,
    booking_date: mb.booking_date,
    booking_time: mb.booking_time || "00:00",
    dog_name: mb.dog_name || "Unknown",
    total_price: mb.total_price || 0,
    deposit_paid: mb.deposit_paid || 0,
    status: mb.payment_status === "Paid" ? "Completed" : mb.payment_status || "Unknown",
    notes: mb.notes,
    staff: mb.staff_name ? { name: mb.staff_name } : null,
    service: { name: mb.service_name },
    breed: mb.dog_breed ? { name: mb.dog_breed } : null,
    _source: "wix" as const,
    customer_name: customerName,
  }));

  const todayLocal = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const upcomingMigrated = migratedAsBookings.filter((mb) => mb.booking_date >= todayLocal);
  const pastMigrated = migratedAsBookings.filter((mb) => mb.booking_date < todayLocal);
  const upcomingBookings = [
    ...(bookings?.filter((b) => b.booking_date >= todayLocal && b.status !== "Cancelled") || []),
    ...upcomingMigrated,
  ].sort((a, b) => a.booking_date.localeCompare(b.booking_date));
  const pastBookings = [
    ...(bookings?.filter((b) => b.booking_date < todayLocal || b.status === "Cancelled") || []),
    ...pastMigrated,
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

  const startEditing = () => { setEditName(customerName); setEditEmail(decodedEmail); setEditPhone(customerPhone); setEditSecondaryPhone(migratedCustomer?.secondary_phone || ""); setIsEditing(true); };

  const saveEdits = () => {
    if (!editName.trim() || !editEmail.trim()) { toast({ title: "Name and email are required", variant: "destructive" }); return; }
    updateCustomerMutation.mutate({ name: editName.trim(), email: editEmail.trim(), phone: editPhone.trim(), secondary_phone: editSecondaryPhone.trim() });
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

  // Find last groomer for restricted view fallback text
  const latestLiveStaffName = bookings?.[0]?.staff ? (bookings[0].staff as any).name : null;
  const latestWixStaffName = migratedBookings?.[0]?.staff_name || null;
  const lastGroomerName = latestLiveStaffName || latestWixStaffName;

  // ── Layout wrapper ────────────────────────────────────────────────
  const Layout = isGroomer ? GroomerLayout : AppLayout;

  // Avoid false restrictions while assignment data is still loading.
  const accessEvaluationReady = !isGroomer || (bookings !== undefined && migratedBookings !== undefined && !!groomerStaff);

  // ── LIMITED VIEW for groomers viewing non-assigned customer ───────
  if (isGroomer && accessEvaluationReady && !isOwnCustomer) {
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
                  <Badge variant="secondary">{(bookings?.length || 0) + (migratedBookings?.length || 0)} booking{((bookings?.length || 0) + (migratedBookings?.length || 0)) !== 1 ? "s" : ""}</Badge>
                  {((bookings?.length || 0) + (migratedBookings?.length || 0)) >= 2 && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Returning</Badge>
                  )}
                  {customerIsOwn && (
                    <Badge className="bg-accent/15 text-accent border-accent/30"><UserCheck className="h-3 w-3 mr-1" />Own Customer</Badge>
                  )}
                  {unsubRecord ? (
                    <Badge variant="outline" className="text-muted-foreground"><MailX className="h-3 w-3 mr-1" />Email: Unsubscribed</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><MailCheck className="h-3 w-3 mr-1" />Email: Subscribed</Badge>
                  )}
                  {migratedCustomer?.sms_opt_out ? (
                    <Badge variant="outline" className="text-muted-foreground"><MessageSquareDashed className="h-3 w-3 mr-1" />SMS: Opted out</Badge>
                  ) : migratedCustomer?.phone ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><MessageSquare className="h-3 w-3 mr-1" />SMS: Subscribed</Badge>
                  ) : null}
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
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Phone className="h-3 w-3" /> Secondary phone</p>
                {isEditing ? <Input value={editSecondaryPhone} onChange={(e) => setEditSecondaryPhone(e.target.value)} className="h-8 text-sm" placeholder="+44 ..." /> : <p className="text-sm font-medium">{migratedCustomer?.secondary_phone || "—"}</p>}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Total spend</p>
                <p className="text-sm font-medium">£{((bookings?.reduce((sum, b) => sum + Number(b.total_price), 0) || 0) + (migratedBookings?.reduce((sum, b: any) => sum + Number(b.total_price || 0), 0) || 0)).toFixed(2)}</p>
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
                  <TabsTrigger value="messages" className={tabTriggerClass}><MessageSquare className="h-3.5 w-3.5 mr-1.5" />Messages {((messages?.length || 0) + (smsHistory?.length || 0)) > 0 && `(${(messages?.length || 0) + (smsHistory?.length || 0)})`}</TabsTrigger>
                  <TabsTrigger value="email" className={tabTriggerClass}><MailOpen className="h-3.5 w-3.5 mr-1.5" />Email {allEmails.length > 0 && `(${allEmails.length})`}</TabsTrigger>
                  <TabsTrigger value="paylinks" className={tabTriggerClass}><CreditCard className="h-3.5 w-3.5 mr-1.5" />Pay Links {payLinks && payLinks.length > 0 && `(${payLinks.length})`}</TabsTrigger>
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Dog className="h-4 w-4" /> Registered Dogs</h3>
                  {canManageCustomer && customerUserId && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setNewDogForm({ pet_name: "", breed_id: "", dog_age_years: 0, dog_age_months: 0, notes: "" }); setAddDogOpen(true); }}>
                      <Plus className="h-3.5 w-3.5" /> Add Dog
                    </Button>
            )}

            {/* Marketing Preference */}
            {canManageCustomer && !isGroomer && (
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {unsubRecord ? (
                      <MailX className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <MailCheck className="h-5 w-5 text-emerald-500" />
                    )}
                    <div>
                      <p className="text-sm font-semibold">Marketing Emails</p>
                      {unsubRecord ? (
                        <p className="text-xs text-muted-foreground">
                          Unsubscribed {unsubRecord.unsubscribed_at ? `on ${format(new Date(unsubRecord.unsubscribed_at), "dd MMM yyyy")}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-600">Subscribed — will receive marketing emails</p>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={!unsubRecord}
                    onCheckedChange={(checked) => toggleMarketingOptOut.mutate(!checked)}
                    disabled={toggleMarketingOptOut.isPending}
                  />
                </CardContent>
              </Card>
            )}

            {/* SMS Preference */}
            {canManageCustomer && !isGroomer && migratedCustomer && (
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {migratedCustomer.sms_opt_out ? (
                      <MessageSquareDashed className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <MessageSquare className="h-5 w-5 text-emerald-500" />
                    )}
                    <div>
                      <p className="text-sm font-semibold">SMS Marketing</p>
                      {migratedCustomer.sms_opt_out ? (
                        <p className="text-xs text-muted-foreground">
                          Opted out {migratedCustomer.sms_opt_out_at ? `on ${format(new Date(migratedCustomer.sms_opt_out_at), "dd MMM yyyy")}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-600">Subscribed — will receive SMS campaigns</p>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={!migratedCustomer.sms_opt_out}
                    onCheckedChange={async (checked) => {
                      await supabase
                        .from("migrated_customers")
                        .update({
                          sms_opt_out: !checked,
                          sms_opt_out_at: !checked ? new Date().toISOString() : null,
                        })
                        .eq("id", migratedCustomer.id);
                      queryClient.invalidateQueries({ queryKey: ["migrated-customer-record", decodedEmail] });
                      toast({ title: checked ? "Customer resubscribed to SMS" : "Customer opted out of SMS" });
                    }}
                  />
                </CardContent>
              </Card>
            )}
                </div>
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
              <MiniStat label="Total Bookings" value={String((bookings?.length || 0) + (migratedBookings?.length || 0))} />
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

                  {/* AI Writing Assistant */}
                  {!aiOpen && !aiGenerated && (
                    <button
                      type="button"
                      onClick={() => setAiOpen(true)}
                      className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all px-4 py-3 text-sm font-medium text-primary"
                    >
                      <Sparkles className="h-4 w-4" />
                      ✨ Write with AI — let AI draft a professional message for you
                    </button>
                  )}

                  {aiOpen && !aiGenerated && (
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" /> AI Message Writer
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setAiOpen(false); setAiInput(""); }}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Type what you want to say in your own words — spelling mistakes and casual language are fine!</p>
                      <Input
                        placeholder="e.g. tell them we need to reschedule, we're not working Sunday"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (aiInput.trim() && !aiLoading) {
                              (async () => {
                                setAiLoading(true);
                                try {
                                  const { data, error } = await supabase.functions.invoke("generate-sms-message", { body: { roughMessage: aiInput.trim() } });
                                  if (error) throw error;
                                  if (data?.error) throw new Error(data.error);
                                  setAiGenerated(data.message);
                                } catch (err: any) {
                                  toast({ title: err.message || "AI generation failed", variant: "destructive" });
                                } finally {
                                  setAiLoading(false);
                                }
                              })();
                            }
                          }
                        }}
                        className="text-sm"
                      />
                      <Button
                        onClick={async () => {
                          if (!aiInput.trim()) return;
                          setAiLoading(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("generate-sms-message", { body: { roughMessage: aiInput.trim() } });
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            setAiGenerated(data.message);
                          } catch (err: any) {
                            toast({ title: err.message || "AI generation failed", variant: "destructive" });
                          } finally {
                            setAiLoading(false);
                          }
                        }}
                        disabled={!aiInput.trim() || aiLoading}
                        className="w-full"
                      >
                        {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        Generate Message
                      </Button>
                    </div>
                  )}

                  {aiGenerated && (
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                      <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" /> AI Suggestion
                      </span>
                      <p className="text-sm bg-background rounded-md p-3 border border-border whitespace-pre-wrap">{aiGenerated}</p>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" onClick={() => { setNewMessage(aiGenerated); setAiGenerated(""); setAiOpen(false); setAiInput(""); }}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Use this message
                        </Button>
                        <Button size="sm" variant="outline" onClick={async () => {
                          setAiLoading(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("generate-sms-message", { body: { roughMessage: aiInput.trim() } });
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            setAiGenerated(data.message);
                          } catch (err: any) {
                            toast({ title: err.message || "AI generation failed", variant: "destructive" });
                          } finally {
                            setAiLoading(false);
                          }
                        }} disabled={aiLoading}>
                          {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                          Try again
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setNewMessage(aiGenerated); setAiGenerated(""); setAiOpen(false); setAiInput(""); }}>
                          <PenLine className="h-3.5 w-3.5 mr-1" /> Edit manually
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAiGenerated(""); setAiOpen(false); setAiInput(""); }}>
                          <X className="h-3.5 w-3.5 mr-1" /> Discard
                        </Button>
                      </div>
                    </div>
                  )}

                  <Separator />
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message & SMS History</h4>
                  {(() => {
                    const allMessages = [
                      ...(messages || []).map((msg) => ({
                        id: msg.id,
                        created_at: msg.created_at,
                        direction: msg.direction,
                        body: msg.body,
                        sent_by: msg.sent_by,
                        _type: "message" as const,
                        _sentByName: msg.sent_by ? getStaffName(msg.sent_by) : null,
                      })),
                      ...(smsHistory || []).map((sms: any) => ({
                        id: `sms-${sms.id}`,
                        created_at: sms.created_at,
                        direction: sms.direction,
                        body: sms.body,
                        sent_by: null as string | null,
                        _type: "sms" as const,
                        _sentByName: sms.sent_by_name || "System (Automated)",
                      })),
                    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                    return allMessages.length > 0 ? (
                      <div className="space-y-2">
                        {allMessages.map((msg) => (
                          <div key={msg.id} className="p-3 rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{msg.direction === "outbound" ? "Sent" : "Received"}</Badge>
                              {msg._type === "sms" && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">📱 SMS</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">{format(new Date(msg.created_at), "dd MMM yyyy, HH:mm")}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                            {msg._sentByName && <p className="text-xs text-muted-foreground mt-1">by {msg._sentByName}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                        <p className="font-medium text-sm">No messages yet</p>
                        <p className="text-xs text-muted-foreground">Send a message to start the conversation.</p>
                      </div>
                    );
                  })()}
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

                  {/* AI Email Writing Assistant */}
                  {!emailAiOpen && !emailAiGenerated && (
                    <button
                      type="button"
                      onClick={() => setEmailAiOpen(true)}
                      className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all px-4 py-3 text-sm font-medium text-primary"
                    >
                      <Sparkles className="h-4 w-4" />
                      ✨ Write with AI — let AI draft a professional email for you
                    </button>
                  )}

                  {emailAiOpen && !emailAiGenerated && (
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" /> AI Email Writer
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEmailAiOpen(false); setEmailAiInput(""); }}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input
                        placeholder="e.g. let them know their appointment is confirmed for next Tuesday at 2pm"
                        value={emailAiInput}
                        onChange={(e) => setEmailAiInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (emailAiInput.trim() && !emailAiLoading) {
                              (async () => {
                                setEmailAiLoading(true);
                                try {
                                  const { data, error } = await supabase.functions.invoke("generate-email-message", { body: { roughMessage: emailAiInput.trim(), customerName } });
                                  if (error) throw error;
                                  if (data?.error) throw new Error(data.error);
                                  setEmailAiGenerated({ subject: data.subject, body: data.body });
                                } catch (err: any) {
                                  toast({ title: err.message || "AI generation failed", variant: "destructive" });
                                } finally {
                                  setEmailAiLoading(false);
                                }
                              })();
                            }
                          }
                        }}
                      />
                      <Button
                        onClick={async () => {
                          if (!emailAiInput.trim()) return;
                          setEmailAiLoading(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("generate-email-message", { body: { roughMessage: emailAiInput.trim(), customerName } });
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            setEmailAiGenerated({ subject: data.subject, body: data.body });
                          } catch (err: any) {
                            toast({ title: err.message || "AI generation failed", variant: "destructive" });
                          } finally {
                            setEmailAiLoading(false);
                          }
                        }}
                        disabled={!emailAiInput.trim() || emailAiLoading}
                        className="w-full"
                      >
                        {emailAiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        Generate Email
                      </Button>
                    </div>
                  )}

                  {emailAiGenerated && (
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                      <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" /> AI Suggestion
                      </span>
                      <div className="text-sm bg-background rounded-md p-3 border border-border space-y-2">
                        <p className="font-medium">Subject: {emailAiGenerated.subject}</p>
                        <Separator />
                        <p className="whitespace-pre-wrap">{emailAiGenerated.body}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" onClick={() => { setEmailSubject(emailAiGenerated.subject); setEmailBody(emailAiGenerated.body); setEmailAiGenerated(null); setEmailAiOpen(false); setEmailAiInput(""); }}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Use this email
                        </Button>
                        <Button size="sm" variant="outline" onClick={async () => {
                          setEmailAiLoading(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("generate-email-message", { body: { roughMessage: emailAiInput.trim(), customerName } });
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            setEmailAiGenerated({ subject: data.subject, body: data.body });
                          } catch (err: any) {
                            toast({ title: err.message || "AI generation failed", variant: "destructive" });
                          } finally {
                            setEmailAiLoading(false);
                          }
                        }} disabled={emailAiLoading}>
                          {emailAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                          Try again
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEmailSubject(emailAiGenerated!.subject); setEmailBody(emailAiGenerated!.body); setEmailAiGenerated(null); setEmailAiOpen(false); setEmailAiInput(""); }}>
                          <PenLine className="h-3.5 w-3.5 mr-1" /> Edit manually
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEmailAiGenerated(null); setEmailAiOpen(false); setEmailAiInput(""); }}>
                          <X className="h-3.5 w-3.5 mr-1" /> Discard
                        </Button>
                      </div>
                    </div>
                  )}
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
                              {(em as any)._isAutomated && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">⚡ Auto</Badge>
                              )}
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

          {/* ── Pay Links ── */}
          {isOwnCustomer && (
            <TabsContent value="paylinks" className="mt-4">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-1"><CreditCard className="h-4 w-4" /> Generate Pay Link</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>Amount (£)</Label>
                      <NumericInput value={payLinkAmount} onValueChange={setPayLinkAmount} />
                    </div>
                    <div>
                      <Label>Notes (optional)</Label>
                      <Textarea placeholder="e.g. Missed charge for nail trim" value={payLinkNotes} onChange={(e) => setPayLinkNotes(e.target.value)} className="min-h-[60px]" />
                    </div>
                    <div>
                      <Label className="mb-2 block">Send via</Label>
                      <RadioGroup value={payLinkDelivery} onValueChange={(v) => setPayLinkDelivery(v as "email" | "sms" | "both")} className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="email" id="pl-email" />
                          <Label htmlFor="pl-email" className="flex items-center gap-1 cursor-pointer text-sm font-normal"><Mail className="h-3.5 w-3.5" /> Email</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="sms" id="pl-sms" disabled={!customerPhone} />
                          <Label htmlFor="pl-sms" className={`flex items-center gap-1 cursor-pointer text-sm font-normal ${!customerPhone ? "opacity-40" : ""}`}><Smartphone className="h-3.5 w-3.5" /> SMS</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="both" id="pl-both" disabled={!customerPhone} />
                          <Label htmlFor="pl-both" className={`flex items-center gap-1 cursor-pointer text-sm font-normal ${!customerPhone ? "opacity-40" : ""}`}><Send className="h-3.5 w-3.5" /> Both</Label>
                        </div>
                      </RadioGroup>
                      {!customerPhone && (payLinkDelivery === "sms" || payLinkDelivery === "both") && (
                        <p className="text-xs text-destructive mt-1">No phone number on file — add one above first.</p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        disabled={payLinkAmount <= 0 || payLinkSending || ((payLinkDelivery === "sms" || payLinkDelivery === "both") && !customerPhone)}
                        onClick={async () => {
                          setPayLinkSending(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("create-customer-pay-link", {
                              body: {
                                customer_email: decodedEmail,
                                customer_name: customerName,
                                amount: payLinkAmount,
                                notes: payLinkNotes.trim() || null,
                                delivery: payLinkDelivery,
                                customer_phone: customerPhone || null,
                              },
                            });
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            const method = payLinkDelivery === "both" ? "email & SMS" : payLinkDelivery;
                            toast({ title: `Pay link sent via ${method}! 🐾` });
                            setPayLinkAmount(0);
                            setPayLinkNotes("");
                            refetchPayLinks();
                          } catch (e: any) {
                            toast({ title: `Failed: ${e.message}`, variant: "destructive" });
                          } finally {
                            setPayLinkSending(false);
                          }
                        }}
                      >
                        <Send className="h-4 w-4 mr-2" />{payLinkSending ? "Sending…" : "Generate & Send"}
                      </Button>
                    </div>
                  </div>
                  <Separator />
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pay Link History</h4>
                  {payLinks && payLinks.length > 0 ? (
                    <div className="space-y-2">
                      {payLinks.map((pl: any) => (
                        <div key={pl.id} className="p-3 rounded-lg border bg-muted/30">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">£{Number(pl.amount).toFixed(2)}</span>
                              {pl.status === "paid" ? (
                                <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">🟢 Paid</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600">🟡 Pending</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {pl.status !== "paid" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  disabled={checkingPayLinkId === pl.id}
                                  onClick={async () => {
                                    setCheckingPayLinkId(pl.id);
                                    try {
                                      const { data, error } = await supabase.functions.invoke("check-pay-link-status", {
                                        body: { pay_link_id: pl.id },
                                      });
                                      if (error) throw error;
                                      if (data?.status === "paid") {
                                        toast({ title: "Payment confirmed! ✅" });
                                      } else {
                                        toast({ title: "Still pending — not yet paid" });
                                      }
                                      refetchPayLinks();
                                    } catch (e: any) {
                                      toast({ title: `Error: ${e.message}`, variant: "destructive" });
                                    } finally {
                                      setCheckingPayLinkId(null);
                                    }
                                  }}
                                >
                                  <RefreshCw className={`h-3 w-3 mr-1 ${checkingPayLinkId === pl.id ? "animate-spin" : ""}`} />
                                  Check
                                </Button>
                              )}
                              {pl.stripe_url && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                                  <a href={pl.stripe_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3 mr-1" />Link
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                          {pl.notes && <p className="text-xs text-muted-foreground">{pl.notes}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            Sent {format(new Date(pl.created_at), "dd MMM yyyy, HH:mm")}
                            {pl.status === "paid" && pl.paid_at && ` • Paid ${format(new Date(pl.paid_at), "dd MMM yyyy, HH:mm")}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="font-medium text-sm">No pay links yet</p>
                      <p className="text-xs text-muted-foreground">Generate a pay link above to request payment from this customer.</p>
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

      {/* ═══ ADD DOG DIALOG ═══ */}
      {canManageCustomer && customerUserId && (
        <Dialog open={addDogOpen} onOpenChange={setAddDogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Register New Dog</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Dog Name <span className="text-destructive">*</span></Label>
                <Input value={newDogForm.pet_name} onChange={(e) => setNewDogForm({ ...newDogForm, pet_name: e.target.value })} placeholder="e.g. Buddy" />
              </div>
              <div className="space-y-1">
                <Label>Breed</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {newDogForm.breed_id ? allBreeds?.find(b => b.id === newDogForm.breed_id)?.name : "Select breed"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search breed..." />
                      <CommandList>
                        <CommandEmpty>No breed found.</CommandEmpty>
                        <CommandGroup>
                          {allBreeds?.map(b => (
                            <CommandItem key={b.id} value={b.name} onSelect={() => setNewDogForm({ ...newDogForm, breed_id: b.id })}>
                              <Check className={cn("mr-2 h-4 w-4", newDogForm.breed_id === b.id ? "opacity-100" : "opacity-0")} />
                              {b.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Age (years)</Label>
                  <Input inputMode="numeric" value={newDogForm.dog_age_years === 0 ? "" : String(newDogForm.dog_age_years)} placeholder="e.g. 3" onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ""); setNewDogForm({ ...newDogForm, dog_age_years: val ? parseInt(val, 10) : 0 }); }} />
                </div>
                <div className="space-y-1">
                  <Label>Age (months)</Label>
                  <Input inputMode="numeric" value={newDogForm.dog_age_months === 0 ? "" : String(newDogForm.dog_age_months)} placeholder="e.g. 6" onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ""); setNewDogForm({ ...newDogForm, dog_age_months: Math.min(val ? parseInt(val, 10) : 0, 11) }); }} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea value={newDogForm.notes} onChange={(e) => setNewDogForm({ ...newDogForm, notes: e.target.value })} rows={2} placeholder="Any special notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDogOpen(false)}>Cancel</Button>
              <Button
                disabled={!newDogForm.pet_name.trim()}
                onClick={async () => {
                  const { error } = await supabase.from("customer_pets").insert({
                    user_id: customerUserId!,
                    pet_name: newDogForm.pet_name.trim(),
                    breed_id: newDogForm.breed_id || null,
                    dog_age_years: newDogForm.dog_age_years || null,
                    dog_age_months: newDogForm.dog_age_months || null,
                    notes: newDogForm.notes.trim() || null,
                  });
                  if (error) {
                    toast({ title: "Error", description: error.message, variant: "destructive" });
                    return;
                  }
                  toast({ title: "Dog registered successfully" });
                  queryClient.invalidateQueries({ queryKey: ["customer-profile-pets", customerUserId] });
                  setAddDogOpen(false);
                }}
              >
                Register Dog
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
          {booking._source === "wix" && (
            <Badge variant="outline" className="ml-2 text-[9px] px-1.5 py-0 border-amber-300 text-amber-600">W</Badge>
          )}
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
        {showActions && !booking._source && (
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
