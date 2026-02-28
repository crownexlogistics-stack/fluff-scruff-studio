import { useState, useCallback, useRef } from "react";
import { ArrowLeft, Search, Dog, ChevronRight, PawPrint, Save, Move, Sparkles, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import serviceBathBrush from "@/assets/service-bath-brush.jpg";
import serviceFullGroomSub from "@/assets/service-full-groom-sub.jpg";

const ADJUST_MODE = false;

type Step = "sub-service" | "breed" | "calendar" | "guest-details" | null;

interface BookingFlowProps {
  service: string;
  onClose: () => void;
}

const subServices = [
  {
    label: "Bath & Brush",
    desc: "A luxurious bath with amazing shampoos & conditioners, followed by a thorough brush-out. Your pup leaves fresh, soft & smelling incredible.",
    image: serviceBathBrush,
    defaultPosition: "50% 35%",
  },
  {
    label: "Full Groom",
    desc: "Everything in Bath & Brush plus a full haircut, style & nail trim. The complete pamper package — they'll strut out looking brand new.",
    image: serviceFullGroomSub,
    defaultPosition: "50% 40%",
  },
];

const ADD_ONS = [
  { label: "VIP Treatment", price: 12, icon: Sparkles },
  { label: "De-shedding", price: 10, icon: Dog },
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

export function BookingFlow({ service, onClose }: BookingFlowProps) {
  const [step, setStep] = useState<Step>(service === "Grooming" ? "sub-service" : "breed");
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [breedSearch, setBreedsSearch] = useState("");
  const [selectedBreed, setSelectedBreed] = useState<any>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [guestForm, setGuestForm] = useState({ name: "", phone: "", email: "", dogName: "" });
  const queryClient = useQueryClient();

  // Load saved positions from DB
  const { data: savedPositions } = useQuery({
    queryKey: ["site_config", "sub_service_images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("value")
        .eq("key", "sub_service_images")
        .single();
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
      const { error } = await supabase
        .from("site_config")
        .upsert({ key: "sub_service_images", value, updated_at: new Date().toISOString() });
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

  const filteredBreeds = breedSearch.length > 0
    ? breeds?.filter((b) => b.name.toLowerCase().includes(breedSearch.toLowerCase()))
    : breeds;

  const serviceType = selectedSub ?? service;
  const breedPrice = selectedBreed
    ? (serviceType === "Bath & Brush" ? selectedBreed.price_bath_brush : selectedBreed.price_full_groom)
    : 0;
  const addOnsTotal = selectedAddOns.reduce((sum, label) => {
    const addon = ADD_ONS.find(a => a.label === label);
    return sum + (addon?.price ?? 0);
  }, 0);
  const totalPrice = breedPrice + addOnsTotal;

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

  const toggleAddOn = (label: string) => {
    setSelectedAddOns(prev => prev.includes(label) ? prev.filter(a => a !== label) : [...prev, label]);
  };

  const handleGuestSubmit = async () => {
    if (!guestForm.name.trim() || !guestForm.dogName.trim()) {
      toast.error("Please fill in your name and dog's name");
      return;
    }

    const { error } = await supabase.from("bookings").insert({
      customer_name: guestForm.name,
      customer_phone: guestForm.phone || null,
      customer_email: guestForm.email || null,
      dog_name: guestForm.dogName,
      breed_id: selectedBreed?.id ?? null,
      booking_date: selectedDate!,
      booking_time: selectedTime!,
      total_price: totalPrice,
      status: "Pending",
    });

    if (error) {
      toast.error("Failed to book — please try again");
      return;
    }

    toast.success("Booking confirmed! We'll be in touch.");
    onClose();
  };

  const goBack = useCallback(() => {
    if (step === "guest-details") {
      setStep("calendar");
    } else if (step === "calendar") {
      setStep("breed");
    } else if (step === "breed" && service === "Grooming") {
      setStep("sub-service");
      setSelectedSub(null);
    } else {
      onClose();
    }
  }, [step, service, onClose]);

  // Generate time slots based on duration
  const generateTimeSlots = () => {
    const slots: string[] = [];
    const durationMins = selectedBreed?.duration_minutes ?? 60;
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

  // Generate next 14 days
  const generateDates = () => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() !== 0) dates.push(d); // skip Sunday
    }
    return dates;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background animate-slide-up flex flex-col">
      {/* Header */}
      <div className="glass sticky top-0 z-10 px-4 py-3 flex items-center gap-3 safe-area-top">
        <button
          onClick={goBack}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted active:scale-95 transition-transform touch-target"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold font-body">
            {step === "sub-service" ? service : step === "guest-details" ? "Your Details" : selectedSub ?? service}
          </h2>
          <p className="text-xs text-muted-foreground">
            {step === "sub-service" ? "Choose your style" : step === "breed" ? "Select breed" : step === "calendar" ? "Pick a slot" : "Almost done!"}
          </p>
        </div>
        {ADJUST_MODE && step === "sub-service" && (
          <button
            onClick={() => saveMutation.mutate(adjustPositions)}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-semibold active:scale-95 transition-transform"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : "Save"}
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
              <h2 className="text-2xl sm:text-4xl font-heading text-foreground leading-tight">
                What type of groom?
              </h2>
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
            {/* Hero area */}
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

            {/* Search area pinned toward bottom */}
            <div className="px-5 pb-8 relative">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                <Input
                  placeholder="e.g. Cockapoo, Labrador…"
                  value={breedSearch}
                  onChange={(e) => setBreedsSearch(e.target.value)}
                  className="pl-12 h-14 rounded-2xl text-base shadow-lg shadow-black/[0.04] border-border/60 focus:border-accent"
                  autoFocus
                />
              </div>

              {/* Dropdown results — only show when typing */}
              {breedSearch.length > 0 && (
                <div className="absolute left-5 right-5 mt-2 bg-card border border-border rounded-2xl shadow-xl shadow-black/[0.08] max-h-64 overflow-y-auto z-20 animate-fade-in">
                  {filteredBreeds?.map((breed) => (
                    <button
                      key={breed.id}
                      onClick={() => handleBreedSelect(breed)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl border-b border-border/30 last:border-0"
                    >
                      <Dog className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-body text-sm truncate flex-1">{breed.name}</span>
                    </button>
                  ))}

                  {filteredBreeds?.length === 0 && (
                    <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                      No breeds match "<span className="font-medium text-foreground">{breedSearch}</span>"
                    </div>
                  )}

                  {/* Not Listed always at the bottom of dropdown */}
                  <button
                    onClick={() => handleBreedSelect(null)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/5 transition-colors rounded-b-2xl border-t border-border/30"
                  >
                    <PawPrint className="h-4 w-4 text-accent shrink-0" />
                    <span className="font-body text-sm text-accent font-medium">Not Listed — my breed isn't here</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar + add-ons */}
        {step === "calendar" && (
          <div className="px-4 py-6 space-y-6 animate-fade-in">
            {/* Selected breed summary */}
            <div className="rounded-xl bg-muted/50 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{serviceType}</p>
                <p className="font-heading font-semibold">{selectedBreed?.name ?? "Breed Not Listed"}</p>
                {selectedBreed && <p className="text-xs text-muted-foreground">{formatDuration(selectedBreed.duration_minutes)}</p>}
              </div>
              <p className="text-xl font-bold text-accent">£{totalPrice}</p>
            </div>

            {/* Date selection */}
            <div>
              <h3 className="font-heading font-semibold mb-3">Choose a date</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {generateDates().map((date) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const isSelected = selectedDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => { setSelectedDate(dateStr); setSelectedTime(null); }}
                      className={`flex-shrink-0 flex flex-col items-center px-4 py-3 rounded-xl border transition-all ${isSelected ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card hover:border-accent/50'}`}
                    >
                      <span className="text-xs font-medium uppercase">{date.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                      <span className="text-lg font-bold">{date.getDate()}</span>
                      <span className="text-xs text-muted-foreground">{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div className="animate-fade-in">
                <h3 className="font-heading font-semibold mb-3">Choose a time</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {generateTimeSlots().map((time) => {
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-3 rounded-xl border text-sm font-medium transition-all ${isSelected ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card hover:border-accent/50'}`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add-ons — shown after date+time selected */}
            {selectedDate && selectedTime && (
              <div className="animate-fade-in space-y-3">
                <h3 className="font-heading font-semibold">Add extras</h3>
                {ADD_ONS.map((addon) => {
                  const isSelected = selectedAddOns.includes(addon.label);
                  return (
                    <button
                      key={addon.label}
                      onClick={() => toggleAddOn(addon.label)}
                      className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${isSelected ? 'border-accent bg-accent/10' : 'border-border bg-card hover:border-accent/50'}`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isSelected ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
                        {isSelected ? <Check className="h-5 w-5" /> : <addon.icon className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{addon.label}</p>
                      </div>
                      <span className="font-semibold">+£{addon.price}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Next button */}
            {selectedDate && selectedTime && (
              <div className="pt-4 animate-fade-in">
                <Button
                  onClick={() => setStep("guest-details")}
                  className="w-full h-14 text-base rounded-xl"
                  size="lg"
                >
                  Next — £{totalPrice}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Guest checkout */}
        {step === "guest-details" && (
          <div className="px-4 py-6 space-y-6 animate-fade-in">
            <div className="rounded-xl bg-muted/50 p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="font-heading font-semibold">{serviceType}</p>
                <p className="text-xl font-bold text-accent">£{totalPrice}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedBreed?.name ?? "Breed Not Listed"} • {selectedDate} at {selectedTime}
              </p>
              {selectedAddOns.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">+ {selectedAddOns.join(", ")}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Name *</label>
                <Input value={guestForm.name} onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })} placeholder="Jane Smith" className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dog's Name *</label>
                <Input value={guestForm.dogName} onChange={(e) => setGuestForm({ ...guestForm, dogName: e.target.value })} placeholder="Buddy" className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input value={guestForm.phone} onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })} placeholder="07xxx xxxxxx" type="tel" className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input value={guestForm.email} onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })} placeholder="jane@example.com" type="email" className="h-12 rounded-xl" />
              </div>
            </div>

            <Button onClick={handleGuestSubmit} className="w-full h-14 text-base rounded-xl" size="lg">
              Confirm Booking — £{totalPrice}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
