import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PawPrint, Plus, ArrowLeft, CalendarDays, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import logo from "@/assets/logo-transparent.png";

interface Pet {
  id: string;
  pet_name: string;
  notes: string | null;
  breed_id: string | null;
  created_at: string;
}

interface BookingRecord {
  id: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  services?: { name: string } | null;
}

const MyPetsPage = () => {
  const { user, signOut } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [petName, setPetName] = useState("");
  const [petNotes, setPetNotes] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [petsRes, bookingsRes] = await Promise.all([
      supabase.from("customer_pets").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("bookings").select("id, dog_name, booking_date, booking_time, status, services(name)").eq("customer_email", user.email).order("booking_date", { ascending: false }).limit(20),
    ]);

    setPets(petsRes.data || []);
    setBookings((bookingsRes.data as unknown as BookingRecord[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const addPet = async () => {
    if (!user || !petName.trim()) return;
    const { error } = await supabase.from("customer_pets").insert({ user_id: user.id, pet_name: petName.trim(), notes: petNotes.trim() || null });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pet added!" });
      setPetName("");
      setPetNotes("");
      setDialogOpen(false);
      fetchData();
    }
  };

  const deletePet = async (id: string) => {
    const { error } = await supabase.from("customer_pets").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchData();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto" />
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/"); }}>Sign Out</Button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* My Pets */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-heading text-foreground flex items-center gap-2">
              <PawPrint className="h-6 w-6 text-accent" /> My Pets
            </h1>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-charcoal text-primary-foreground">
                  <Plus className="h-4 w-4 mr-1" /> Add Pet
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add a Pet</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Pet Name</Label>
                    <Input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="e.g. Buddy" />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={petNotes} onChange={(e) => setPetNotes(e.target.value)} placeholder="Breed, allergies, preferences…" />
                  </div>
                  <Button onClick={addPet} className="w-full bg-charcoal text-primary-foreground" disabled={!petName.trim()}>Add Pet</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : pets.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-2xl">
              <PawPrint className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground font-body">No pets yet. Add your first furry friend!</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {pets.map((pet) => (
                <div key={pet.id} className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm shadow-black/[0.02] flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-foreground">{pet.pet_name}</h3>
                    {pet.notes && <p className="text-sm text-muted-foreground mt-1">{pet.notes}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deletePet(pet.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Booking History */}
        <section className="space-y-4">
          <h2 className="text-xl font-heading text-foreground flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-accent" /> Booking History
          </h2>
          {bookings.length === 0 ? (
            <p className="text-muted-foreground font-body text-sm">No bookings found for your email address.</p>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div key={b.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm shadow-black/[0.02] flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{b.dog_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(b.booking_date), "EEE d MMM yyyy")} at {b.booking_time}
                      {b.services?.name && ` · ${b.services.name}`}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${b.status === "Completed" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MyPetsPage;
