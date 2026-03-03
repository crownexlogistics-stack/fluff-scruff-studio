import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Dog } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CustomerHeader } from "@/components/customer-portal/CustomerHeader";
import { BottomNavDock, type PortalTab } from "@/components/customer-portal/BottomNavDock";
import { PetStoryIcons } from "@/components/my-account/PetStoryIcons";
import { PetHeroCard } from "@/components/my-account/PetHeroCard";
import { UpcomingAppointmentCard } from "@/components/customer-portal/UpcomingAppointmentCard";
import { BreedAdviceFeed } from "@/components/customer-portal/BreedAdviceFeed";
import { BookingsTab } from "@/components/customer-portal/BookingsTab";
import { PicturesTab } from "@/components/customer-portal/PicturesTab";
import { AdviceTab } from "@/components/customer-portal/AdviceTab";
import { PawsitiveGallery } from "@/components/my-account/PawsitiveGallery";
import { GroomersCorner } from "@/components/my-account/GroomersCorner";

const MyPetsPage = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PortalTab>("pets");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [petName, setPetName] = useState("");
  const [breedSearch, setBreedSearch] = useState("");
  const [selectedBreedId, setSelectedBreedId] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);

  // Fetch breeds
  const { data: breeds = [] } = useQuery({
    queryKey: ["breeds-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breeds").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch pets
  const { data: pets = [], isLoading: loadingPets } = useQuery({
    queryKey: ["my-pets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_pets")
        .select("*, breeds(name)")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return data.map((p: any) => ({ ...p, breed_name: p.breeds?.name || null }));
    },
    enabled: !!user?.id,
  });

  // Fetch bookings with financial data
  const { data: bookings = [] } = useQuery({
    queryKey: ["my-bookings", user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, dog_name, booking_date, booking_time, status, service_id, breed_id, total_price, deposit_paid, notes, customer_name, customer_email, customer_phone, services(name), staff:staff_id(name)")
        .eq("customer_email", user!.email)
        .order("booking_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });

  // Auto-select first pet
  useEffect(() => {
    if (pets.length > 0 && !selectedPetId) setSelectedPetId(pets[0].id);
  }, [pets, selectedPetId]);

  const selectedPet = pets.find((p: any) => p.id === selectedPetId);

  // Fetch photos for selected pet
  const { data: photos = [] } = useQuery({
    queryKey: ["pet-photos", selectedPetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_photos")
        .select("*")
        .eq("pet_id", selectedPetId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPetId,
  });

  // Fetch ALL photos for all pets (for Pictures tab)
  const { data: allPhotos = [] } = useQuery({
    queryKey: ["all-pet-photos", user?.id],
    queryFn: async () => {
      const petIds = pets.map((p: any) => p.id);
      if (petIds.length === 0) return [];
      const { data, error } = await supabase
        .from("pet_photos")
        .select("*")
        .in("pet_id", petIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: pets.length > 0,
  });

  // Fetch recommendations for selected pet
  const { data: recommendations = [] } = useQuery({
    queryKey: ["pet-recommendations", selectedPetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groomer_recommendations")
        .select("*, staff:staff_id(name)")
        .eq("pet_id", selectedPetId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPetId,
  });

  const profilePhoto = photos.length > 0 ? photos[0].photo_url : null;
  const petBookings = selectedPet
    ? bookings.filter((b: any) => b.dog_name?.toLowerCase() === selectedPet.pet_name?.toLowerCase())
    : [];

  // Find next upcoming booking
  const upcomingBooking = bookings.find((b: any) => {
    const status = (b.status || "").trim();
    return ["Confirmed", "Pending"].includes(status) && new Date(b.booking_date) >= new Date(new Date().toDateString());
  });

  const filteredBreeds = breedSearch.length > 0
    ? breeds.filter((b: any) => b.name.toLowerCase().includes(breedSearch.toLowerCase()))
    : [];

  const addPet = async () => {
    if (!user || !petName.trim()) return;
    const { error } = await supabase.from("customer_pets").insert({
      user_id: user.id,
      pet_name: petName.trim(),
      breed_id: selectedBreedId,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pet added! 🐾" });
      setPetName("");
      setBreedSearch("");
      setSelectedBreedId(null);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-pets"] });
    }
  };

  const refreshPhotos = () => queryClient.invalidateQueries({ queryKey: ["pet-photos", selectedPetId] });

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedPetId) return;
    setUploadingProfile(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${selectedPetId}/profile_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("pet-photos").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("pet-photos").getPublicUrl(path);
      const { error: insertError } = await supabase.from("pet_photos").insert({
        pet_id: selectedPetId,
        user_id: user.id,
        photo_url: publicUrl,
        uploaded_by_role: "customer",
        caption: "Profile photo",
      });
      if (insertError) throw insertError;
      toast({ title: "Profile photo updated! 📸" });
      refreshPhotos();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingProfile(false);
      if (profilePhotoRef.current) profilePhotoRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <CustomerHeader user={user} signOut={signOut} />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Pet Story Icons — always visible */}
        {loadingPets ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        ) : pets.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🐾</span>
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground mb-1">No Pets Yet</h2>
            <p className="text-sm text-muted-foreground mb-4">Add your furry friend to get started!</p>
            <Button onClick={() => setDialogOpen(true)} className="bg-accent text-accent-foreground">
              Add Your First Pet
            </Button>
          </div>
        ) : (
          <>
            <PetStoryIcons
              pets={pets.map((p: any) => ({
                id: p.id,
                pet_name: p.pet_name,
                breed_name: p.breed_name,
                profile_photo: allPhotos.find((ph: any) => ph.pet_id === p.id)?.photo_url || null,
              }))}
              selectedPetId={selectedPetId}
              onSelect={setSelectedPetId}
              onAddPet={() => setDialogOpen(true)}
            />

            {/* === PETS TAB (default) === */}
            {activeTab === "pets" && selectedPet && (
              <>
                {/* Hero Card */}
                <PetHeroCard
                  petName={selectedPet.pet_name}
                  breedName={selectedPet.breed_name}
                  ageYears={selectedPet.dog_age_years}
                  ageMonths={selectedPet.dog_age_months}
                  profilePhoto={profilePhoto}
                  totalBookings={petBookings.length}
                  onUploadPhoto={() => profilePhotoRef.current?.click()}
                />
                <input ref={profilePhotoRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoUpload} />

                {/* Upcoming Appointment */}
                <UpcomingAppointmentCard booking={upcomingBooking || null} />

                {/* AI Breed Advice Feed */}
                {user && (
                  <BreedAdviceFeed
                    breedId={selectedPet.breed_id}
                    breedName={selectedPet.breed_name}
                    userId={user.id}
                  />
                )}

                {/* Groomer's Corner */}
                <GroomersCorner recommendations={recommendations} petName={selectedPet.pet_name} />
              </>
            )}

            {/* === BOOKINGS TAB === */}
            {activeTab === "bookings" && (
              <BookingsTab bookings={bookings as any} userEmail={user?.email || undefined} />
            )}

            {/* === PICTURES TAB === */}
            {activeTab === "pictures" && selectedPet && user && (
              <>
                <PawsitiveGallery
                  petId={selectedPet.id}
                  petName={selectedPet.pet_name}
                  photos={photos}
                  userId={user.id}
                  onRefresh={refreshPhotos}
                />
                <PicturesTab photos={allPhotos} petName={selectedPet?.pet_name || "Your pet"} />
              </>
            )}

            {/* === ADVICE TAB === */}
            {activeTab === "advice" && user && (
              <AdviceTab userId={user.id} />
            )}
          </>
        )}
      </div>

      {/* Bottom Nav Dock */}
      <BottomNavDock activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Add Pet Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add a Pet 🐶</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Pet Name</Label>
              <Input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="e.g. Buddy" />
            </div>
            <div className="space-y-2">
              <Label>Breed</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Search breed…"
                  value={breedSearch}
                  onChange={(e) => { setBreedSearch(e.target.value); setSelectedBreedId(null); }}
                  className="pl-10"
                />
              </div>
              {selectedBreedId && (
                <p className="text-sm text-accent font-medium">
                  ✓ {breeds.find((b: any) => b.id === selectedBreedId)?.name}
                </p>
              )}
              {breedSearch.length > 0 && !selectedBreedId && (
                <div className="border rounded-xl max-h-40 overflow-y-auto bg-card shadow-lg">
                  {filteredBreeds.length > 0 ? filteredBreeds.map((b: any) => (
                    <button
                      key={b.id}
                      onClick={() => { setSelectedBreedId(b.id); setBreedSearch(b.name); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                    >
                      {b.name}
                    </button>
                  )) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No breeds found</p>
                  )}
                </div>
              )}
            </div>
            <Button onClick={addPet} className="w-full bg-accent text-accent-foreground" disabled={!petName.trim()}>
              Add Pet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyPetsPage;
