import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Check, ChevronRight, ArrowLeft, Calendar, Clock, Dog, Package, Loader2, AlertTriangle, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateAvailableSlots, dateHasAnyAvailability, findFreeGroomer } from "@/lib/availability";
import type { StaffAvailability, ScheduleOverride, ExistingBooking, Groomer } from "@/lib/availability";
import logo from "@/assets/logo-transparent.png";

type Step = 1 | 2 | 3 | 4;

interface SessionRow {
  serviceType: string;
  groomerId: string;
  date: string;
  time: string;
}

const STEP_LABELS = ["Choose Package", "Your Details", "Pick Your Dates", "Pay"];

const TC_POINTS = [
  "Full payment is required upfront at time of booking.",
  "All session dates must be agreed at the time of purchase.",
  "Sessions may be rescheduled with a minimum of 48 hours notice. Sessions missed without 48 hours notice may be counted as used at the salon's discretion.",
  "If you do not attend a session without notice (no-show), that session is counted as used with no refund or replacement.",
  "If you cancel your package, a refund will be issued for remaining unused sessions at the package price per session.",
  "Packages are non-transferable to another person or dog.",
  "Sessions do not expire whilst the package is active.",
  "The discounted price is locked in at the time of purchase and will not be affected by future price increases.",
  "Fluff & Scruff Studio reserves the right to decline a session if there are welfare or behavioural concerns regarding your dog.",
  "These terms are governed by English law.",
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 py-4 px-2">
      {STEP_LABELS.map((label, i) => {
        const stepNum = (i + 1) as Step;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <div key={label} className="flex items-center gap-1 sm:gap-2">
            {i > 0 && <div className={`h-px w-4 sm:w-8 ${isDone ? "bg-accent" : "bg-border"}`} />}
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                isDone ? "bg-accent text-white" : isActive ? "bg-accent text-white" : "bg-muted text-muted-foreground"
              }`}>
                {isDone ? <Check className="h-3.5 w-3.5" /> : stepNum}
              </div>
              <span className={`text-[0.6rem] font-body ${isActive ? "text-accent font-bold" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BookPackagePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dogName, setDogName] = useState("");
  const [breedId, setBreedId] = useState("");
  const [breedSearch, setBreedSearch] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [tcAgreed, setTcAgreed] = useState(false);
  const [tcDialogOpen, setTcDialogOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [dateWarnings, setDateWarnings] = useState<Record<number, string>>({});
  const [selectedDogIdx, setSelectedDogIdx] = useState<number | null>(null);
  const [addingNewDog, setAddingNewDog] = useState(false);
  const [prefilled, setPrefilled] = useState(false);


  // Fetch logged-in customer's dogs from bookings + migrated_bookings
  const { data: customerDogs } = useQuery({
    queryKey: ["customer-dogs-pkg", user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const userEmail = user!.email!.toLowerCase();
      const [bookingsRes, migratedRes] = await Promise.all([
        supabase.from("bookings").select("dog_name, breed_id").ilike("customer_email", userEmail).not("dog_name", "is", null),
        (supabase.from("migrated_bookings" as any).select("dog_name, breed_name") as any).ilike("customer_email", userEmail),
      ]);
      const dogMap = new Map<string, string | null>();
      ((bookingsRes.data || []) as any[]).forEach((b: any) => {
        if (b.dog_name?.trim()) dogMap.set(b.dog_name.trim(), b.breed_id || dogMap.get(b.dog_name.trim()) || null);
      });
      ((migratedRes.data || []) as any[]).forEach((mb: any) => {
        if (mb.dog_name?.trim() && !dogMap.has(mb.dog_name.trim())) dogMap.set(mb.dog_name.trim(), null);
      });
      return Array.from(dogMap.entries()).map(([name, bId]) => ({ dog_name: name, breed_id: bId }));
    },
  });

  // Pre-fill logged-in user details
  useEffect(() => {
    if (!user || prefilled) return;
    const fetchProfile = async () => {
      const userEmail = user.email || "";
      setEmail(userEmail);
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (profile?.full_name) {
        const parts = profile.full_name.trim().split(/\s+/);
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      }
      const { data: booking } = await supabase.from("bookings").select("customer_phone, customer_name").ilike("customer_email", userEmail).not("customer_phone", "is", null).limit(1).maybeSingle();
      if (booking?.customer_phone) setPhone(booking.customer_phone);
      if (!profile?.full_name && booking?.customer_name) {
        const parts = booking.customer_name.trim().split(/\s+/);
        setFirstName(prev => prev || parts[0] || "");
        setLastName(prev => prev || parts.slice(1).join(" ") || "");
      }
      const { data: migrated } = await supabase.from("migrated_customers").select("full_name, phone").ilike("email", userEmail).limit(1).maybeSingle();
      if (migrated) {
        if (migrated.full_name) {
          const mp = migrated.full_name.trim().split(/\s+/);
          setFirstName(prev => prev || mp[0] || "");
          setLastName(prev => prev || mp.slice(1).join(" ") || "");
        }
        setPhone(prev => prev || migrated.phone || "");
      }
      setPrefilled(true);
    };
    fetchProfile();
  }, [user, prefilled]);

  // Auto-select single dog
  useEffect(() => {
    if (!customerDogs || customerDogs.length === 0 || selectedDogIdx !== null || addingNewDog) return;
    if (customerDogs.length === 1) {
      setSelectedDogIdx(0);
      setDogName(customerDogs[0].dog_name);
      if (customerDogs[0].breed_id) {
        setBreedId(customerDogs[0].breed_id);
      }
    }
  }, [customerDogs, selectedDogIdx, addingNewDog]);

  // ── Data queries ──
  const { data: packages } = useQuery({
    queryKey: ["public-packages"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("packages" as any).select("*") as any).eq("is_active", true).order("session_count");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: breeds } = useQuery({
    queryKey: ["breeds-for-pkg-booking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breeds").select("id, name, price_full_groom, price_bath_brush, duration_minutes").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Sync breed search text when breedId set from dog selection
  useEffect(() => {
    if (breedId && breeds) {
      const b = breeds.find(br => br.id === breedId);
      if (b) setBreedSearch(b.name);
    }
  }, [breedId, breeds]);

  const { data: groomers } = useQuery({
    queryKey: ["groomers-for-pkg-booking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name, booking_priority, is_accepting_bookings, employment_end_date").eq("account_blocked", false).order("name");
      if (error) throw error;
      return (data || []).filter((s: any) => s.is_accepting_bookings !== false) as Groomer[];
    },
  });

  const { data: baseSchedules } = useQuery({
    queryKey: ["base-schedules-pkg"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_availability").select("staff_id, day_of_week, start_time, end_time, is_available");
      if (error) throw error;
      return data as StaffAvailability[];
    },
  });

  const selectedPkg = useMemo(() => packages?.find((p: any) => p.id === selectedPackageId), [packages, selectedPackageId]);

  // ── Pricing ──
  const selectedBreed = useMemo(() => breeds?.find(b => b.id === breedId), [breeds, breedId]);
  const isTeethPackage = selectedPkg?.package_type === "teeth_cleaning";

  const sessionPrices = useMemo(() => {
    if (!selectedPkg) return [];
    if (isTeethPackage) return sessions.map(() => 20);
    if (!selectedBreed) return sessions.map(() => 0);
    return sessions.map(s => {
      const base = s.serviceType === "bath_brush" ? selectedBreed.price_bath_brush : selectedBreed.price_full_groom;
      const discount = Number(selectedPkg.discount_percentage) / 100;
      return Math.round(Number(base) * (1 - discount) * 100) / 100;
    });
  }, [selectedPkg, selectedBreed, sessions, isTeethPackage]);

  const totalPrice = useMemo(() => {
    if (isTeethPackage) return 100;
    return sessionPrices.reduce((sum, p) => sum + p, 0);
  }, [sessionPrices, isTeethPackage]);

  const unknownBreed = !breedId || !selectedBreed;

  // ── Init sessions when package selected ──
  const initSessions = useCallback((pkg: any) => {
    const count = pkg.session_count;
    const defaultService = pkg.package_type === "teeth_cleaning" ? "teeth_cleaning" : "full_groom";
    setSessions(Array.from({ length: count }, () => ({ serviceType: defaultService, groomerId: "any", date: "", time: "" })));
    setDateWarnings({});
  }, []);

  // ── Slot fetching per session ──
  const [slotsBySession, setSlotsBySession] = useState<Record<number, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState<Record<number, boolean>>({});

  // The groomer locked-in by session 1 in "any" mode (the package groomer for sessions 2+)
  const [packageGroomerId, setPackageGroomerId] = useState<string | null>(null);

  const fetchSlotsForSession = useCallback(async (idx: number, date: string, groomerId: string) => {
    if (!date || !baseSchedules || !groomers) return;
    setLoadingSlots(prev => ({ ...prev, [idx]: true }));

    const dateObj = new Date(date + "T00:00:00");
    const duration = isTeethPackage ? 30 : (selectedBreed?.duration_minutes || 90);

    // Fetch overrides + real bookings + migrated bookings for this date — same data check-availability uses
    const [overridesRes, bookingsRes, migratedRes] = await Promise.all([
      supabase.from("staff_schedule_overrides").select("staff_id, override_date, start_time, end_time, is_working").eq("override_date", date),
      supabase.from("bookings").select("staff_id, booking_time, duration_minutes, services(duration_minutes), breeds(duration_minutes)").eq("booking_date", date).not("status", "in", "(Cancelled,No Show,Refunded)"),
      supabase.from("migrated_bookings").select("staff_name, booking_time, duration_minutes").eq("booking_date", date).eq("is_future_booking", true),
    ]);

    const overrides = (overridesRes.data || []) as ScheduleOverride[];
    const realBookings = (bookingsRes.data || []) as ExistingBooking[];

    // Convert migrated bookings to ExistingBooking shape (match staff_name → staff_id)
    const migratedAsBookings: ExistingBooking[] = ((migratedRes.data || []) as any[]).flatMap((mb: any) => {
      if (!mb.staff_name || !mb.booking_time) return [];
      const matchedStaff = groomers.find(g => {
        const fullLower = (g.name || "").toLowerCase().trim();
        const firstLower = fullLower.split(" ")[0];
        const mbLower = (mb.staff_name || "").toLowerCase().trim();
        return mbLower === fullLower || mbLower.startsWith(firstLower);
      });
      if (!matchedStaff) return [];
      return [{
        staff_id: matchedStaff.id,
        booking_time: mb.booking_time,
        duration_minutes: mb.duration_minutes || 90,
      }];
    });
    const existingBookings = [...realBookings, ...migratedAsBookings];

    // Resolve which groomers to consider for this session's slots:
    // - explicit groomer chosen → just that one
    // - "any" + this is session 1 (or no package groomer locked yet) → all active groomers
    // - "any" + package groomer is locked → only the locked one (so sessions 2+ stay consistent)
    let filteredGroomers: Groomer[];
    if (groomerId !== "any") {
      filteredGroomers = groomers.filter(g => g.id === groomerId);
    } else if (packageGroomerId && idx > 0) {
      filteredGroomers = groomers.filter(g => g.id === packageGroomerId);
    } else {
      filteredGroomers = groomers;
    }

    const slots = generateAvailableSlots(dateObj, duration, filteredGroomers, baseSchedules, overrides, existingBookings, 30);

    setSlotsBySession(prev => ({ ...prev, [idx]: slots }));
    setLoadingSlots(prev => ({ ...prev, [idx]: false }));
  }, [baseSchedules, groomers, selectedBreed, isTeethPackage, packageGroomerId]);

  // When session 1's date+time is picked in "any" mode, lock the highest-priority free groomer
  // for the rest of the package. This guarantees consistency and that we never insert null staff_id.
  const lockPackageGroomerFromSession1 = useCallback(async (date: string, time: string) => {
    if (!date || !time || !baseSchedules || !groomers) return;
    const dateObj = new Date(date + "T00:00:00");
    const duration = isTeethPackage ? 30 : (selectedBreed?.duration_minutes || 90);

    const [overridesRes, bookingsRes, migratedRes] = await Promise.all([
      supabase.from("staff_schedule_overrides").select("staff_id, override_date, start_time, end_time, is_working").eq("override_date", date),
      supabase.from("bookings").select("staff_id, booking_time, duration_minutes, services(duration_minutes), breeds(duration_minutes)").eq("booking_date", date).not("status", "in", "(Cancelled,No Show,Refunded)"),
      supabase.from("migrated_bookings").select("staff_name, booking_time, duration_minutes").eq("booking_date", date).eq("is_future_booking", true),
    ]);
    const overrides = (overridesRes.data || []) as ScheduleOverride[];
    const realBookings = (bookingsRes.data || []) as ExistingBooking[];
    const migratedAsBookings: ExistingBooking[] = ((migratedRes.data || []) as any[]).flatMap((mb: any) => {
      if (!mb.staff_name || !mb.booking_time) return [];
      const matched = groomers.find(g => {
        const fullLower = (g.name || "").toLowerCase().trim();
        const firstLower = fullLower.split(" ")[0];
        const mbLower = (mb.staff_name || "").toLowerCase().trim();
        return mbLower === fullLower || mbLower.startsWith(firstLower);
      });
      if (!matched) return [];
      return [{ staff_id: matched.id, booking_time: mb.booking_time, duration_minutes: mb.duration_minutes || 90 }];
    });
    const existingBookings = [...realBookings, ...migratedAsBookings];

    const chosen = findFreeGroomer(time, duration, dateObj, groomers, baseSchedules, overrides, existingBookings);
    setPackageGroomerId(chosen?.id || null);
  }, [baseSchedules, groomers, selectedBreed, isTeethPackage]);

  // ── Overrides for date availability ──
  const [dateOverrides, setDateOverrides] = useState<ScheduleOverride[]>([]);

  // ── Validate date order warnings ──
  const checkDateWarnings = useCallback((updatedSessions: SessionRow[]) => {
    const warnings: Record<number, string> = {};
    for (let i = 1; i < updatedSessions.length; i++) {
      if (updatedSessions[i].date && updatedSessions[i - 1].date && updatedSessions[i].date < updatedSessions[i - 1].date) {
        warnings[i] = `Session ${i + 1} is before Session ${i} — is that correct?`;
      }
    }
    // Check duplicate dates
    const dates = updatedSessions.map(s => s.date).filter(Boolean);
    const dupes = dates.filter((d, idx) => dates.indexOf(d) !== idx);
    if (dupes.length > 0) {
      updatedSessions.forEach((s, idx) => {
        if (dupes.includes(s.date)) {
          warnings[idx] = "Each session must be on a different date";
        }
      });
    }
    setDateWarnings(warnings);
  }, []);

  const updateSession = useCallback((idx: number, field: keyof SessionRow, value: string) => {
    setSessions(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };

      // If session 1's groomer choice or date changes, the locked package groomer must be re-evaluated
      // and all subsequent sessions cleared (their slots depended on the old locked groomer).
      if (idx === 0 && (field === "groomerId" || field === "date" || field === "time")) {
        if (field === "groomerId" || field === "date") {
          // Reset lock & clear sessions 2+
          setPackageGroomerId(null);
          for (let i = 1; i < updated.length; i++) {
            updated[i] = { ...updated[i], date: "", time: "" };
          }
        }
      }

      if (field === "date" || field === "groomerId") {
        updated[idx].time = "";
        fetchSlotsForSession(idx, updated[idx].date, updated[idx].groomerId);
      }

      // When session 1's TIME is picked: if "any", lock the package groomer
      if (idx === 0 && field === "time" && value) {
        if (updated[0].groomerId === "any") {
          lockPackageGroomerFromSession1(updated[0].date, value);
        } else {
          // explicit groomer chosen — they ARE the package groomer
          setPackageGroomerId(updated[0].groomerId);
        }
      }

      if (field === "date") checkDateWarnings(updated);
      return updated;
    });
  }, [fetchSlotsForSession, checkDateWarnings, lockPackageGroomerFromSession1]);

  // When packageGroomerId changes (locked after session 1), refresh slot lists for sessions 2+
  // that already have a date set, so the time options reflect the locked groomer's availability.
  useEffect(() => {
    if (!packageGroomerId) return;
    sessions.forEach((s, idx) => {
      if (idx === 0) return;
      if (s.date) {
        fetchSlotsForSession(idx, s.date, s.groomerId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageGroomerId]);

  const packageGroomerName = useMemo(() => {
    if (!packageGroomerId || !groomers) return null;
    return groomers.find(g => g.id === packageGroomerId)?.name || null;
  }, [packageGroomerId, groomers]);

  // ── Breed search filter ──
  const filteredBreeds = useMemo(() => {
    if (!breeds) return [];
    if (!breedSearch) return breeds;
    return breeds.filter(b => b.name.toLowerCase().includes(breedSearch.toLowerCase()));
  }, [breeds, breedSearch]);

  // ── Step validation ──
  const canProceedStep1 = !!selectedPackageId;
  const canProceedStep2 = firstName.trim() && lastName.trim() && email.trim() && phone.trim() && dogName.trim();
  const canProceedStep3 = sessions.every(s => s.date && s.time) && Object.keys(dateWarnings).filter(k => dateWarnings[Number(k)]?.includes("different date")).length === 0;

  // ── Pay ──
  const handlePay = async () => {
    if (!selectedPkg || paying) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-package-checkout", {
        body: {
          package_id: selectedPackageId,
          customer_name: `${firstName} ${lastName}`,
          customer_email: email.trim().toLowerCase(),
          customer_phone: phone.trim(),
          dog_name: dogName.trim(),
          breed_id: breedId || null,
          sessions: sessions.map((s, i) => ({
            session_number: i + 1,
            service_type: s.serviceType,
            groomer_id: resolveSessionGroomerId(s),
            date: s.date,
            time: s.time,
          })),
          total_price: totalPrice,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.open(data.url, "_blank");
        setPaying(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start payment");
      setPaying(false);
    }
  };

  // For payload — resolve every session's groomer_id (never null in "any" mode after session 1 lock)
  const resolveSessionGroomerId = useCallback((s: SessionRow): string | null => {
    if (s.groomerId !== "any") return s.groomerId;
    return packageGroomerId; // locked by session 1; null only if session 1 itself hasn't been picked yet
  }, [packageGroomerId]);

  // ── Date availability check ──
  const isDateAvailable = useCallback((dateStr: string) => {
    if (!groomers || !baseSchedules) return true;
    const dateObj = new Date(dateStr + "T00:00:00");
    return dateHasAnyAvailability(dateObj, groomers, baseSchedules, dateOverrides);
  }, [groomers, baseSchedules, dateOverrides]);

  // ── Get min date (tomorrow) ──
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background border-b border-border/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => step === 1 ? navigate("/packages") : setStep((step - 1) as Step)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto" />
            </Link>
          </div>
          <span className="font-body text-xs text-muted-foreground">Package Booking</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-16">
        <StepIndicator current={step} />

        <AnimatePresence mode="wait">
          {/* ── STEP 1: Choose Package ── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <h2 className="font-heading text-xl sm:text-2xl text-center mb-6 mt-2">Choose Your Package</h2>
              <div className="space-y-4">
                {packages?.map((pkg: any) => {
                  const selected = pkg.id === selectedPackageId;
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => { setSelectedPackageId(pkg.id); initSessions(pkg); }}
                      className={`w-full text-left p-5 rounded-2xl border-2 transition-all relative ${
                        selected ? "border-accent bg-accent/5 shadow-md" : "border-border hover:border-accent/40 bg-card"
                      }`}
                    >
                      {pkg.session_count === 6 && (
                        <Badge className="absolute top-3 right-3 bg-accent text-white text-[10px]">Most Popular</Badge>
                      )}
                      <h3 className="font-heading text-base sm:text-lg">{pkg.name}</h3>
                      <p className="font-body text-sm text-muted-foreground mt-1">{pkg.description}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="secondary" className="text-xs">
                          {pkg.session_count} sessions
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {pkg.package_type === "teeth_cleaning" ? "£20/session" : `${pkg.discount_percentage}% off`}
                        </Badge>
                      </div>
                      {selected && (
                        <div className="absolute top-4 left-4">
                          <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full mt-6 bg-accent hover:bg-accent/90 text-white font-bold h-12 rounded-full">
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* ── STEP 2: Your Details ── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <h2 className="font-heading text-xl sm:text-2xl text-center mb-6 mt-2">Your Details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-body">First Name *</Label>
                    <Input value={firstName} onChange={e => !user && setFirstName(e.target.value)} placeholder="First name" className="rounded-xl" readOnly={!!user} disabled={!!user} />
                  </div>
                  <div>
                    <Label className="text-xs font-body">Last Name *</Label>
                    <Input value={lastName} onChange={e => !user && setLastName(e.target.value)} placeholder="Last name" className="rounded-xl" readOnly={!!user} disabled={!!user} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-body">Email Address *</Label>
                  <Input type="email" value={email} onChange={e => !user && setEmail(e.target.value)} placeholder="you@example.com" className="rounded-xl" readOnly={!!user} disabled={!!user} />
                </div>
                <div>
                  <Label className="text-xs font-body">Phone Number *</Label>
                  <Input type="tel" value={phone} onChange={e => !user && setPhone(e.target.value)} placeholder="07..." className="rounded-xl" readOnly={!!user} disabled={!!user} />
                </div>
                {user && (
                  <p className="text-xs text-muted-foreground font-body">
                    Logged in as {user.email} —{" "}
                    <button type="button" onClick={async () => { await signOut(); setPrefilled(false); setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setDogName(""); setBreedId(""); setBreedSearch(""); setSelectedDogIdx(null); }} className="underline text-accent hover:text-accent/80">
                      not you? Sign out
                    </button>
                  </p>
                )}
                <Separator />

                {/* Dog selection — logged in with dogs on file */}
                {user && customerDogs && customerDogs.length > 1 && !addingNewDog ? (
                  <div className="space-y-3">
                    <Label className="text-xs font-body">Which dog is this booking for? *</Label>
                    <div className="space-y-2">
                      {customerDogs.map((d, idx) => {
                        const breed = d.breed_id ? breeds?.find(b => b.id === d.breed_id) : null;
                        const isSelected = selectedDogIdx === idx;
                        return (
                          <button
                            key={d.dog_name}
                            type="button"
                            onClick={() => {
                              setSelectedDogIdx(idx);
                              setDogName(d.dog_name);
                              setBreedId(d.breed_id || "");
                              setBreedSearch(breed?.name || "");
                              setAddingNewDog(false);
                            }}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${isSelected ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"}`}
                          >
                            <Dog className="h-5 w-5 text-muted-foreground shrink-0" />
                            <div>
                              <p className="font-body font-semibold text-sm">{d.dog_name}</p>
                              {breed && <p className="text-xs text-muted-foreground font-body">{breed.name}</p>}
                            </div>
                            {isSelected && (
                              <div className="ml-auto w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Show breed picker if selected dog has no breed */}
                    {selectedDogIdx !== null && !customerDogs[selectedDogIdx]?.breed_id && (
                      <div>
                        <Label className="text-xs font-body">Dog's Breed</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={breedSearch} onChange={e => { setBreedSearch(e.target.value); setBreedId(""); }} placeholder="Search breed..." className="rounded-xl pl-9" />
                        </div>
                        {breedSearch && filteredBreeds.length > 0 && !breedId && (
                          <div className="border rounded-xl mt-1 max-h-40 overflow-y-auto bg-card shadow-lg">
                            {filteredBreeds.slice(0, 15).map(b => (
                              <button key={b.id} type="button" onClick={() => { setBreedId(b.id); setBreedSearch(b.name); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors font-body">{b.name}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" onClick={() => { setAddingNewDog(true); setSelectedDogIdx(null); setDogName(""); setBreedId(""); setBreedSearch(""); }} className="text-xs text-accent hover:text-accent/80 underline font-body">
                      + Add a different dog
                    </button>
                  </div>
                ) : (
                  /* Default dog fields — guest, single dog, no dogs, or adding new */
                  <div className="space-y-4">
                    {user && addingNewDog && customerDogs && customerDogs.length > 1 && (
                      <button type="button" onClick={() => { setAddingNewDog(false); }} className="text-xs text-accent hover:text-accent/80 underline font-body">
                        ← Back to my dogs
                      </button>
                    )}
                    <div>
                      <Label className="text-xs font-body">Dog's Name *</Label>
                      <Input value={dogName} onChange={e => setDogName(e.target.value)} placeholder="Your pup's name" className="rounded-xl" />
                    </div>
                    <div>
                      <Label className="text-xs font-body">Dog's Breed</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={breedSearch} onChange={e => { setBreedSearch(e.target.value); setBreedId(""); }} placeholder="Search breed..." className="rounded-xl pl-9" />
                      </div>
                      {breedSearch && filteredBreeds.length > 0 && !breedId && (
                        <div className="border rounded-xl mt-1 max-h-40 overflow-y-auto bg-card shadow-lg">
                          {filteredBreeds.slice(0, 15).map(b => (
                            <button key={b.id} type="button" onClick={() => { setBreedId(b.id); setBreedSearch(b.name); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors font-body">{b.name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!user && (
                  <p className="text-xs text-muted-foreground font-body">
                    Already booked with us before? We'll recognise your email and link this to your existing profile.
                  </p>
                )}
              </div>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2} className="w-full mt-6 bg-accent hover:bg-accent/90 text-white font-bold h-12 rounded-full">
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* ── STEP 3: Pick Your Dates ── */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <h2 className="font-heading text-xl sm:text-2xl text-center mb-2 mt-2">Pick Your Dates</h2>
              <p className="text-xs text-muted-foreground text-center font-body mb-2">Choose a date and time for each session</p>
              {sessions[0]?.groomerId === "any" && !packageGroomerId && (
                <p className="text-[11px] text-accent text-center font-body mb-4 px-4">
                  💡 Once you pick session 1's date and time, we'll lock in your groomer so all sessions stay with the same person — keeps things consistent for your dog.
                </p>
              )}
              {!sessions[0]?.groomerId || sessions[0]?.groomerId !== "any" ? <div className="mb-4" /> : null}

              <div className="space-y-5">
                {sessions.map((session, idx) => (
                  <Card key={idx} className="rounded-2xl overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-heading text-sm">Session {idx + 1}</h3>
                        {sessionPrices[idx] > 0 && (
                          <span className="text-xs font-bold text-accent font-body">£{sessionPrices[idx].toFixed(2)}</span>
                        )}
                      </div>

                      {/* Service type for grooming packages */}
                      {!isTeethPackage && (
                        <div>
                          <Label className="text-[11px] font-body text-muted-foreground">Service</Label>
                          <Select value={session.serviceType} onValueChange={v => updateSession(idx, "serviceType", v)}>
                            <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full_groom">Full Groom</SelectItem>
                              <SelectItem value="bath_brush">Bath & Brush</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Groomer */}
                      <div>
                        <Label className="text-[11px] font-body text-muted-foreground">Groomer</Label>
                        <Select
                          value={session.groomerId}
                          onValueChange={v => updateSession(idx, "groomerId", v)}
                          disabled={idx > 0 && !!packageGroomerId && session.groomerId === "any"}
                        >
                          <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">No preference</SelectItem>
                            {groomers?.map(g => (
                              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {idx > 0 && packageGroomerName && session.groomerId === "any" && (
                          <p className="text-[10px] text-muted-foreground font-body mt-1">
                            Locked to <span className="font-bold text-accent">{packageGroomerName}</span> — sessions 2+ stay with the same groomer for consistency.
                          </p>
                        )}
                      </div>

                      {/* Date */}
                      <div>
                        <Label className="text-[11px] font-body text-muted-foreground">Date</Label>
                        <Input
                          type="date"
                          min={tomorrow}
                          value={session.date}
                          onChange={e => updateSession(idx, "date", e.target.value)}
                          className="rounded-xl h-9 text-sm"
                        />
                      </div>

                      {/* Time slots */}
                      {session.date && (
                        <div>
                          <Label className="text-[11px] font-body text-muted-foreground">Time</Label>
                          {loadingSlots[idx] ? (
                            <div className="flex items-center gap-2 py-2">
                              <Loader2 className="h-4 w-4 animate-spin text-accent" />
                              <span className="text-xs text-muted-foreground">Loading slots...</span>
                            </div>
                          ) : (slotsBySession[idx]?.length || 0) === 0 ? (
                            <p className="text-xs text-destructive font-body py-1">No available slots on this date</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {slotsBySession[idx]?.map(slot => (
                                <button
                                  key={slot}
                                  onClick={() => updateSession(idx, "time", slot)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-body font-bold transition-all ${
                                    session.time === slot
                                      ? "bg-accent text-white shadow-md"
                                      : "bg-muted text-foreground hover:bg-accent/10"
                                  }`}
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {dateWarnings[idx] && (
                        <div className="flex items-center gap-1.5 text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span className="text-xs font-body">{dateWarnings[idx]}</span>
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground font-body">You can reschedule with 48 hours notice after booking.</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button onClick={() => setStep(4)} disabled={!canProceedStep3} className="w-full mt-6 bg-accent hover:bg-accent/90 text-white font-bold h-12 rounded-full">
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* ── STEP 4: Review & Pay ── */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <h2 className="font-heading text-xl sm:text-2xl text-center mb-6 mt-2">Review & Pay</h2>

              <Card className="rounded-2xl mb-4">
                <CardContent className="p-5 space-y-4">
                  <div>
                    <h3 className="font-heading text-base">{selectedPkg?.name}</h3>
                    <p className="text-sm text-muted-foreground font-body">{firstName} {lastName} — {dogName}</p>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {sessions.map((s, i) => {
                      const resolvedId = s.groomerId === "any" ? packageGroomerId : s.groomerId;
                      const resolvedName = resolvedId ? groomers?.find(g => g.id === resolvedId)?.name : null;
                      const groomerName = resolvedName || (s.groomerId === "any" ? "Any available groomer" : "—");
                      const serviceLabel = isTeethPackage ? "Teeth Cleaning" : s.serviceType === "bath_brush" ? "Bath & Brush" : "Full Groom";
                      return (
                        <div key={i} className="flex items-start justify-between text-sm">
                          <div>
                            <p className="font-body font-bold">Session {i + 1} — {serviceLabel}</p>
                            <p className="text-xs text-muted-foreground font-body">
                              {s.date ? format(new Date(s.date + "T00:00:00"), "EEE dd MMM yyyy") : "—"} at {s.time || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground font-body">with {groomerName}</p>
                          </div>
                          <span className="font-body font-bold text-sm">£{sessionPrices[i]?.toFixed(2) || "—"}</span>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />

                  {/* Price breakdown */}
                  {!isTeethPackage && selectedBreed && (
                    <div className="space-y-1 text-sm">
                      {sessions.map((s, i) => {
                        const originalPrice = s.serviceType === "bath_brush" ? selectedBreed.price_bath_brush : selectedBreed.price_full_groom;
                        return (
                          <div key={i} className="flex justify-between text-xs text-muted-foreground font-body">
                            <span>Session {i + 1}: £{Number(originalPrice).toFixed(2)} - {selectedPkg?.discount_percentage}%</span>
                            <span>£{sessionPrices[i]?.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {isTeethPackage && (
                    <div className="text-xs text-muted-foreground font-body">
                      5 × £20.00 per session (normally £25)
                    </div>
                  )}

                  <div className="flex justify-between items-center font-heading text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-accent font-bold">
                      {unknownBreed && !isTeethPackage ? "Price TBC" : `£${totalPrice.toFixed(2)}`}
                    </span>
                  </div>

                  {unknownBreed && !isTeethPackage && (
                    <p className="text-xs text-amber-600 font-body">
                      We'll confirm your exact price after booking — our team will be in touch.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* T&C */}
              <div className="flex items-start gap-3 mb-4">
                <Checkbox checked={tcAgreed} onCheckedChange={v => setTcAgreed(!!v)} id="tc" className="mt-0.5" />
                <label htmlFor="tc" className="text-xs font-body text-muted-foreground leading-relaxed cursor-pointer">
                  I have read and agree to the{" "}
                  <button onClick={() => setTcDialogOpen(true)} className="text-accent underline font-bold">
                    Package Deal Terms & Conditions
                  </button>
                </label>
              </div>

              <Button
                onClick={handlePay}
                disabled={!tcAgreed || paying || (unknownBreed && !isTeethPackage)}
                className="w-full bg-accent hover:bg-accent/90 text-white font-bold h-12 rounded-full"
              >
                {paying ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</>
                ) : (
                  `Pay Now — £${totalPrice.toFixed(2)}`
                )}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center font-body mt-3">
                Secure payment powered by Stripe. Your card details are never stored by us.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* T&C Dialog */}
      <Dialog open={tcDialogOpen} onOpenChange={setTcDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Package Deal Terms & Conditions</DialogTitle>
          </DialogHeader>
          <ol className="space-y-3 text-sm font-body text-muted-foreground list-decimal pl-5">
            {TC_POINTS.map((p, i) => (
              <li key={i} className="leading-relaxed">{p}</li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
