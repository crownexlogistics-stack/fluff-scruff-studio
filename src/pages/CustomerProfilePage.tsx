import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Mail, Phone, Dog, Calendar, StickyNote, Send, User } from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function CustomerProfilePage() {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();
  const decodedEmail = decodeURIComponent(email || "");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");

  // Fetch all bookings for this customer
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

  // Find user_id from email via DB function, then fetch their pets
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

  // Fetch internal notes
  const { data: notes, isLoading: loadingNotes } = useQuery({
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

  // Fetch staff names for notes
  const { data: staffProfiles } = useQuery({
    queryKey: ["staff-profiles-for-notes"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data || [];
    },
  });

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
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const customerName = bookings?.[0]?.customer_name || "Customer";
  const customerPhone = bookings?.find(b => b.customer_phone)?.customer_phone || null;

  const today = new Date().toISOString().split("T")[0];
  const upcomingBookings = bookings?.filter(b => b.booking_date >= today && b.status !== "Cancelled") || [];
  const pastBookings = bookings?.filter(b => b.booking_date < today || b.status === "Cancelled") || [];

  const getStaffName = (userId: string) => {
    const profile = staffProfiles?.find(p => p.id === userId);
    return profile?.full_name || "Unknown";
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Back button & header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold">{customerName}</h1>
            <p className="text-sm text-muted-foreground">Customer Profile</p>
          </div>
        </div>

        {/* Contact info */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">{customerName}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {decodedEmail && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> {decodedEmail}
                    </span>
                  )}
                  {customerPhone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> {customerPhone}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Badge variant="secondary">{bookings?.length || 0} booking{(bookings?.length || 0) !== 1 ? "s" : ""}</Badge>
                  {(bookings?.length || 0) >= 2 && <Badge className="bg-emerald-100 text-emerald-700">Returning</Badge>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registered Dogs */}
        {customerPets && customerPets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Dog className="h-4 w-4" /> Registered Dogs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customerPets.map(pet => (
                <div key={pet.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{pet.pet_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(pet.breed as any)?.name || "Breed not set"}
                      {pet.dog_age_years != null && ` • ${pet.dog_age_years}y ${pet.dog_age_months || 0}m`}
                      {(pet.breed as any)?.size_category && ` • ${(pet.breed as any).size_category}`}
                    </p>
                  </div>
                  {pet.notes && <p className="text-xs text-muted-foreground max-w-[200px] truncate">{pet.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Booking History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Booking History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upcoming */}
            {upcomingBookings.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Upcoming</p>
                <div className="space-y-2">
                  {upcomingBookings.map(b => (
                    <BookingRow key={b.id} booking={b} variant="upcoming" />
                  ))}
                </div>
              </div>
            )}

            {upcomingBookings.length > 0 && pastBookings.length > 0 && <Separator />}

            {/* Past */}
            {pastBookings.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Past</p>
                <div className="space-y-2">
                  {pastBookings.map(b => (
                    <BookingRow key={b.id} booking={b} variant="past" />
                  ))}
                </div>
              </div>
            )}

            {(!bookings || bookings.length === 0) && !loadingBookings && (
              <p className="text-sm text-muted-foreground text-center py-4">No bookings found.</p>
            )}
          </CardContent>
        </Card>

        {/* Internal Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="h-4 w-4" /> Internal Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a note about this customer..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
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
                {notes.map(note => (
                  <div key={note.id} className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-sm">{note.note}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getStaffName(note.created_by)} • {format(new Date(note.created_at), "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">No notes yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function BookingRow({ booking, variant }: { booking: any; variant: "upcoming" | "past" }) {
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
          {format(parseISO(booking.booking_date), "EEE, dd MMM yyyy")} at {booking.booking_time?.slice(0, 5)}
          {staffName && ` • with ${staffName}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={
          booking.status === "Confirmed" ? "default" :
          booking.status === "Completed" ? "secondary" :
          booking.status === "No Show" || booking.status === "Cancelled" ? "destructive" : "secondary"
        }>
          {booking.status}
        </Badge>
        <span className="text-sm font-medium">£{Number(booking.total_price).toFixed(2)}</span>
      </div>
    </div>
  );
}
