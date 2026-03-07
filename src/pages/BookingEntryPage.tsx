import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, PawPrint, LogIn, LogOut, UserPlus, Dog, Plus, Search, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BookingFlow } from "@/components/BookingFlow";
import { ServiceJourney } from "@/components/ServiceJourney";
import logo from "@/assets/logo-transparent.png";
import { ErrorReportButton } from "@/components/error-reporting/ErrorReportButton";
import serviceFullGroom from "@/assets/service-full-groom.jpg";
import servicePuppy from "@/assets/service-puppy.jpg";
import serviceTeeth from "@/assets/service-teeth.jpg";
import serviceNails from "@/assets/service-nails.jpg";

interface PetWithBreed {
  id: string;
  pet_name: string;
  notes: string | null;
  breed_id: string | null;
  breed_name?: string;
  dog_age_years?: number | null;
  dog_age_months?: number | null;
}

const BookingEntryPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceParam = searchParams.get("service") || "Grooming";
  const hasSpecificService = searchParams.has("service");
  const rebookDogName = searchParams.get("dogName");
  const rebookBreedId = searchParams.get("breedId");
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Auth form state (for inline login)
  const [authMode, setAuthMode] = useState<"choose" | "login" | "forgot">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // New customer flow: skip signup, go straight to booking
  const [newCustomerBooking, setNewCustomerBooking] = useState(false);
  const [newCustomerService, setNewCustomerService] = useState<string | null>(null);

  // Pet selection / add-pet state
  const [showAddPet, setShowAddPet] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const [breedSearch, setBreedSearch] = useState("");
  const [selectedBreedId, setSelectedBreedId] = useState<string | null>(null);

  // Existing customer multi-step: pet → service → (missing info) → BookingFlow
  const [selectedPet, setSelectedPet] = useState<PetWithBreed | null>(null);
  const [selectedServiceForPet, setSelectedServiceForPet] = useState<string | null>(null);
  const [missingInfoStep, setMissingInfoStep] = useState(false);
  const [missingBreedId, setMissingBreedId] = useState<string | null>(null);
  const [missingBreedSearch, setMissingBreedSearch] = useState("");
  const [missingAgeYears, setMissingAgeYears] = useState<string>("0");
  const [missingAgeMonths, setMissingAgeMonths] = useState<string>("0");

  // Booking flow state
  const [activeBooking, setActiveBooking] = useState<{ petId: string; breedId: string | null; petName: string; service: string; dogAgeYears?: number | null; dogAgeMonths?: number | null } | null>(null);

  // Fetch customer pets
  const { data: pets = [], refetch: refetchPets } = useQuery({
    queryKey: ["customer-pets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("customer_pets")
        .select("id, pet_name, notes, breed_id, dog_age_years, dog_age_months, breeds(name)")
        .eq("user_id", user.id)
        .order("created_at");
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        pet_name: p.pet_name,
        notes: p.notes,
        breed_id: p.breed_id,
        breed_name: p.breeds?.name || null,
        dog_age_years: p.dog_age_years,
        dog_age_months: p.dog_age_months,
      })) as PetWithBreed[];
    },
    enabled: !!user,
  });

  // Auto-rebook: if URL has dogName + service, auto-select pet and jump to booking
  const [rebookHandled, setRebookHandled] = useState(false);
  useEffect(() => {
    if (rebookHandled || !user || !rebookDogName || !hasSpecificService || pets.length === 0) return;
    const matchedPet = pets.find(p => p.pet_name.toLowerCase() === rebookDogName.toLowerCase());
    if (matchedPet) {
      setRebookHandled(true);
      const breedId = matchedPet.breed_id || rebookBreedId || null;
      setActiveBooking({
        petId: matchedPet.id,
        breedId,
        petName: matchedPet.pet_name,
        service: serviceParam,
        dogAgeYears: matchedPet.dog_age_years,
        dogAgeMonths: matchedPet.dog_age_months,
      });
    }
  }, [user, rebookDogName, hasSpecificService, pets, rebookHandled, serviceParam, rebookBreedId]);

  const { data: breeds = [] } = useQuery({
    queryKey: ["breeds-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breeds").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filteredBreeds = breedSearch.length > 0
    ? breeds.filter(b => b.name.toLowerCase().includes(breedSearch.toLowerCase()))
    : [];

  const filteredMissingBreeds = missingBreedSearch.length > 0
    ? breeds.filter(b => b.name.toLowerCase().includes(missingBreedSearch.toLowerCase()))
    : [];

  // Auth handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email sent", description: "Check your inbox for a password reset link." });
    }
  };

  // Add pet handler
  const handleAddPet = async () => {
    if (!user || !newPetName.trim()) return;
    const { error } = await supabase.from("customer_pets").insert({
      user_id: user.id,
      pet_name: newPetName.trim(),
      breed_id: selectedBreedId,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${newPetName.trim()} added!` });
      setNewPetName("");
      setSelectedBreedId(null);
      setBreedSearch("");
      setShowAddPet(false);
      refetchPets();
    }
  };

  // Select pet → show service picker
  const selectPetForBooking = (pet: PetWithBreed) => {
    setSelectedPet(pet);
    setSelectedServiceForPet(null);
    setMissingInfoStep(false);
  };

  // Does service need breed?
  const serviceNeedsBreed = (svc: string) => svc === "Grooming" || svc === "Puppy Special";

  // Handle service selection for existing customer's pet
  const handleServiceForPet = async (serviceName: string) => {
    if (!selectedPet) return;
    const needsBreed = serviceNeedsBreed(serviceName);
    const hasMissingBreed = needsBreed && !selectedPet.breed_id;
    const hasMissingAge = needsBreed && (selectedPet.dog_age_years == null && selectedPet.dog_age_months == null);

    if (hasMissingBreed || hasMissingAge) {
      setSelectedServiceForPet(serviceName);
      setMissingInfoStep(true);
      setMissingBreedId(selectedPet.breed_id);
      setMissingBreedSearch(selectedPet.breed_name || "");
      setMissingAgeYears(selectedPet.dog_age_years != null ? String(selectedPet.dog_age_years) : "0");
      setMissingAgeMonths(selectedPet.dog_age_months != null ? String(selectedPet.dog_age_months) : "0");
    } else {
      // All info present, go to booking
      setActiveBooking({
        petId: selectedPet.id,
        breedId: selectedPet.breed_id,
        petName: selectedPet.pet_name,
        service: serviceName,
        dogAgeYears: selectedPet.dog_age_years,
        dogAgeMonths: selectedPet.dog_age_months,
      });
    }
  };

  // Save missing info and proceed
  const handleMissingInfoSubmit = async () => {
    if (!selectedPet || !selectedServiceForPet) return;
    const needsBreed = serviceNeedsBreed(selectedServiceForPet);
    const breedId = needsBreed ? (missingBreedId || selectedPet.breed_id) : selectedPet.breed_id;
    const ageYears = parseInt(missingAgeYears) || 0;
    const ageMonths = parseInt(missingAgeMonths) || 0;

    // Update pet with missing info
    const updates: any = {};
    if (needsBreed && !selectedPet.breed_id && breedId) updates.breed_id = breedId;
    if (needsBreed && selectedPet.dog_age_years == null) {
      updates.dog_age_years = ageYears;
      updates.dog_age_months = ageMonths;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("customer_pets").update(updates).eq("id", selectedPet.id);
      refetchPets();
    }

    setActiveBooking({
      petId: selectedPet.id,
      breedId: breedId,
      petName: selectedPet.pet_name,
      service: selectedServiceForPet,
      dogAgeYears: ageYears,
      dogAgeMonths: ageMonths,
    });
    setMissingInfoStep(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  // If booking flow is active (logged-in user selected a pet + service)
  if (activeBooking) {
    return (
      <BookingFlow
        service={activeBooking.service}
        onClose={() => { setActiveBooking(null); setSelectedPet(null); setSelectedServiceForPet(null); }}
        preselectedBreedId={activeBooking.breedId}
        preselectedPetName={activeBooking.petName}
        dogAgeYears={activeBooking.dogAgeYears}
        dogAgeMonths={activeBooking.dogAgeMonths}
      />
    );
  }

  // New customer flow: service selection then booking
  const allServices = [
    { title: "Grooming", subtitle: "The ultimate pamper session — wash, dry, cut & style. Your pup leaves looking like a supermodel.", image: serviceFullGroom, imagePosition: "50% 43%" },
    { title: "Puppy Special", subtitle: "A gentle, fun first grooming experience. We go at their pace with loads of treats & cuddles.", image: servicePuppy, imagePosition: "50% 52%" },
    { title: "Ultrasonic Teeth Cleaning", subtitle: "Fresh gums and pearly whites for your best friend. Say goodbye to bad breath.", image: serviceTeeth },
    { title: "Nail Trim & Filing", subtitle: "Quick, painless trim so those tippy-taps stay happy and healthy.", image: serviceNails, imagePosition: "48% 63%" },
  ];

  if (newCustomerBooking && newCustomerService) {
    return (
      <BookingFlow
        service={newCustomerService}
        onClose={() => { setNewCustomerService(null); setNewCustomerBooking(false); }}
        isNewCustomer
      />
    );
  }

  if (newCustomerBooking && !newCustomerService) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 bg-background border-b border-border/30">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <button onClick={() => setNewCustomerBooking(false)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-semibold font-body">Back</span>
            </button>
            <div className="flex items-center gap-2">
              {user ? (
                <button onClick={async () => { await supabase.auth.signOut(); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
                  <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign Out</span>
                </button>
              ) : (
                <button onClick={() => { setNewCustomerBooking(false); setAuthMode("login"); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
                  <LogIn className="h-4 w-4" /><span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </nav>
        <ServiceJourney services={allServices} onSelectService={(title) => setNewCustomerService(title)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-background border-b border-border/30">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => {
            if (missingInfoStep) { setMissingInfoStep(false); return; }
            if (selectedPet && selectedServiceForPet) { setSelectedServiceForPet(null); return; }
            if (selectedPet) { setSelectedPet(null); return; }
            navigate("/");
          }} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-semibold font-body">Back</span>
          </button>
          <div className="flex items-center gap-2">
            {user ? (
              <button onClick={async () => { await supabase.auth.signOut(); navigate("/"); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
                <LogOut className="h-4 w-4" /><span>Sign Out</span>
              </button>
            ) : (
              <button onClick={() => setAuthMode("login")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
                <LogIn className="h-4 w-4" /><span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
        {/* NOT LOGGED IN — show login/register choice */}
        {!user && (
          <>
            {authMode === "choose" && (
              <div className="space-y-8 animate-fade-in">
                <div className="text-center">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-accent/10" style={{ borderRadius: '50%' }}>
                    <PawPrint className="h-7 w-7 text-accent" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-heading text-foreground">Let's Book Your Pup In</h1>
                  <p className="text-muted-foreground text-sm font-body mt-2 max-w-xs mx-auto">
                    Sign in to your account or create one to get started
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setAuthMode("login")}
                    className="w-full bg-card p-5 text-left hover:shadow-lg transition-all duration-300 group shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                    style={{ borderRadius: '24px' }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-accent/10" style={{ borderRadius: '16px' }}>
                        <LogIn className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold font-body text-foreground">Returning Customer</p>
                        <p className="text-sm text-muted-foreground font-body">Sign in to your account</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                  </button>

                  <button
                    onClick={() => { setNewCustomerBooking(true); if (hasSpecificService) setNewCustomerService(serviceParam); }}
                    className="w-full bg-card p-5 text-left hover:shadow-lg transition-all duration-300 group shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                    style={{ borderRadius: '24px' }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-accent/10" style={{ borderRadius: '16px' }}>
                        <UserPlus className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold font-body text-foreground">New Here?</p>
                        <p className="text-sm text-muted-foreground font-body">Browse services &amp; prices first</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {authMode === "login" && (
              <div className="space-y-6 animate-fade-in">
                <button onClick={() => setAuthMode("choose")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="text-center">
                  <h1 className="text-2xl font-heading text-foreground">Welcome Back</h1>
                  <p className="text-muted-foreground text-sm mt-1">Sign in to continue booking</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Signing in…" : "Sign In"}
                  </Button>
                </form>
                <div className="text-center text-sm space-y-2">
                  <button onClick={() => setAuthMode("forgot")} className="text-muted-foreground hover:text-foreground transition-colors">Forgot password?</button>
                  <p className="text-muted-foreground">New here?{" "}
                    <button onClick={() => { setAuthMode("choose"); setNewCustomerBooking(true); }} className="text-foreground font-medium hover:underline">Browse services</button>
                  </p>
                </div>
              </div>
            )}

            {authMode === "forgot" && (
              <div className="space-y-6 animate-fade-in">
                <button onClick={() => setAuthMode("login")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </button>
                <div className="text-center">
                  <h1 className="text-2xl font-heading text-foreground">Reset Password</h1>
                  <p className="text-muted-foreground text-sm mt-1">We'll send you a link to reset it</p>
                </div>
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgotEmail">Email</Label>
                    <Input id="forgotEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@example.com" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Sending…" : "Send Reset Link"}
                  </Button>
                </form>
              </div>
            )}
          </>
        )}

        {/* LOGGED IN */}
        {user && !selectedPet && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mx-auto mb-4">
                <PawPrint className="h-7 w-7 text-accent" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading text-foreground">Who's Getting Pampered?</h1>
              <p className="text-muted-foreground text-sm mt-2">Select a pet or add a new one</p>
            </div>

            {/* Existing pets */}
            {pets.length > 0 && (
              <div className="space-y-3">
                {pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => selectPetForBooking(pet)}
                    className="w-full rounded-2xl border-2 border-border/60 bg-card p-4 text-left hover:border-accent/40 hover:shadow-lg hover:shadow-black/[0.04] transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                        <Dog className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{pet.pet_name}</p>
                        <p className="text-sm text-muted-foreground">{pet.breed_name || "Breed not set"}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Add new pet */}
            {!showAddPet ? (
              <button
                onClick={() => setShowAddPet(true)}
                className="w-full rounded-2xl border-2 border-dashed border-border/60 bg-card/50 p-4 text-center hover:border-accent/40 transition-all duration-300"
              >
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Plus className="h-5 w-5" />
                  <span className="font-medium">Add a New Dog</span>
                </div>
              </button>
            ) : (
              <div className="rounded-2xl border-2 border-accent/30 bg-card p-5 space-y-4 animate-fade-in">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <PawPrint className="h-4 w-4 text-accent" /> Add a New Dog
                </h3>
                <div className="space-y-2">
                  <Label>Dog's Name</Label>
                  <Input
                    value={newPetName}
                    onChange={(e) => setNewPetName(e.target.value)}
                    placeholder="e.g. Buddy"
                  />
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
                      ✓ {breeds.find(b => b.id === selectedBreedId)?.name}
                    </p>
                  )}
                  {breedSearch.length > 0 && !selectedBreedId && (
                    <div className="border rounded-xl max-h-40 overflow-y-auto bg-card shadow-lg">
                      {filteredBreeds.length > 0 ? filteredBreeds.map(b => (
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
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setShowAddPet(false); setNewPetName(""); setBreedSearch(""); setSelectedBreedId(null); }} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleAddPet} disabled={!newPetName.trim()} className="flex-1">
                    Add Dog
                  </Button>
                </div>
              </div>
            )}

            {/* No pets prompt */}
            {pets.length === 0 && !showAddPet && (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm">Add your first dog to get started with booking</p>
              </div>
            )}
          </div>
        )}

        {/* LOGGED IN — Pet selected, show service picker */}
        {user && selectedPet && !missingInfoStep && !selectedServiceForPet && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mx-auto mb-4">
                <Dog className="h-7 w-7 text-accent" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading text-foreground">What does {selectedPet.pet_name} need?</h1>
              <p className="text-muted-foreground text-sm mt-2">Choose a service</p>
            </div>

            <div className="space-y-3">
              {allServices.map((svc) => (
                <button
                  key={svc.title}
                  onClick={() => handleServiceForPet(svc.title)}
                  className="w-full rounded-2xl border-2 border-border/60 bg-card p-4 text-left hover:border-accent/40 hover:shadow-lg hover:shadow-black/[0.04] transition-all duration-300 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden">
                      <img src={svc.image} alt={svc.title} className="h-full w-full object-cover" style={{ objectPosition: svc.imagePosition || "50% 50%" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{svc.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{svc.subtitle}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LOGGED IN — Missing info step (breed/age) */}
        {user && selectedPet && missingInfoStep && selectedServiceForPet && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mx-auto mb-4">
                <PawPrint className="h-7 w-7 text-accent" />
              </div>
              <h1 className="text-2xl font-heading text-foreground">A few more details about {selectedPet.pet_name}</h1>
              <p className="text-muted-foreground text-sm mt-2">We need this to match the best service & pricing</p>
            </div>

            {/* Breed picker (only if missing) */}
            {!selectedPet.breed_id && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Breed</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    placeholder="Search breed…"
                    value={missingBreedSearch}
                    onChange={(e) => { setMissingBreedSearch(e.target.value); setMissingBreedId(null); }}
                    className="pl-10 h-12 rounded-xl"
                  />
                </div>
                {missingBreedId && (
                  <p className="text-sm text-accent font-medium">
                    ✓ {breeds.find(b => b.id === missingBreedId)?.name}
                  </p>
                )}
                {missingBreedSearch.length > 0 && !missingBreedId && (
                  <div className="border rounded-xl max-h-40 overflow-y-auto bg-card shadow-lg">
                    {filteredMissingBreeds.length > 0 ? filteredMissingBreeds.map(b => (
                      <button
                        key={b.id}
                        onClick={() => { setMissingBreedId(b.id); setMissingBreedSearch(b.name); }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                      >
                        {b.name}
                      </button>
                    )) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No breeds found</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Age picker (only if missing) */}
            {selectedPet.dog_age_years == null && selectedPet.dog_age_months == null && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{selectedPet.pet_name}'s Age</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Years</Label>
                    <Select value={missingAgeYears} onValueChange={setMissingAgeYears}>
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 21 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>{i} {i === 1 ? "year" : "years"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Months</Label>
                    <Select value={missingAgeMonths} onValueChange={setMissingAgeMonths}>
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>{i} {i === 1 ? "month" : "months"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleMissingInfoSubmit}
              className="w-full h-14 text-base rounded-xl"
              size="lg"
              disabled={!selectedPet.breed_id && !missingBreedId}
            >
              Continue to Booking
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingEntryPage;
