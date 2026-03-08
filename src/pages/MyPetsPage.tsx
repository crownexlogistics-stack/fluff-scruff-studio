import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Dog, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CustomerHeader } from "@/components/customer-portal/CustomerHeader";
import { BottomNavDock, type PortalTab } from "@/components/customer-portal/BottomNavDock";
import { PetStoryIcons } from "@/components/my-account/PetStoryIcons";
import { UpcomingAppointmentCard } from "@/components/customer-portal/UpcomingAppointmentCard";
import { BreedAdviceFeed } from "@/components/customer-portal/BreedAdviceFeed";
import { BookingsTab } from "@/components/customer-portal/BookingsTab";
import { PicturesTab } from "@/components/customer-portal/PicturesTab";
import { AdviceTab } from "@/components/customer-portal/AdviceTab";
import { PawsitiveGallery } from "@/components/my-account/PawsitiveGallery";
import { GroomersCorner } from "@/components/my-account/GroomersCorner";
import { NumericInput } from "@/components/ui/numeric-input";
import { ErrorReportButton } from "@/components/error-reporting/ErrorReportButton";
import { AIChatWidget } from "@/components/AIChatWidget";

const MyPetsPage = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PortalTab>("pets");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [petName, setPetName] = useState("");
  const [breedSearch, setBreedSearch] = useState("");
  const [selectedBreedId, setSelectedBreedId] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const editPhotoRef = useRef<HTMLInputElement>(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);

  // Edit pet state
  const [editName, setEditName] = useState("");
  const [editBreedSearch, setEditBreedSearch] = useState("");
  const [editBreedId, setEditBreedId] = useState<string | null>(null);
  const [editAgeYears, setEditAgeYears] = useState("");
  const [editAgeMonths, setEditAgeMonths] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!user?.email) return;

    const channel = supabase
      .channel(`customer-bookings-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "bookings",
        filter: `customer_email=eq.${user.email}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["my-bookings", user.email] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.email, user?.id]);

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

  // Profile photo = most recent CUSTOMER-uploaded photo only (groomers can't change it)
  const profilePhoto = photos.find((p: any) => p.uploaded_by_role === "customer")?.photo_url || null;

  const normalizeBookingStatus = (raw?: string | null) => (raw || "").trim().toLowerCase();
  const isClosedBookingStatus = (raw?: string | null) => {
    const status = normalizeBookingStatus(raw);
    return status.includes("refund") || status.includes("cancel") || status === "completed" || status === "no show";
  };

  // Find next upcoming active booking
  const upcomingBooking = [...bookings]
    .filter((b: any) => {
      const status = normalizeBookingStatus(b.status);
      const appointmentDateTime = new Date(`${b.booking_date}T${b.booking_time || "09:00"}`);
      return (status === "confirmed" || status === "pending") && !isClosedBookingStatus(b.status) && appointmentDateTime > new Date();
    })
    .sort((a: any, b: any) => {
      const aTime = new Date(`${a.booking_date}T${a.booking_time || "09:00"}`).getTime();
      const bTime = new Date(`${b.booking_date}T${b.booking_time || "09:00"}`).getTime();
      return aTime - bTime;
    })[0];

  const filteredBreeds = breedSearch.length > 0
    ? breeds.filter((b: any) => b.name.toLowerCase().includes(breedSearch.toLowerCase()))
    : [];

  const editFilteredBreeds = editBreedSearch.length > 0
    ? breeds.filter((b: any) => b.name.toLowerCase().includes(editBreedSearch.toLowerCase()))
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

  const refreshPhotos = () => {
    queryClient.invalidateQueries({ queryKey: ["pet-photos", selectedPetId] });
    queryClient.invalidateQueries({ queryKey: ["all-pet-photos", user?.id] });
  };

  const uploadPhotoAndSync = async (file: File, petId: string) => {
    if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${petId}/profile_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("pet-photos").upload(path, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from("pet-photos").getPublicUrl(path);
    const { error: insertError } = await supabase.from("pet_photos").insert({
      pet_id: petId,
      user_id: user.id,
      photo_url: publicUrl,
      uploaded_by_role: "customer",
      caption: "Profile photo",
    });
    if (insertError) throw insertError;

    // Sync to user profile avatar_url
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);

    return publicUrl;
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedPetId) return;
    setUploadingProfile(true);
    try {
      await uploadPhotoAndSync(file, selectedPetId);
      toast({ title: "Profile photo updated! 📸" });
      refreshPhotos();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingProfile(false);
      if (profilePhotoRef.current) profilePhotoRef.current.value = "";
    }
  };

  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedPetId) return;
    setUploadingProfile(true);
    try {
      await uploadPhotoAndSync(file, selectedPetId);
      toast({ title: "Photo updated! 📸" });
      refreshPhotos();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingProfile(false);
      if (editPhotoRef.current) editPhotoRef.current.value = "";
    }
  };

  const openEditDialog = () => {
    if (!selectedPet) return;
    setEditName(selectedPet.pet_name);
    setEditBreedId(selectedPet.breed_id || null);
    setEditBreedSearch(selectedPet.breed_name || "");
    setEditAgeYears(selectedPet.dog_age_years?.toString() || "");
    setEditAgeMonths(selectedPet.dog_age_months?.toString() || "");
    setEditDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedPetId || !editName.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase.from("customer_pets").update({
        pet_name: editName.trim(),
        breed_id: editBreedId,
        dog_age_years: editAgeYears ? parseInt(editAgeYears) : null,
        dog_age_months: editAgeMonths ? parseInt(editAgeMonths) : null,
      }).eq("id", selectedPetId);
      if (error) throw error;
      toast({ title: "Pet updated! ✏️" });
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-pets"] });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const customerName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const petMessage = selectedPet
    ? `${selectedPet.pet_name} is looking forward to his next pamper 🐾`
    : "Add a pet to get started! 🐾";

  return (
    <div className="min-h-screen bg-background pb-20">
      <CustomerHeader user={user} signOut={signOut} />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
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
            <p className="text-sm text-muted-foreground mb-4 font-body">Add your furry friend to get started!</p>
            <Button onClick={() => setDialogOpen(true)} className="bg-accent text-accent-foreground" style={{ borderRadius: '30px' }}>
              Add Your First Pet
            </Button>
          </div>
        ) : (
          <>
            {/* Greeting Section */}
            {activeTab === "pets" && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-semibold">
                  Welcome Back
                </p>
                <h1 className="text-[32px] font-heading text-foreground leading-tight">
                  Hey {customerName}! 👋
                </h1>
                <p className="text-sm text-muted-foreground font-body">
                  {petMessage}
                </p>
              </div>
            )}

            <PetStoryIcons
              pets={pets.map((p: any) => ({
                id: p.id,
                pet_name: p.pet_name,
                breed_name: p.breed_name,
                profile_photo: allPhotos.find((ph: any) => ph.pet_id === p.id && ph.uploaded_by_role === "customer")?.photo_url || null,
              }))}
              selectedPetId={selectedPetId}
              onSelect={setSelectedPetId}
              onAddPet={() => setDialogOpen(true)}
            />

            {/* Edit button under pet icons */}
            {selectedPet && activeTab === "pets" && (
              <div className="flex justify-center -mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground font-body"
                  onClick={openEditDialog}
                >
                  <Pencil className="h-3 w-3" />
                  Edit {selectedPet.pet_name}
                </Button>
              </div>
            )}

            {/* === PETS TAB (default) === */}
            {activeTab === "pets" && selectedPet && (
              <>
                <UpcomingAppointmentCard booking={upcomingBooking || null} />

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { emoji: "📋", label: "Bookings", tab: "bookings" as PortalTab },
                    { emoji: "📸", label: "Photos", tab: "pictures" as PortalTab },
                    { emoji: "💡", label: "My Advice", tab: "advice" as PortalTab },
                  ].map((action) => (
                    <button
                      key={action.tab}
                      onClick={() => setActiveTab(action.tab)}
                      className="bg-card rounded-[20px] p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <span className="text-2xl">{action.emoji}</span>
                      <span className="text-[12px] font-bold font-body text-foreground">{action.label}</span>
                    </button>
                  ))}
                </div>

                {user && (
                  <BreedAdviceFeed
                    breedId={selectedPet.breed_id}
                    breedName={selectedPet.breed_name}
                    userId={user.id}
                  />
                )}

                <GroomersCorner recommendations={recommendations} petName={selectedPet.pet_name} />
              </>
            )}

            {activeTab === "bookings" && (
              <BookingsTab bookings={bookings as any} userEmail={user?.email || undefined} />
            )}

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

            {activeTab === "advice" && user && (
              <AdviceTab userId={user.id} />
            )}
          </>
        )}
      </div>

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

      {/* Edit Pet Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Pet ✏️</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Profile photo change */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-muted flex items-center justify-center border-2 border-border">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Pet" className="w-full h-full object-cover" />
                ) : (
                  <Dog className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => editPhotoRef.current?.click()}
                disabled={uploadingProfile}
              >
                {uploadingProfile ? "Uploading…" : "Change Photo"}
              </Button>
              <input ref={editPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleEditPhotoUpload} />
            </div>

            <div className="space-y-2">
              <Label>Pet Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Pet name" />
            </div>

            <div className="space-y-2">
              <Label>Breed</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Search breed…"
                  value={editBreedSearch}
                  onChange={(e) => { setEditBreedSearch(e.target.value); setEditBreedId(null); }}
                  className="pl-10"
                />
              </div>
              {editBreedId && (
                <p className="text-sm text-accent font-medium">
                  ✓ {breeds.find((b: any) => b.id === editBreedId)?.name}
                </p>
              )}
              {editBreedSearch.length > 0 && !editBreedId && (
                <div className="border rounded-xl max-h-40 overflow-y-auto bg-card shadow-lg">
                  {editFilteredBreeds.length > 0 ? editFilteredBreeds.map((b: any) => (
                    <button
                      key={b.id}
                      onClick={() => { setEditBreedId(b.id); setEditBreedSearch(b.name); }}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Age (Years)</Label>
                <NumericInput value={editAgeYears} onValueChange={(v) => setEditAgeYears(String(v))} allowDecimals={false} placeholder="e.g. 5" />
              </div>
              <div className="space-y-2">
                <Label>Age (Months)</Label>
                <NumericInput value={editAgeMonths} onValueChange={(v) => setEditAgeMonths(String(v))} allowDecimals={false} placeholder="e.g. 6" />
              </div>
            </div>

            <Button onClick={saveEdit} className="w-full bg-accent text-accent-foreground" disabled={!editName.trim() || savingEdit}>
              {savingEdit ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ErrorReportButton />
    </div>
  );
};

export default MyPetsPage;
