import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, Search, Dog, ChevronRight, PawPrint, Save, Move, Sparkles, Check, ChevronLeft, Calendar, Info, X, Lock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import serviceBathBrush from "@/assets/service-bath-brush.jpg";
import serviceFullGroomSub from "@/assets/service-full-groom-sub.jpg";

const ADJUST_MODE = false;

type Step = "sub-service" | "breed" | "calendar" | "addons" | "guest-details" | null;

interface BookingFlowProps {
  service: string;
  onClose: () => void;
  preselectedBreedId?: string | null;
  preselectedPetName?: string;
  isNewCustomer?: boolean;
}

const subServices = [
  {
    label: "Full Groom",
    desc: "Everything in Bath & Brush plus a full haircut, style & nail trim. The complete pamper package, they'll strut out looking brand new.",
    image: serviceFullGroomSub,
    defaultPosition: "50% 40%",
  },
  {
    label: "Bath & Brush",
    desc: "A luxurious bath with amazing shampoos & conditioners, followed by a thorough brush-out. Your pup leaves fresh, soft & smelling incredible.",
    image: serviceBathBrush,
    defaultPosition: "50% 35%",
  },
];

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}hr ${m}min`;
  if (h) return `${h}hr`;
  return `${m}min`;
}

function parsePosition(pos: string) {
  const parts = pos.split(" ");
  return { x: parseFloat(parts[0]), y: parseFloat(parts[1]) };
}

// Week-strip helpers
function getWeekDays(startDate: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }
  return days;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function BookingFlow({ service, onClose, preselectedBreedId, preselectedPetName, isNewCustomer }: BookingFlowProps) {
  // Fetch matching service record from DB (for fixed-price services)
  const { data: dbService } = useQuery({
    queryKey: ["service-record", service],
    queryFn: async () => {
      // Try to find a service matching the name
      const { data, error } = await supabase
        .from("services")
        .select("id, name, fixed_price, duration_minutes")
        .eq("is_active", true)
        .ilike("name", `%${service}%`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: service !== "Grooming",
  });

  const isFixedPrice = service !== "Grooming" && dbService?.fixed_price != null;

  // If breed is preselected, skip to sub-service (for grooming) or calendar
  const getInitialStep = (): Step => {
    if (isFixedPrice) return "calendar";
    if (preselectedBreedId) return service === "Grooming" ? "sub-service" : "calendar";
    return service === "Grooming" ? "sub-service" : "breed";
  };

  const [step, setStep] = useState<Step>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [breedSearch, setBreedsSearch] = useState("");
  const [selectedBreed, setSelectedBreed] = useState<any>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [infoPopup, setInfoPopup] = useState<{ name: string; description: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [guestForm, setGuestForm] = useState({ name: "", phone: "", email: "", dogName: preselectedPetName || "", password: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const queryClient = useQueryClient();

  // Set initial step once we know if it's fixed-price
  useEffect(() => {
    if (step === null) {
      setStep(getInitialStep());
    }
  }, [dbService, isFixedPrice]);

  // Week-strip state
  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => getMonday(today));

  // Load saved positions from DB
  const { data: savedPositions } = useQuery({
    queryKey: ["site_config", "sub_service_images"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_config").select("value").eq("key", "sub_service_images").single();
      if (error) return null;
      return data?.value as Record<string, string> | null;
    },
  });

  const getPosition = (label: string, defaultPos: string) => {
    if (savedPositions && savedPositions[label]) return savedPositions[label];
    return defaultPos;
  };

  const [positions, setPositions] = useState<{ x: number; y: number }[] | null>(null);
  const dragRef = useRef<{ idx: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const adjustPositions = positions ?? subServices.map((s) => {
    const pos = getPosition(s.label, s.defaultPosition);
    return parsePosition(pos);
  });

  const saveMutation = useMutation({
    mutationFn: async (newPositions: { x: number; y: number }[]) => {
      const value: Record<string, string> = {};
      subServices.forEach((s, i) => {
        value[s.label] = `${newPositions[i].x.toFixed(1)}% ${newPositions[i].y.toFixed(1)}%`;
      });
      const { error } = await supabase.from("site_config").upsert({ key: "sub_service_images", value, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site_config", "sub_service_images"] });
      toast.success("Image positions saved!");
    },
    onError: () => toast.error("Failed to save — are you logged in as a manager?"),
  });

  const { data: breeds } = useQuery({
    queryKey: ["breeds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breeds").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Auto-select breed if preselected
  useEffect(() => {
    if (preselectedBreedId && breeds && !selectedBreed) {
      const breed = breeds.find(b => b.id === preselectedBreedId);
      if (breed) setSelectedBreed(breed);
    }
  }, [preselectedBreedId, breeds, selectedBreed]);


  // Fetch add-ons from DB
  const { data: dbAddOns } = useQuery({
    queryKey: ["add_ons_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("add_ons").select("*").eq("is_active", true).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const filteredBreeds = breedSearch.length > 0
    ? breeds?.filter((b) => b.name.toLowerCase().includes(breedSearch.toLowerCase()))
    : breeds;

  const serviceType = selectedSub ?? service;
  const basePrice = isFixedPrice
    ? Number(dbService!.fixed_price)
    : selectedBreed
      ? (serviceType === "Bath & Brush" ? selectedBreed.price_bath_brush : selectedBreed.price_full_groom)
      : 0;
  const serviceDuration = isFixedPrice
    ? (dbService!.duration_minutes ?? 60)
    : (selectedBreed?.duration_minutes ?? 60);
  const addOnsTotal = selectedAddOns.reduce((sum, id) => {
    const addon = dbAddOns?.find(a => a.id === id);
    return sum + (addon ? Number(addon.price) : 0);
  }, 0);
  const totalPrice = basePrice + addOnsTotal;

  const handleSubSelect = (sub: string) => {
    setSelectedSub(sub);
    setStep("breed");
  };

  const handleBreedSelect = (breed: any | null) => {
    setSelectedBreed(breed);
    setSelectedAddOns([]);
    setSelectedDate(null);
    setSelectedTime(null);
    setStep("calendar");
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOns(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const handleGuestSubmit = async () => {
    if (!guestForm.name.trim() || !guestForm.dogName.trim()) {
      toast.error("Please fill in your name and dog's name");
      return;
    }
    if (!acceptedTerms) {
      toast.error("Please accept the Terms & Conditions to continue");
      return;
    }

    // New customer: create account first
    if (isNewCustomer) {
      if (!guestForm.email.trim() || !guestForm.password.trim()) {
        toast.error("Please enter your email and choose a password");
        return;
      }
      if (guestForm.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: guestForm.email,
        password: guestForm.password,
        options: {
          data: { full_name: guestForm.name },
          emailRedirectTo: `${window.location.origin}/book`,
        },
      });

      if (signUpError) {
        toast.error(signUpError.message);
        return;
      }

      // Save pet to customer_pets if we have a user
      const userId = signUpData.user?.id;
      if (userId) {
        try {
          await supabase.from("customer_pets").insert({
            user_id: userId,
            pet_name: guestForm.dogName,
            breed_id: selectedBreed?.id ?? null,
          });
        } catch { /* ignore */ }
      }
    }

    const { data: insertedBooking, error } = await supabase.from("bookings").insert({
      customer_name: guestForm.name,
      customer_phone: guestForm.phone || null,
      customer_email: guestForm.email || null,
      dog_name: guestForm.dogName,
      breed_id: selectedBreed?.id ?? null,
      service_id: dbService?.id ?? null,
      booking_date: selectedDate!,
      booking_time: selectedTime!,
      total_price: totalPrice,
      status: "Pending",
    }).select("id").single();

    if (error) {
      toast.error("Failed to book — please try again");
      return;
    }

    // Send confirmation email if customer provided email
    if (guestForm.email && insertedBooking?.id) {
      supabase.functions.invoke("send-booking-email", {
        body: { booking_id: insertedBooking.id, email_type: "confirmation" },
      }).catch(() => {}); // fire-and-forget
    }

    if (isNewCustomer) {
      toast.success("Booking confirmed! Check your email to verify your account.");
    } else {
      toast.success("Booking confirmed! We'll be in touch.");
    }
    onClose();
  };

  const goBack = useCallback(() => {
    if (step === "guest-details" && isFixedPrice) {
      setStep("calendar");
    } else if (step === "guest-details") {
      setStep("addons");
    } else if (step === "addons") {
      setStep("calendar");
      setSelectedTime(null);
    } else if (step === "calendar" && !isFixedPrice) {
      setStep("breed");
      setSelectedBreed(null);
      setBreedsSearch("");
      setSelectedDate(null);
      setSelectedTime(null);
    } else if (step === "breed" && service === "Grooming") {
      setStep("sub-service");
      setSelectedSub(null);
    } else {
      onClose();
    }
  }, [step, service, onClose]);

  // Generate time slots
  const generateTimeSlots = () => {
    const slots: string[] = [];
    const durationMins = serviceDuration;
    const startHour = 8;
    const endHour = 18;
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        const endMins = h * 60 + m + durationMins;
        if (endMins <= endHour * 60) {
          slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
      }
    }
    return slots;
  };

  // Week-strip: check if a date is selectable (not in the past, not Sunday)
  const isDateSelectableDate = (d: Date) => {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (d <= todayStart) return false;
    if (d.getDay() === 0) return false; // Sunday
    return true;
  };

  const formatSelectedDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  };

  const handleDateClickDate = (d: Date) => {
    if (!isDateSelectableDate(d)) return;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setSelectedTime(null);
  };

  const handleTimeClick = (time: string) => {
    setSelectedTime(time);
    // Fixed-price services skip add-ons
    setTimeout(() => setStep(isFixedPrice ? "guest-details" : "addons"), 300);
  };

  const prevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    const thisMonday = getMonday(today);
    if (prev >= thisMonday) setWeekStart(prev);
  };

  const nextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const canGoPrevWeek = weekStart > getMonday(today);
  const weekDays = getWeekDays(weekStart);
  const weekMonth = weekDays[3]; // Use Thursday to determine the displayed month

  const getAddonIcon = (iconName: string | null) => {
    if (iconName === "Dog") return Dog;
    return Sparkles;
  };

  if (step === null) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background animate-slide-up flex flex-col">
      {/* Header */}
      <div className="glass sticky top-0 z-10 px-4 py-3 flex items-center gap-3 safe-area-top">
        <button onClick={goBack} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted active:scale-95 transition-transform touch-target">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold font-body">
            {step === "sub-service" ? service : step === "guest-details" ? "Your Details" : step === "addons" ? "Extras" : selectedSub ?? service}
          </h2>
          <p className="text-xs text-muted-foreground">
            {step === "sub-service" ? "Choose your style" : step === "breed" ? "Select breed" : step === "calendar" ? "Pick a date & time" : step === "addons" ? "Add the finishing touches" : "Almost done!"}
          </p>
        </div>
        {ADJUST_MODE && step === "sub-service" && (
          <button onClick={() => saveMutation.mutate(adjustPositions)} disabled={saveMutation.isPending} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-semibold active:scale-95 transition-transform">
            <Save className="h-4 w-4" /> {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Sub-service selection */}
        {step === "sub-service" && (
          <div className="px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
            {ADJUST_MODE && (
              <div className="flex items-center gap-2 justify-center mb-4 text-accent text-xs font-mono">
                <Move className="h-3 w-3" /> Drag images to reposition, then tap Save
              </div>
            )}
            <div className="text-center mb-8 sm:mb-12">
              <div className="flex items-center justify-center gap-2 mb-3">
                <PawPrint className="h-4 w-4 text-accent" />
                <p className="text-accent font-body text-xs uppercase tracking-[0.25em]">Grooming</p>
                <PawPrint className="h-4 w-4 text-accent" />
              </div>
              <h2 className="text-2xl sm:text-4xl font-heading text-foreground leading-tight">What type of groom?</h2>
              <div className="w-10 h-[2px] bg-accent/40 mx-auto mt-4 rounded-full" />
            </div>
            <div className="grid sm:grid-cols-2 gap-5 sm:gap-8 max-w-4xl mx-auto">
              {subServices.map((opt, idx) => {
                const pos = ADJUST_MODE
                  ? `${adjustPositions[idx].x}% ${adjustPositions[idx].y}%`
                  : getPosition(opt.label, opt.defaultPosition);
                return (
                  <button key={opt.label} onClick={ADJUST_MODE ? undefined : () => handleSubSelect(opt.label)} className="text-left group transition-colors duration-300">
                    <div className="relative bg-card rounded-3xl overflow-hidden border border-border/40 transition-[box-shadow,border-color,transform] duration-500 hover:shadow-xl hover:shadow-black/[0.06] hover:border-border/60 hover:-translate-y-1 active:scale-[0.98] shadow-md shadow-black/[0.03]">
                      <div className="relative overflow-hidden bg-card">
                        <img src={opt.image} alt={opt.label} className="w-full aspect-[4/3] object-cover block" style={{ objectPosition: pos, maxHeight: '220px', cursor: ADJUST_MODE ? 'grab' : undefined, touchAction: ADJUST_MODE ? 'none' : undefined }}
                          onPointerDown={ADJUST_MODE ? (e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); dragRef.current = { idx, startX: e.clientX, startY: e.clientY, origX: adjustPositions[idx].x, origY: adjustPositions[idx].y }; } : undefined}
                          onPointerMove={ADJUST_MODE ? (e) => { if (!dragRef.current || dragRef.current.idx !== idx) return; const { startX, startY, origX, origY } = dragRef.current; const dx = (e.clientX - startX) * -0.15; const dy = (e.clientY - startY) * -0.15; setPositions(prev => { const base = prev ?? subServices.map((s) => parsePosition(getPosition(s.label, s.defaultPosition))); return base.map((p, i) => i === idx ? { x: Math.min(100, Math.max(0, origX + dx)), y: Math.min(100, Math.max(0, origY + dy)) } : p); }); } : undefined}
                          onPointerUp={ADJUST_MODE ? () => { dragRef.current = null; } : undefined}
                        />
                        {ADJUST_MODE && (
                          <div className="absolute top-2 left-2 bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full font-mono z-20">
                            {adjustPositions[idx].x.toFixed(0)}% {adjustPositions[idx].y.toFixed(0)}%
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-24 sm:h-32 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none" />
                      </div>
                      <div className="relative z-10 -mt-px bg-card px-5 pb-5 pt-1.5 sm:px-8 sm:pb-8 sm:pt-2">
                        <h3 className="text-xl sm:text-2xl font-heading text-foreground mb-1.5 sm:mb-2 group-hover:text-accent transition-colors duration-300">{opt.label}</h3>
                        <p className="text-muted-foreground font-body text-sm leading-relaxed mb-3 sm:mb-4">{opt.desc}</p>
                        <div className="flex items-center gap-2 text-charcoal font-body text-sm font-semibold group-hover:gap-3 transition-all duration-300">
                          Book this treat <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Breed search */}
        {step === "breed" && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-4 text-center">
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 mb-6">
                <PawPrint className="h-9 w-9 text-accent" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading text-foreground leading-tight mb-2">
                Tell us about your<br />four-legged friend
              </h2>
              <p className="text-muted-foreground font-body text-sm max-w-xs">
                Start typing your dog's breed below and we'll find the perfect match
              </p>
            </div>
            <div className="px-5 pb-8 relative">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                <Input placeholder="e.g. Cockapoo, Labrador…" value={breedSearch} onChange={(e) => setBreedsSearch(e.target.value)} className="pl-12 h-14 rounded-2xl text-base shadow-lg shadow-black/[0.04] border-border/60 focus:border-accent" autoFocus />
              </div>
              {breedSearch.length > 0 && (
                <div className="absolute left-5 right-5 mt-2 bg-card border border-border rounded-2xl shadow-xl shadow-black/[0.08] max-h-64 overflow-y-auto z-20 animate-fade-in">
                  {filteredBreeds?.map((breed) => (
                    <button key={breed.id} onClick={() => handleBreedSelect(breed)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl border-b border-border/30 last:border-0">
                      <Dog className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-body text-sm truncate flex-1">{breed.name}</span>
                    </button>
                  ))}
                  {filteredBreeds?.length === 0 && (
                    <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                      No breeds match "<span className="font-medium text-foreground">{breedSearch}</span>"
                    </div>
                  )}
                  <button onClick={() => handleBreedSelect(null)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/5 transition-colors rounded-b-2xl border-t border-border/30">
                    <PawPrint className="h-4 w-4 text-accent shrink-0" />
                    <span className="font-body text-sm text-accent font-medium">Not Listed — my breed isn't here</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar + time slots */}
        {step === "calendar" && (
          <div className="animate-fade-in max-w-lg mx-auto">
            {/* Sticky service summary */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-5 pt-5 pb-3">
              <div className="rounded-2xl bg-card border border-border/40 p-4 flex items-center gap-3 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10">
                  <PawPrint className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground font-body">{serviceType}</p>
                  <p className="text-xs text-muted-foreground font-body truncate">
                    {isFixedPrice ? `${formatDuration(serviceDuration)}` : `${selectedBreed?.name ?? "Breed Not Listed"}${selectedBreed ? ` · ${formatDuration(selectedBreed.duration_minutes)}` : ""}`}
                  </p>
                </div>
                <p className="text-xl font-bold text-accent font-body tabular-nums">£{basePrice}</p>
              </div>
            </div>

            <div className="px-5 pt-4 pb-8">
              {/* Week navigation header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-heading text-foreground">Pick a date</h3>
                  <p className="text-xs text-muted-foreground font-body">{MONTH_NAMES[weekMonth.getMonth()]} {weekMonth.getFullYear()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={prevWeek} disabled={!canGoPrevWeek} className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${canGoPrevWeek ? 'hover:bg-muted active:scale-90' : 'opacity-20 cursor-not-allowed'}`}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={nextWeek} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted active:scale-90 transition-all">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Horizontal week strip */}
              <div className="grid grid-cols-7 gap-1.5">
                {weekDays.map((d, i) => {
                  const selectable = isDateSelectableDate(d);
                  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const isSelected = selectedDate === dateStr;
                  const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

                  return (
                    <button
                      key={i}
                      onClick={() => handleDateClickDate(d)}
                      disabled={!selectable}
                      className={`flex flex-col items-center gap-1 py-3 rounded-2xl transition-all duration-200
                        ${isSelected
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : isToday && selectable
                            ? 'bg-accent/10 text-foreground'
                            : selectable
                              ? 'hover:bg-muted text-foreground active:scale-95'
                              : 'text-muted-foreground/30 cursor-not-allowed'
                        }`}
                    >
                      <span className={`text-[0.65rem] font-semibold uppercase tracking-wider font-body ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {WEEKDAYS_SHORT[i]}
                      </span>
                      <span className="text-lg font-semibold font-body">{d.getDate()}</span>
                      {selectable && !isSelected && (
                        <span className="w-1 h-1 rounded-full bg-accent/50" />
                      )}
                      {isSelected && (
                        <span className="w-1 h-1 rounded-full bg-primary-foreground/60" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="h-px bg-border/60 my-6" />

              {/* Time slots */}
              {selectedDate ? (
                <div className="animate-fade-in">
                  <h3 className="text-base font-heading text-foreground mb-1">Available times</h3>
                  <p className="text-xs text-muted-foreground font-body mb-4">{formatSelectedDate(selectedDate)}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {generateTimeSlots().map((time) => {
                      const isTimeSelected = selectedTime === time;
                      return (
                        <button
                          key={time}
                          onClick={() => handleTimeClick(time)}
                          className={`py-3.5 rounded-full text-sm font-semibold font-body transition-all duration-200
                            ${isTimeSelected
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
                              : 'bg-card border border-border/50 hover:border-foreground/20 hover:shadow-sm text-foreground active:scale-95'
                            }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-body">Tap a date above to see available times</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add-ons step */}
        {step === "addons" && (
          <div className="px-4 sm:px-6 py-8 space-y-6 animate-fade-in max-w-lg mx-auto">
            {/* Summary pill */}
            <div className="rounded-2xl bg-muted/50 border border-border/40 p-4">
              <div className="flex justify-between items-center mb-1">
                <p className="font-heading font-semibold text-foreground">{serviceType}</p>
                <p className="text-xl font-bold text-accent">£{totalPrice}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {isFixedPrice ? "" : `${selectedBreed?.name ?? "Breed Not Listed"} • `}{formatSelectedDate(selectedDate!)} at {selectedTime}
              </p>
            </div>

            {/* Add-ons */}
            <div>
              <h3 className="font-heading font-semibold text-foreground text-lg mb-1">Add the finishing touches</h3>
              <p className="text-sm text-muted-foreground mb-4">Make it extra special for your pup</p>
              <div className="space-y-3">
                {dbAddOns?.map((addon) => {
                  const isSelected = selectedAddOns.includes(addon.id);
                  const Icon = getAddonIcon(addon.icon);
                  return (
                    <div key={addon.id}>
                      <button
                        onClick={() => toggleAddOn(addon.id)}
                        className={`w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${isSelected ? 'border-accent bg-accent/10 shadow-sm' : 'border-border bg-card hover:border-accent/50 hover:shadow-sm'}`}
                      >
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${isSelected ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
                          {isSelected ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 flex items-center gap-1.5">
                          <p className="font-medium text-foreground">{addon.name}</p>
                          {(addon as any).description && (
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); setInfoPopup({ name: addon.name, description: (addon as any).description }); }}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={`Info about ${addon.name}`}
                            >
                              <Info className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-foreground">+£{Number(addon.price)}</span>
                      </button>
                    </div>
                  );
                })}
                {(!dbAddOns || dbAddOns.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No extras available right now</p>
                )}
              </div>
            </div>

            {/* Next */}
            <div className="pt-2">
              <Button onClick={() => setStep("guest-details")} className="w-full h-14 text-base rounded-xl" size="lg">
                Next £{totalPrice}
              </Button>
              <button onClick={() => setStep("guest-details")} className="w-full text-center text-sm text-muted-foreground mt-3 hover:text-foreground transition-colors">
                Skip extras
              </button>
            </div>
          </div>
        )}

        {/* Add-on info popup */}
        {infoPopup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" onClick={() => setInfoPopup(null)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              className="relative bg-card rounded-2xl border border-border shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 fade-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setInfoPopup(null)}
                className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Info className="h-5 w-5" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-foreground">{infoPopup.name}</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">{infoPopup.description}</p>
            </div>
          </div>
        )}


        {step === "guest-details" && (
          <div className="px-4 py-6 space-y-6 animate-fade-in max-w-lg mx-auto">
            <div className="rounded-2xl bg-muted/50 border border-border/40 p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="font-heading font-semibold">{serviceType}</p>
                <p className="text-xl font-bold text-accent">£{totalPrice}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {isFixedPrice ? "" : `${selectedBreed?.name ?? "Breed Not Listed"} • `}{formatSelectedDate(selectedDate!)} at {selectedTime}
              </p>
              {selectedAddOns.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">+ {selectedAddOns.map(id => dbAddOns?.find(a => a.id === id)?.name).filter(Boolean).join(", ")}</p>
              )}
            </div>

            {isNewCustomer && (
              <div className="text-center">
                <h2 className="text-xl font-heading text-foreground">Create Your Account</h2>
                <p className="text-muted-foreground text-sm mt-1">Quick setup, then we'll confirm your booking</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Your Name *</Label>
                <Input value={guestForm.name} onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })} placeholder="Jane Smith" className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Dog's Name *</Label>
                <Input value={guestForm.dogName} onChange={(e) => setGuestForm({ ...guestForm, dogName: e.target.value })} placeholder="Buddy" className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isNewCustomer ? "Email *" : "Email"}</Label>
                <Input value={guestForm.email} onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })} placeholder="jane@example.com" type="email" className="h-12 rounded-xl" />
              </div>
              {isNewCustomer && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Create Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={guestForm.password}
                      onChange={(e) => setGuestForm({ ...guestForm, password: e.target.value })}
                      placeholder="Min 6 characters"
                      type="password"
                      className="h-12 rounded-xl pl-10"
                      minLength={6}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">You'll use this to manage bookings and your pets</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Phone</Label>
                <Input value={guestForm.phone} onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })} placeholder="07xxx xxxxxx" type="tel" className="h-12 rounded-xl" />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I agree to the{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2 hover:text-accent/80"
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms & Conditions
                </a>
              </span>
            </label>

            <Button onClick={handleGuestSubmit} disabled={!acceptedTerms} className="w-full h-14 text-base rounded-xl" size="lg">
              {isNewCustomer ? `Create Account & Book £${totalPrice}` : `Confirm Booking £${totalPrice}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
