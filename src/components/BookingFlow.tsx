import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Dog, ChevronRight, PawPrint, Save, Move, Sparkles, Check, ChevronLeft, Calendar, Info, X, Lock, Ticket } from "lucide-react";
import { generateAvailableSlots, dateHasAnyAvailability, findFreeGroomer, parseTimeToMinutes } from "@/lib/availability";
import type { StaffAvailability, ScheduleOverride, ExistingBooking, Groomer } from "@/lib/availability";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import serviceBathBrush from "@/assets/service-bath-brush.jpg";
import serviceFullGroomSub from "@/assets/service-full-groom-sub.jpg";

const ADJUST_MODE = false;

type Step = "sub-service" | "breed" | "calendar" | "addons" | "guest-details" | null;

// ─── Paw Progress Bar ───────────────────────────────────────────────
const STEP_LABELS: Record<string, string> = {
  "sub-service": "Style",
  breed: "Breed",
  calendar: "Date",
  addons: "Extras",
  "guest-details": "Pay",
};

function PawProgressBar({ steps, currentStep }: { steps: Step[]; currentStep: Step }) {
  const currentIdx = steps.indexOf(currentStep);
  return (
    <div className="flex items-center justify-center gap-3 py-3 px-4">
      {steps.map((s, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={s} className="flex flex-col items-center gap-1 relative">
            <motion.div
              animate={isCurrent ? { rotate: [-15, 15, -15] } : { rotate: 0 }}
              transition={isCurrent ? { repeat: Infinity, duration: 0.6, ease: "easeInOut" } : { duration: 0.2 }}
            >
              <PawPrint
                className={`h-5 w-5 transition-colors duration-300 ${
                  isCompleted
                    ? "text-accent fill-accent"
                    : isCurrent
                    ? "text-accent"
                    : "text-border"
                }`}
              />
            </motion.div>
            <span className={`text-[0.6rem] font-body font-bold transition-colors duration-300 ${
              isCurrent ? "text-accent" : isCompleted ? "text-foreground" : "text-muted-foreground/40"
            }`}>
              {STEP_LABELS[s!] ?? ""}
            </span>
            {isCurrent && (
              <motion.div
                className="absolute -bottom-1 w-6 h-0.5 bg-accent rounded-full"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.3 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tail Wag Spinner ───────────────────────────────────────────────
function TailWagSpinner({ size = 40, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        animate={{ rotate: [-20, 20, -20] }}
        transition={{ repeat: Infinity, duration: 0.4, ease: "easeInOut" }}
        style={{ originX: "50%", originY: "100%" }}
      >
        <path
          d="M32 58 C32 58 28 40 20 28 C14 19 8 16 8 16 C8 16 18 12 26 20 C34 28 32 58 32 58Z"
          fill="hsl(var(--accent))"
          opacity={0.8}
        />
        <path
          d="M32 58 C32 58 36 40 44 28 C50 19 56 16 56 16 C56 16 46 12 38 20 C30 28 32 58 32 58Z"
          fill="hsl(var(--accent))"
          opacity={0.5}
        />
      </motion.svg>
      {label && <p className="text-sm text-muted-foreground font-body">{label}</p>}
    </div>
  );
}

// ─── Slide Variants ─────────────────────────────────────────────────
const slideVariants = {
  enterForward: { x: 80, opacity: 0 },
  enterBack: { x: -80, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exitForward: { x: -80, opacity: 0 },
  exitBack: { x: 80, opacity: 0 },
};

interface BookingFlowProps {
  service: string;
  onClose: () => void;
  preselectedBreedId?: string | null;
  preselectedPetName?: string;
  isNewCustomer?: boolean;
  dogAgeYears?: number | null;
  dogAgeMonths?: number | null;
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

export function BookingFlow({ service, onClose, preselectedBreedId, preselectedPetName, isNewCustomer, dogAgeYears, dogAgeMonths }: BookingFlowProps) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const utmCampaignId = searchParams.get("utm_campaign") || null;
  const isExistingCustomer = !isNewCustomer && !!user;

  const [step, setStep] = useState<Step>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [breedSearch, setBreedsSearch] = useState("");
  const [selectedBreed, setSelectedBreed] = useState<any>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [infoPopup, setInfoPopup] = useState<{ name: string; description: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [guestForm, setGuestForm] = useState({ name: "", phone: "", email: "", dogName: preselectedPetName || "", password: "", notes: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; discount_type: string; discount_value: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentType, setPaymentType] = useState<"deposit" | "full">("full");
  const [ageYears, setAgeYears] = useState<string>(dogAgeYears != null ? String(dogAgeYears) : "0");
  const [ageMonths, setAgeMonths] = useState<string>(dogAgeMonths != null ? String(dogAgeMonths) : "0");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [puppySwitched, setPuppySwitched] = useState(false);
  const [showPuppyPopup, setShowPuppyPopup] = useState(false);
  const [migratedDetected, setMigratedDetected] = useState<{ found: boolean; name?: string } | null>(null);
  const [checkingMigrated, setCheckingMigrated] = useState(false);
  const [serverVerifiedSlots, setServerVerifiedSlots] = useState<string[] | null>(null);
  const [verifyingSlots, setVerifyingSlots] = useState(false);
  const [packagePromptDismissed, setPackagePromptDismissed] = useState(false);
  const [showPackagePopup, setShowPackagePopup] = useState(false);

  const effectiveService = puppySwitched ? "Puppy Special" : service;

  // Navigation helper that tracks direction
  const goToStep = useCallback((newStep: Step, dir: "forward" | "back" = "forward") => {
    setDirection(dir);
    setStep(newStep);
  }, []);

  // Compute visible steps for the progress bar
  const visibleSteps = useMemo((): Step[] => {
    const steps: Step[] = [];
    if (effectiveService === "Grooming") steps.push("sub-service");
    const needsBreed = effectiveService === "Grooming" || effectiveService === "Puppy Special";
    if (needsBreed) steps.push("breed");
    steps.push("calendar");
    const isFixedPriceCheck = effectiveService !== "Grooming";
    if (!isFixedPriceCheck) steps.push("addons");
    steps.push("guest-details");
    return steps;
  }, [effectiveService]);

  const { data: dbService } = useQuery({
    queryKey: ["service-record", effectiveService],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, fixed_price, duration_minutes")
        .eq("is_active", true)
        .ilike("name", `%${effectiveService}%`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: effectiveService !== "Grooming",
  });

  const isFixedPrice = effectiveService !== "Grooming" && dbService?.fixed_price != null;
  const needsBreed = effectiveService === "Grooming" || effectiveService === "Puppy Special";

  const getInitialStep = (): Step => {
    if (!needsBreed) return "calendar";
    if (preselectedBreedId) return effectiveService === "Grooming" ? "sub-service" : "calendar";
    return effectiveService === "Grooming" ? "sub-service" : "breed";
  };

  const { data: termsContent } = useQuery({
    queryKey: ["site_config", "terms_and_conditions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("value")
        .eq("key", "terms_and_conditions")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as string) ?? "";
    },
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isExistingCustomer && user) {
      const meta = user.user_metadata;
      const metaPhone = meta?.phone || "";
      const metaName = meta?.full_name || "";
      const email = user.email || "";

      setGuestForm(prev => ({
        ...prev,
        name: metaName || prev.name,
        email: email || prev.email,
        phone: metaPhone || prev.phone,
        dogName: preselectedPetName || prev.dogName,
      }));

      // If phone or dogName still missing, fetch from DB
      const needsPhone = !metaPhone;
      const needsDog = !preselectedPetName;

      if ((needsPhone || needsDog) && email) {
        (async () => {
          let fallbackPhone = "";
          let fallbackDog = "";

          if (needsPhone) {
            // Try bookings first
            const { data: booking } = await supabase
              .from("bookings")
              .select("customer_phone")
              .ilike("customer_email", email)
              .not("customer_phone", "is", null)
              .limit(1)
              .maybeSingle();
            if (booking?.customer_phone) {
              fallbackPhone = booking.customer_phone;
            } else {
              // Try migrated_customers
              const { data: mc } = await supabase
                .from("migrated_customers")
                .select("phone")
                .ilike("email", email)
                .not("phone", "is", null)
                .limit(1)
                .maybeSingle();
              if (mc?.phone) fallbackPhone = mc.phone;
            }
          }

          if (needsDog) {
            const { data: pet } = await supabase
              .from("customer_pets")
              .select("pet_name")
              .eq("user_id", user.id)
              .limit(1)
              .maybeSingle();
            if (pet?.pet_name) fallbackDog = pet.pet_name;
          }

          if (fallbackPhone || fallbackDog) {
            setGuestForm(prev => ({
              ...prev,
              phone: prev.phone || fallbackPhone,
              dogName: prev.dogName || fallbackDog,
            }));
          }
        })();
      }
    }
  }, [isExistingCustomer, user, preselectedPetName]);

  useEffect(() => {
    if (step === null) {
      setStep(getInitialStep());
    }
    if (step === "sub-service" || step === "breed") {
      window.gtag?.("event", "booking_started", { event_category: "booking" });
    }
  }, [dbService, isFixedPrice]);

  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => getMonday(today));

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

  useEffect(() => {
    if (preselectedBreedId && breeds && !selectedBreed) {
      const breed = breeds.find(b => b.id === preselectedBreedId);
      if (breed) setSelectedBreed(breed);
    }
  }, [preselectedBreedId, breeds, selectedBreed]);

  const { data: groomers } = useQuery({
    queryKey: ["groomers-for-booking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, name, role, booking_priority, is_accepting_bookings, employment_end_date, block_new_bookings")
        .ilike("role", "%groomer%")
        .eq("is_accepting_bookings", true)
        .eq("block_new_bookings", false)
        .order("name");
      if (error) throw error;
      return data as Groomer[];
    },
  });

  const { data: baseSchedules } = useQuery({
    queryKey: ["staff-availability-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_availability")
        .select("staff_id, day_of_week, start_time, end_time, is_available");
      if (error) throw error;
      return (data || []) as StaffAvailability[];
    },
  });

  // Staff <-> Service assignments (used to filter groomers by what they can perform)
  const { data: staffServices } = useQuery({
    queryKey: ["staff-services-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_services")
        .select("staff_id, service_id");
      if (error) throw error;
      return data as { staff_id: string; service_id: string }[];
    },
  });

  const weekEndDate = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);

  const weekStartStr = useMemo(() => {
    const d = weekStart;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [weekStart]);

  const weekEndStr = useMemo(() => {
    const d = weekEndDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [weekEndDate]);

  const { data: allOverridesForWeek } = useQuery({
    queryKey: ["schedule-overrides-for-week", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_schedule_overrides")
        .select("staff_id, override_date, start_time, end_time, is_working")
        .gte("override_date", weekStartStr)
        .lte("override_date", weekEndStr);
      if (error) throw error;
      return (data || []) as ScheduleOverride[];
    },
  });

  const allOverridesForDate = useMemo(() => {
    if (!selectedDate || !allOverridesForWeek) return [];
    return allOverridesForWeek.filter(o => o.override_date === selectedDate);
  }, [selectedDate, allOverridesForWeek]);

  const { data: lastGroomerBooking } = useQuery({
    queryKey: ["last-groomer", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      // Check real bookings first
      const { data: realBooking } = await supabase
        .from("bookings")
        .select("staff_id, staff:staff_id(name)")
        .eq("customer_email", user.email)
        .eq("status", "Completed")
        .not("staff_id", "is", null)
        .order("booking_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (realBooking) return { staff_id: realBooking.staff_id, staff_name: (realBooking as any).staff?.name || null };

      // Check migrated bookings
      const { data: mc } = await supabase
        .from("migrated_customers")
        .select("id")
        .eq("supabase_user_id", user.id)
        .maybeSingle();
      if (mc) {
        const { data: migratedBooking } = await supabase
          .from("migrated_bookings")
          .select("staff_name")
          .eq("migrated_customer_id", mc.id)
          .not("staff_name", "is", null)
          .order("booking_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (migratedBooking?.staff_name) {
          // Match by first name
          const firstName = migratedBooking.staff_name.split(" ")[0]?.toLowerCase();
          const matched = groomers?.find(g => g.name.split(" ")[0].toLowerCase() === firstName);
          if (matched) return { staff_id: matched.id, staff_name: matched.name };
        }
      }
      return null;
    },
    enabled: isExistingCustomer && !!user?.email,
  });

  const lastGroomerId = lastGroomerBooking?.staff_id ?? null;
  const lastGroomerName = lastGroomerBooking?.staff_name ?? null;

  const { data: dbAddOns } = useQuery({
    queryKey: ["add_ons_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("add_ons").select("*").eq("is_active", true).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: addOnServiceLinks } = useQuery({
    queryKey: ["add_on_services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("add_on_services").select("add_on_id, service_id");
      if (error) throw error;
      return data;
    },
  });

  const resolvedServiceName = selectedSub ?? service;
  const { data: currentServiceRecord } = useQuery({
    queryKey: ["current-service-record", resolvedServiceName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id")
        .eq("is_active", true)
        .ilike("name", `%${resolvedServiceName}%`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!resolvedServiceName,
  });

  const filteredAddOns = dbAddOns?.filter((addon) => {
    const links = addOnServiceLinks?.filter((l) => l.add_on_id === addon.id) ?? [];
    if (links.length === 0) return true;
    if (!currentServiceRecord?.id) return true;
    return links.some((l) => l.service_id === currentServiceRecord.id);
  });

  const filteredBreeds = breedSearch.length > 0
    ? breeds?.filter((b) => b.name.toLowerCase().includes(breedSearch.toLowerCase()))
    : breeds;

  const serviceType = puppySwitched ? "Puppy Special" : (selectedSub ?? service);
  const isEstimatePrice = !isFixedPrice && selectedBreed && !selectedBreed.id;
  const basePrice = isFixedPrice
    ? Number(dbService!.fixed_price)
    : selectedBreed
      ? (serviceType === "Bath & Brush"
        ? (selectedBreed.price_bath_brush || 52)
        : (selectedBreed.price_full_groom || 52))
      : 0;
  const serviceDuration = isFixedPrice
    ? (dbService!.duration_minutes ?? 60)
    : (selectedBreed?.duration_minutes ?? 60);
  const addOnsTotal = selectedAddOns.reduce((sum, id) => {
    const addon = dbAddOns?.find(a => a.id === id);
    return sum + (addon ? Number(addon.price) : 0);
  }, 0);
  const subtotal = basePrice + addOnsTotal;
  const couponDiscount = appliedCoupon
    ? appliedCoupon.discount_type === "percentage"
      ? Math.round(subtotal * appliedCoupon.discount_value / 100 * 100) / 100
      : Math.min(appliedCoupon.discount_value, subtotal)
    : 0;
  const totalPrice = Math.max(0, subtotal - couponDiscount);
  const depositAmount = Math.round(totalPrice * 0.6 * 100) / 100;
  const remainingAmount = Math.round((totalPrice - depositAmount) * 100) / 100;

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError("");
    setCouponLoading(true);
    try {
      const { data: coupon, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!coupon) { setCouponError("Invalid coupon code"); return; }

      const now = new Date();
      if (coupon.start_date && new Date(coupon.start_date) > now) { setCouponError("This coupon is not active yet"); return; }
      if (coupon.end_date && new Date(coupon.end_date) < now) { setCouponError("This coupon has expired"); return; }
      if (coupon.max_uses && coupon.times_used >= coupon.max_uses) { setCouponError("This coupon has been fully redeemed"); return; }
      if (coupon.min_order_amount && subtotal < Number(coupon.min_order_amount)) {
        setCouponError(`Minimum order £${Number(coupon.min_order_amount).toFixed(2)} required`);
        return;
      }

      if (guestForm.email && coupon.max_uses_per_customer) {
        const { count } = await supabase
          .from("coupon_usages")
          .select("*", { count: "exact", head: true })
          .eq("coupon_id", coupon.id)
          .eq("customer_email", guestForm.email.toLowerCase());
        if (count && count >= coupon.max_uses_per_customer) {
          setCouponError("You've already used this coupon");
          return;
        }
      }

      setAppliedCoupon({
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: Number(coupon.discount_value),
      });
      toast.success(`Coupon "${coupon.code}" applied!`);
    } catch {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  const handleSubSelect = (sub: string) => {
    setSelectedSub(sub);
    goToStep("breed", "forward");
  };

  const handleBreedSelect = (breed: any | null) => {
    setSelectedBreed(breed);
    setSelectedAddOns([]);
    setSelectedDate(null);
    setSelectedTime(null);
    if (dogAgeYears != null || dogAgeMonths != null) {
      goToStep("calendar", "forward");
    }
  };

  const handleBreedAndAgeContinue = () => {
    const years = parseInt(ageYears, 10);
    const months = parseInt(ageMonths, 10);
    const isPuppy = years === 0 && months <= 6;

    if (isPuppy && (selectedSub === "Full Groom" || selectedSub === "Bath & Brush" || service === "Grooming")) {
      setPuppySwitched(true);
      setSelectedSub(null);
      setShowPuppyPopup(true);
      return;
    }

    goToStep("calendar", "forward");
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOns(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const handlePayment = (type: "deposit" | "full") => {
    setPaymentType(type);
    handleGuestSubmit(type);
  };

  const handleGuestSubmit = async (selectedPaymentType: "deposit" | "full" = "full") => {
    // For new/guest customers, hard-block on missing required fields
    if (!isExistingCustomer && (!guestForm.name.trim() || !guestForm.dogName.trim() || !guestForm.phone.trim())) {
      setAlertMessage("Please fill in your name, phone number and dog's name");
      return;
    }

    // For existing customers, use local variables for immediate access (setState is async)
    // Auto-fill missing values with fallbacks — warn but NEVER block payment
    const submitName = guestForm.name.trim() || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Customer";
    const submitDogName = guestForm.dogName.trim() || "Not specified";
    const submitPhone = guestForm.phone.trim() || "";
    const submitEmail = guestForm.email.trim() || user?.email || "";

    if (isExistingCustomer) {
      if (!guestForm.dogName.trim() || !guestForm.phone.trim() || !guestForm.name.trim()) {
        toast.info("Please confirm your details when you arrive at the salon");
      }
    }
    if (!acceptedTerms) {
      setAlertMessage("Please accept the Terms & Conditions to continue");
      return;
    }

    setIsSubmitting(true);

    if (isNewCustomer) {
      if (!guestForm.email.trim() || !guestForm.password.trim()) {
        setAlertMessage("Please enter your email and choose a password");
        setIsSubmitting(false);
        return;
      }
      if (guestForm.password.length < 6) {
        setAlertMessage("Password must be at least 6 characters");
        setIsSubmitting(false);
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
        if (signUpError.message?.toLowerCase().includes("already registered") || signUpError.message?.toLowerCase().includes("already exists")) {
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email: guestForm.email,
            password: guestForm.password,
          });
          if (loginError) {
            setAlertMessage("An account with this email already exists. Please check your password and try again.");
            setIsSubmitting(false);
            return;
          }
        } else {
          setAlertMessage(signUpError.message);
          setIsSubmitting(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: guestForm.email,
          password: guestForm.password,
        });

        if (signInError) {
          console.warn("Auto sign-in failed:", signInError.message);
        }

        const userId = signUpData?.user?.id;
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
    }

    let assignedStaffId: string | null = null;

    // ALWAYS re-fetch fresh data at submission time to prevent double-bookings
    if (groomers && groomers.length > 0 && baseSchedules) {
      const [freshBookingsRes, freshOverridesRes, freshMigratedRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("booking_time, staff_id, duration_minutes, services(duration_minutes), breeds(duration_minutes)")
          .eq("booking_date", selectedDate!)
          .not("status", "in", "(Cancelled,No Show,Refunded)"),
        supabase
          .from("staff_schedule_overrides")
          .select("staff_id, override_date, start_time, end_time, is_working")
          .eq("override_date", selectedDate!),
        supabase
          .from("migrated_bookings")
          .select("booking_time, staff_name, duration_minutes")
          .eq("booking_date", selectedDate!)
          .eq("is_future_booking", true),
      ]);

      // Convert migrated bookings to ExistingBooking format by matching staff name
      const migratedAsBookings: ExistingBooking[] = (freshMigratedRes.data || [])
        .map((mb: any) => {
          const firstName = mb.staff_name?.split(" ")[0]?.toLowerCase() || "";
          const matched = groomers.find(g => g.name.split(" ")[0].toLowerCase() === firstName);
          if (!matched || !mb.booking_time) return null;
          return {
            staff_id: matched.id,
            booking_time: mb.booking_time,
            services: { duration_minutes: mb.duration_minutes || 60 },
          } as ExistingBooking;
        })
        .filter(Boolean) as ExistingBooking[];

      const freshBookings = [...(freshBookingsRes.data || []) as ExistingBooking[], ...migratedAsBookings];
      const freshOverrides = (freshOverridesRes.data || []) as ScheduleOverride[];
      const bookingDate = new Date(selectedDate! + "T00:00:00");

      if (isExistingCustomer && selectedStaffId) {
        // Customer selected a specific groomer — verify THAT groomer is still free
        const slotStart = parseTimeToMinutes(selectedTime!);
        const slotEnd = slotStart + serviceDuration;

        // Check the selected groomer has no booking conflict at this time

        const hasBookingConflict = freshBookings.some((b) => {
          if (b.staff_id !== selectedStaffId) return false;
          const bStart = parseTimeToMinutes(b.booking_time);
          const bDuration = Number(b.duration_minutes ?? b.services?.duration_minutes ?? b.breeds?.duration_minutes ?? 90);
          const bEnd = bStart + bDuration;
          return slotStart < bEnd && slotEnd > bStart;
        });

        if (hasBookingConflict) {
          setAlertMessage("This slot is no longer available — your selected groomer already has a booking at this time. Please choose another time.");
          setIsSubmitting(false);
          return;
        }

        assignedStaffId = selectedStaffId;
      } else {
        // No preference — find any free groomer by priority
        const freeGroomer = findFreeGroomer(
          selectedTime!,
          serviceDuration,
          bookingDate,
          groomers,
          baseSchedules,
          freshOverrides,
          freshBookings,
          staffServices,
          currentServiceRecord?.id ?? null
        );

        if (!freeGroomer) {
          setAlertMessage("This slot is no longer available. The groomer's schedule changed while you were booking. Please choose another time.");
          setIsSubmitting(false);
          return;
        }

        assignedStaffId = freeGroomer.id;
      }
    }

    // ── Server-side availability check via edge function ──
    console.log(`[booking] Server-side availability check: groomer=${assignedStaffId} date=${selectedDate} time=${selectedTime} duration=${serviceDuration}`);
    try {
      const { data: availCheck, error: availErr } = await supabase.functions.invoke("check-availability", {
        body: {
          groomer_id: assignedStaffId,
          date: selectedDate,
          start_time: selectedTime,
          duration_minutes: serviceDuration,
          service_id: currentServiceRecord?.id ?? null,
        },
      });
      if (availErr) {
        console.error("[booking] Availability check failed:", availErr);
        setAlertMessage("Could not verify availability — please try again.");
        setIsSubmitting(false);
        return;
      }
      if (!availCheck?.available) {
        console.warn("[booking] Server rejected:", availCheck?.reason);
        setAlertMessage(availCheck?.reason || "Sorry, this slot is no longer available. Please choose another time.");
        setIsSubmitting(false);
        return;
      }
    } catch (checkErr) {
      console.error("[booking] Availability check error:", checkErr);
      setAlertMessage("Could not verify availability — please try again.");
      setIsSubmitting(false);
      return;
    }

    const { data: insertedBooking, error } = await supabase.from("bookings").insert({
      customer_name: submitName,
      customer_phone: submitPhone || null,
      customer_email: submitEmail || null,
      dog_name: submitDogName,
      breed_id: selectedBreed?.id ?? null,
      service_id: currentServiceRecord?.id ?? dbService?.id ?? null,
      staff_id: assignedStaffId,
      booking_date: selectedDate!,
      booking_time: selectedTime!,
      total_price: totalPrice,
      deposit_paid: 0,
      duration_minutes: serviceDuration,
      notes: guestForm.notes.trim() || null,
      status: "Pending",
      campaign_id: utmCampaignId,
      booking_source: "online",
    } as any).select("id").single();

    if (error) {
      setAlertMessage("Failed to book — please try again");
      setIsSubmitting(false);
      return;
    }

    // Audit trail entry for online booking
    if (insertedBooking?.id) {
      supabase.from("booking_audit_log" as any).insert({
        booking_id: insertedBooking.id,
        event_type: "created_online",
        performed_by: "Customer (online)",
        note: "Booking created online by customer",
      } as any).then(() => {});
    }

    if (appliedCoupon && insertedBooking?.id) {
      try {
        await supabase.from("coupon_usages").insert({
          coupon_id: appliedCoupon.id,
          customer_email: (submitEmail || "guest").toLowerCase(),
          booking_id: insertedBooking.id,
        });
        const { data: couponData } = await supabase.from("coupons").select("times_used").eq("id", appliedCoupon.id).single();
        if (couponData) {
          await supabase.from("coupons").update({ times_used: couponData.times_used + 1 }).eq("id", appliedCoupon.id);
        }
      } catch { /* ignore */ }
    }

    try {
      if (totalPrice <= 0) {
        throw new Error("Total price must be greater than £0");
      }

      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-deposit-checkout", {
        body: {
          customer_name: submitName,
          customer_email: submitEmail || null,
          dog_name: submitDogName,
          service_name: serviceType,
          total_price: totalPrice,
          booking_id: insertedBooking.id,
          payment_type: selectedPaymentType,
        },
      });

      if (checkoutError || !checkoutData?.url) {
        throw new Error(checkoutData?.error || "Failed to create payment session");
      }

      const paidAmount = selectedPaymentType === "full" ? totalPrice : depositAmount;
      await supabase.from("bookings").update({ deposit_paid: paidAmount }).eq("id", insertedBooking.id);

      window.location.href = checkoutData.url;
      return;
    } catch (stripeErr: any) {
      console.error("Stripe checkout error:", stripeErr);
      await supabase.from("bookings").delete().eq("id", insertedBooking.id);
      setAlertMessage("Payment could not be processed. Please try again.");
      setIsSubmitting(false);
      return;
    }
  };

  const goBack = useCallback(() => {
    if (step === "guest-details" && isFixedPrice) {
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedStaffId(null);
      goToStep("calendar", "back");
    } else if (step === "guest-details") {
      setSelectedAddOns([]);
      goToStep("addons", "back");
    } else if (step === "addons") {
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedStaffId(null);
      goToStep("calendar", "back");
    } else if (step === "calendar" && needsBreed) {
      if (dogAgeYears != null || dogAgeMonths != null) {
        setSelectedBreed(null);
        setBreedsSearch("");
      } else {
        setAgeYears("0");
        setAgeMonths("0");
      }
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedStaffId(null);
      if (puppySwitched) {
        setPuppySwitched(false);
      }
      goToStep("breed", "back");
    } else if (step === "breed" && selectedBreed) {
      setSelectedBreed(null);
      setBreedsSearch("");
      setAgeYears("0");
      setAgeMonths("0");
    } else if (step === "breed" && (service === "Grooming" || effectiveService === "Grooming")) {
      setSelectedSub(null);
      setPuppySwitched(false);
      goToStep("sub-service", "back");
    } else {
      onClose();
    }
  }, [step, service, effectiveService, onClose, needsBreed, dogAgeYears, dogAgeMonths, selectedBreed, puppySwitched, isFixedPrice, goToStep]);

  const { data: existingBookingsForDate } = useQuery({
    queryKey: ["bookings-for-date", selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      const [bookingsRes, migratedRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("booking_time, staff_id, duration_minutes, services(duration_minutes), breeds(duration_minutes)")
          .eq("booking_date", selectedDate)
          .not("status", "in", "(Cancelled,No Show,Refunded)"),
        supabase
          .from("migrated_bookings")
          .select("booking_time, staff_name, duration_minutes")
          .eq("booking_date", selectedDate)
          .eq("is_future_booking", true),
      ]);
      if (bookingsRes.error) throw bookingsRes.error;
      const realBookings = (bookingsRes.data || []) as ExistingBooking[];
      
      // Convert migrated bookings to ExistingBooking format
      const migratedAsBookings: ExistingBooking[] = (migratedRes.data || [])
        .map((mb: any) => {
          const firstName = mb.staff_name?.split(" ")[0]?.toLowerCase() || "";
          const matched = groomers?.find(g => g.name.split(" ")[0].toLowerCase() === firstName);
          if (!matched || !mb.booking_time) return null;
          return {
            staff_id: matched.id,
            booking_time: mb.booking_time,
            services: { duration_minutes: mb.duration_minutes || 60 },
          } as ExistingBooking;
        })
        .filter(Boolean) as ExistingBooking[];
      
      console.log(`[availability] Date ${selectedDate}: ${realBookings.length} bookings + ${migratedAsBookings.length} migrated bookings`);
      return [...realBookings, ...migratedAsBookings];
    },
    enabled: !!selectedDate && !!groomers?.length,
  });

  const clientSideSlots = useMemo(() => {
    if (!selectedDate || !groomers?.length || !baseSchedules) return [];
    const date = new Date(selectedDate + "T00:00:00");
    // If customer selected a specific groomer, only show THAT groomer's available slots
    const groomersForSlots = (isExistingCustomer && selectedStaffId)
      ? groomers.filter(g => g.id === selectedStaffId)
      : groomers;
    if (!groomersForSlots.length) return [];
    console.log(`[availability] Generating slots: duration=${serviceDuration}min, groomers=${groomersForSlots.length}, bookings=${(existingBookingsForDate || []).length}`);
    return generateAvailableSlots(
      date,
      serviceDuration,
      groomersForSlots,
      baseSchedules,
      allOverridesForDate || [],
      existingBookingsForDate || [],
      30,
      staffServices,
      currentServiceRecord?.id ?? null
    );
  }, [selectedDate, groomers, baseSchedules, allOverridesForDate, existingBookingsForDate, serviceDuration, isExistingCustomer, selectedStaffId, staffServices, currentServiceRecord?.id]);

  // Server-side verification of every slot via check-availability edge function
  useEffect(() => {
    if (!clientSideSlots.length || !selectedDate) {
      setServerVerifiedSlots([]);
      setVerifyingSlots(false);
      return;
    }

    // Determine which groomer(s) to check — if customer picked one, use that; otherwise check all
    const groomerIdsToCheck = (isExistingCustomer && selectedStaffId)
      ? [selectedStaffId]
      : (groomers || []).map(g => g.id);

    if (!groomerIdsToCheck.length) {
      setServerVerifiedSlots([]);
      return;
    }

    let cancelled = false;
    setVerifyingSlots(true);
    setServerVerifiedSlots(null);

    (async () => {
      console.log(`[availability] Server-verifying ${clientSideSlots.length} slots for date=${selectedDate}`);
      const verified: string[] = [];

      // Check all slots in parallel (batch of promises)
      const results = await Promise.all(
        clientSideSlots.map(async (time) => {
          // For "any groomer" mode, check each groomer until one is available
          for (const gid of groomerIdsToCheck) {
            try {
              const { data } = await supabase.functions.invoke("check-availability", {
                body: {
                  groomer_id: gid,
                  date: selectedDate,
                  start_time: time,
                  duration_minutes: serviceDuration,
                  service_id: currentServiceRecord?.id ?? null,
                },
              });
              if (data?.available) return time;
            } catch (err) {
              console.warn(`[availability] Edge fn error for slot ${time} groomer ${gid}:`, err);
            }
          }
          return null; // No groomer available for this slot
        })
      );

      if (cancelled) return;

      for (const r of results) {
        if (r) verified.push(r);
      }

      console.log(`[availability] Server verified: ${verified.length}/${clientSideSlots.length} slots available`);
      setServerVerifiedSlots(verified);
      setVerifyingSlots(false);
    })();

    return () => { cancelled = true; };
  }, [clientSideSlots, selectedDate, serviceDuration, groomers, isExistingCustomer, selectedStaffId]);

  // Use server-verified slots for display; fall back to empty while verifying
  const availableTimeSlots = serverVerifiedSlots ?? [];

  // ─── Alternative service suggestions when Full Groom is fully booked ─────
  // Fetch service IDs for Bath & Brush and Nail Trim once
  const { data: alternativeServices } = useQuery({
    queryKey: ["alt-services-bath-nail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, fixed_price, duration_minutes")
        .eq("is_active", true)
        .in("name", ["Bath & Brush", "Nail Trim & Filing"]);
      if (error) throw error;
      return data || [];
    },
  });

  const bathBrushService = alternativeServices?.find((s: any) => s.name === "Bath & Brush") || null;
  const nailTrimService = alternativeServices?.find((s: any) => s.name === "Nail Trim & Filing") || null;

  const isFullGroomSelection = (selectedSub === "Full Groom") || (effectiveService === "Grooming" && !selectedSub);

  const altSuggestions = useMemo(() => {
    if (!selectedDate || !groomers?.length || !baseSchedules) return { bathBrush: false, nailTrim: false };
    if (!isFullGroomSelection) return { bathBrush: false, nailTrim: false };
    if (verifyingSlots) return { bathBrush: false, nailTrim: false };
    if (availableTimeSlots.length > 0) return { bathBrush: false, nailTrim: false };
    const date = new Date(selectedDate + "T00:00:00");
    // Bath & Brush: same breed duration as Full Groom in current schema
    const bathSlots = bathBrushService
      ? generateAvailableSlots(
          date,
          serviceDuration,
          groomers,
          baseSchedules,
          allOverridesForDate || [],
          existingBookingsForDate || [],
          30,
          staffServices,
          bathBrushService.id
        )
      : [];
    const nailDuration = nailTrimService?.duration_minutes ?? 10;
    const nailSlots = nailTrimService
      ? generateAvailableSlots(
          date,
          nailDuration,
          groomers,
          baseSchedules,
          allOverridesForDate || [],
          existingBookingsForDate || [],
          30,
          staffServices,
          nailTrimService.id
        )
      : [];
    return { bathBrush: bathSlots.length > 0, nailTrim: nailSlots.length > 0 };
  }, [selectedDate, groomers, baseSchedules, allOverridesForDate, existingBookingsForDate, serviceDuration, staffServices, bathBrushService, nailTrimService, isFullGroomSelection, verifyingSlots, availableTimeSlots.length]);

  const switchToBathBrush = () => {
    setSelectedSub("Bath & Brush");
    setSelectedDate(null);
    setSelectedTime(null);
    setServerVerifiedSlots(null);
    toast.success("Switched to Bath & Brush — pick a time");
  };

  const switchToNailTrim = () => {
    onClose();
    window.location.href = `/book?service=${encodeURIComponent("Nail Trim & Filing")}`;
  };

  const isDateSelectableDate = (d: Date) => {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (d <= todayStart) return false;
    if (!groomers?.length || !baseSchedules) return false;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const overridesForDay = (allOverridesForWeek || []).filter(o => o.override_date === dateStr);
    return dateHasAnyAvailability(d, groomers, baseSchedules, overridesForDay);
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
    setTimeout(() => goToStep(isFixedPrice ? "guest-details" : "addons", "forward"), 300);
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
  const weekMonth = weekDays[3];

  const getAddonIcon = (iconName: string | null) => {
    if (iconName === "Dog") return Dog;
    return Sparkles;
  };

  if (step === null) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <TailWagSpinner size={48} label="Fetching your options…" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background animate-slide-up flex flex-col">
      {/* Header */}
      <div className="bg-card sticky top-0 z-10 px-4 py-3 flex items-center gap-3 safe-area-top border-b border-border/30">
        <button onClick={goBack} className="flex h-10 w-10 items-center justify-center bg-muted active:scale-95 transition-transform touch-target" style={{ borderRadius: '50%' }}>
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h2 className="text-base font-heading text-foreground">
            {step === "sub-service" ? service : step === "guest-details" ? (isExistingCustomer ? "Confirm & Pay" : "Your Details") : step === "addons" ? "Extras" : selectedSub ?? service}
          </h2>
          <p className="text-xs text-muted-foreground font-body">
            {step === "sub-service" ? "Choose your style" : step === "breed" ? "Select breed" : step === "calendar" ? "Pick a date & time" : step === "addons" ? "Add the finishing touches" : "Almost done!"}
          </p>
        </div>
        {ADJUST_MODE && step === "sub-service" && (
          <button onClick={() => saveMutation.mutate(adjustPositions)} disabled={saveMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground text-sm font-bold font-body active:scale-95 transition-transform" style={{ borderRadius: '30px' }}>
            <Save className="h-4 w-4" /> {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      {/* Paw Progress Bar */}
      <PawProgressBar steps={visibleSteps} currentStep={step} />

      {/* Content with bouncy transitions */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={direction === "forward" ? "enterForward" : "enterBack"}
            animate="center"
            exit={direction === "forward" ? "exitForward" : "exitBack"}
            variants={slideVariants}
            transition={{ type: "spring", stiffness: 300, damping: 25, duration: 0.4 }}
          >
            {/* Sub-service selection */}
            {step === "sub-service" && (
              <div className="px-4 sm:px-6 py-6 sm:py-10">
                {ADJUST_MODE && (
                  <div className="flex items-center gap-2 justify-center mb-4 text-accent text-xs font-mono">
                    <Move className="h-3 w-3" /> Drag images to reposition, then tap Save
                  </div>
                )}
                <div className="text-center mb-6 sm:mb-10">
                  <p className="text-accent font-body text-xs uppercase tracking-[0.25em] mb-2 flex items-center justify-center gap-2">
                    🐾 Grooming 🐾
                  </p>
                  <h2 className="text-xl sm:text-3xl font-heading text-foreground leading-tight">What type of groom?</h2>
                </div>
                <div className="space-y-4 max-w-lg mx-auto">
                  {subServices.map((opt, idx) => {
                    const pos = ADJUST_MODE
                      ? `${adjustPositions[idx].x}% ${adjustPositions[idx].y}%`
                      : getPosition(opt.label, opt.defaultPosition);
                    return (
                      <button key={opt.label} onClick={ADJUST_MODE ? undefined : () => handleSubSelect(opt.label)} className="w-full text-left group transition-all duration-300">
                        <div className="flex overflow-hidden bg-card hover:shadow-lg transition-all duration-300 active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.06)]" style={{ borderRadius: '24px' }}>
                          <div className="relative w-[110px] shrink-0 overflow-hidden">
                            <img src={opt.image} alt={opt.label} className="w-full h-full object-cover" style={{ objectPosition: pos, minHeight: '120px', cursor: ADJUST_MODE ? 'grab' : undefined, touchAction: ADJUST_MODE ? 'none' : undefined }}
                              onPointerDown={ADJUST_MODE ? (e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); dragRef.current = { idx, startX: e.clientX, startY: e.clientY, origX: adjustPositions[idx].x, origY: adjustPositions[idx].y }; } : undefined}
                              onPointerMove={ADJUST_MODE ? (e) => { if (!dragRef.current || dragRef.current.idx !== idx) return; const dx = e.clientX - dragRef.current.startX; const dy = e.clientY - dragRef.current.startY; const newX = Math.max(0, Math.min(100, dragRef.current.origX + dx * 0.15)); const newY = Math.max(0, Math.min(100, dragRef.current.origY + dy * 0.15)); setPositions(prev => { const arr = [...(prev ?? adjustPositions)]; arr[idx] = { x: newX, y: newY }; return arr; }); } : undefined}
                              onPointerUp={ADJUST_MODE ? () => { dragRef.current = null; } : undefined}
                            />
                            <div className="absolute inset-y-0 right-0 w-6 bg-card" style={{ borderRadius: '50% 0 0 50% / 100% 0 0 100%' }} />
                          </div>
                          <div className="flex-1 py-3 pr-4 pl-1 flex flex-col justify-center min-w-0">
                            <h3 className="text-base sm:text-lg font-heading text-foreground mb-0.5 group-hover:text-accent transition-colors">{opt.label}</h3>
                            <p className="text-xs text-muted-foreground font-body leading-relaxed line-clamp-2 mb-1.5">{opt.desc}</p>
                            <span className="text-accent font-body text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                              Select <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Breed selection */}
            {step === "breed" && (
              <div className="h-full">
                {!selectedBreed ? (
                  <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
                    <div className="text-center mb-2">
                      <h2 className="text-2xl font-heading text-foreground">What breed is your dog?</h2>
                      <p className="text-muted-foreground text-sm mt-1">This helps us tailor the groom perfectly</p>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Search breeds…"
                        value={breedSearch}
                        onChange={(e) => setBreedsSearch(e.target.value)}
                        className="h-12 pl-11 rounded-2xl text-base"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5 max-h-[55vh] overflow-y-auto -mx-1 px-1 pb-4">
                      {filteredBreeds?.map((breed) => (
                        <button
                          key={breed.id}
                          onClick={() => handleBreedSelect(breed)}
                          className="w-full flex items-center gap-3 rounded-2xl border border-border/40 bg-card px-4 py-3.5 text-left hover:border-accent/40 hover:shadow-sm transition-all active:scale-[0.98]"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                            <Dog className="h-4 w-4 text-accent" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{breed.name}</p>
                            <p className="text-xs text-muted-foreground">{breed.size_category} · {formatDuration(breed.duration_minutes)}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        </button>
                      ))}
                      {filteredBreeds?.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground text-sm mb-3">No breeds match "{breedSearch}"</p>
                          <Button
                            variant="outline"
            onClick={() => handleBreedSelect({ id: null, name: "Breed Not Listed", size_category: "Medium", duration_minutes: 60, price_bath_brush: 52, price_full_groom: 52 })}
                            className="rounded-xl"
                          >
                            Continue without breed
                          </Button>
                        </div>
                      )}
                      <button
                        onClick={() => handleBreedSelect({ id: null, name: "Breed Not Listed", size_category: "Medium", duration_minutes: 60, price_bath_brush: 52, price_full_groom: 52 })}
                        className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-border/60 px-4 py-3.5 text-left hover:border-accent/40 transition-all"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <Search className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">I don't know / Mixed breed</p>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Age picker after breed selected */
                  <div className="px-5 py-8 space-y-6 max-w-lg mx-auto">
                    <div className="text-center">
                      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mx-auto mb-4">
                        <Dog className="h-7 w-7 text-accent" />
                      </div>
                      <h2 className="text-2xl font-heading text-foreground mb-1">How old is your pup?</h2>
                      <p className="text-muted-foreground font-body text-sm">
                        {selectedBreed.name || "Breed Not Listed"} selected
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/40 bg-card p-5">
                      <Label className="text-sm font-medium mb-3 block">Dog's Age</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Years</Label>
                          <Select value={ageYears} onValueChange={setAgeYears}>
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
                          <Select value={ageMonths} onValueChange={setAgeMonths}>
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

                    <Button onClick={handleBreedAndAgeContinue} className="w-full h-14 text-base rounded-xl" size="lg">
                      Continue
                    </Button>

                    <button
                      onClick={() => { setSelectedBreed(null); setBreedsSearch(""); }}
                      className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Change breed
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Package deal prompt — show once before calendar */}
            {step === "calendar" && !packagePromptDismissed && (
              (() => {
                const isGroomingService = effectiveService === "Grooming" || selectedSub === "Full Groom" || selectedSub === "Bath & Brush";
                const isTeethService = effectiveService === "Ultrasonic Teeth Cleaning";
                if (!isGroomingService && !isTeethService) return null;
                return (
                  <div className="max-w-lg mx-auto px-5 mb-4">
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="bg-accent/10 border border-accent/20 p-4 space-y-3"
                      style={{ borderRadius: '20px' }}
                    >
                      <p className="font-body text-sm text-foreground leading-relaxed">
                        {isTeethService
                          ? "💡 Did you know? Book 5 teeth cleaning sessions for £100 — that's £20 each instead of £25. Contact us to find out more."
                          : "💡 Did you know? Book 4 sessions upfront and save 10% on every visit — or save 15% when you book 6. Contact us to set up a package deal."}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowPackagePopup(true)}
                          className="font-body font-bold text-xs px-4 py-2 bg-accent text-white hover:bg-accent/90 transition-all active:scale-[0.97]"
                          style={{ borderRadius: '30px' }}
                        >
                          Tell Me More
                        </button>
                        <button
                          onClick={() => setPackagePromptDismissed(true)}
                          className="font-body font-semibold text-xs px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 transition-all active:scale-[0.97]"
                          style={{ borderRadius: '30px' }}
                        >
                          Continue with single booking
                        </button>
                      </div>
                    </motion.div>

                    {/* Package info popup */}
                    {showPackagePopup && (
                      <Dialog open={showPackagePopup} onOpenChange={setShowPackagePopup}>
                        <DialogContent className="max-w-md" style={{ borderRadius: '24px' }}>
                          <DialogHeader>
                            <DialogTitle className="font-heading text-lg">📦 Package Deals</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 font-body text-sm text-muted-foreground">
                            {isTeethService ? (
                              <div className="bg-accent/10 p-4 space-y-2" style={{ borderRadius: '16px' }}>
                                <p className="font-bold text-foreground">5 Teeth Cleans for £100</p>
                                <p>Normally £25 per session — pay just £20 each when you pre-book 5 sessions.</p>
                                <p className="font-semibold text-accent">Save £25 in total!</p>
                              </div>
                            ) : (
                              <>
                                <div className="bg-accent/10 p-4 space-y-2" style={{ borderRadius: '16px' }}>
                                  <p className="font-bold text-foreground">4 Sessions — Save 10%</p>
                                  <p>Pre-book 4 grooming sessions. Mix full grooms and bath & brush.</p>
                                </div>
                                <div className="bg-accent/10 p-4 space-y-2" style={{ borderRadius: '16px' }}>
                                  <p className="font-bold text-foreground">6 Sessions — Save 15%</p>
                                  <p>Our best deal! Pre-book 6 sessions and lock in the biggest discount.</p>
                                </div>
                              </>
                            )}
                            <a
                              href="/book-package"
                              className="block w-full font-body font-bold text-sm py-2.5 bg-accent text-white hover:bg-accent/90 transition-all active:scale-[0.97] text-center"
                              style={{ borderRadius: '30px' }}
                            >
                              Book a Package Online
                            </a>
                            <div className="pt-2 border-t border-border/30 space-y-2">
                              <p className="font-semibold text-foreground text-center text-xs text-muted-foreground">Or get in touch:</p>
                              <div className="flex items-center justify-center gap-4 text-xs">
                                <a href="tel:01708606655" className="text-accent font-bold">📞 Call</a>
                                <a href="https://wa.me/447476452782" target="_blank" rel="noopener noreferrer" className="text-accent font-bold">💬 WhatsApp</a>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => { setShowPackagePopup(false); setPackagePromptDismissed(true); }}
                            className="w-full font-body font-bold text-sm py-2.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all active:scale-[0.97] mt-2"
                            style={{ borderRadius: '30px' }}
                          >
                            Continue with single booking
                          </button>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                );
              })()
            )}

            {/* Calendar + time slots */}
            {step === "calendar" && (
              <div className="max-w-lg mx-auto">
                {/* Sticky service summary with puppy pop effect */}
                <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-5 pt-5 pb-3">
                  <div className="rounded-2xl bg-card border border-border/40 p-4 flex items-center gap-3 shadow-sm">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10">
                      <PawPrint className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {puppySwitched ? (
                        <motion.p
                          className="text-sm font-semibold text-accent font-body"
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        >
                          ✨ {serviceType} ✨
                        </motion.p>
                      ) : (
                        <p className="text-sm font-semibold text-foreground font-body">{serviceType}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-body truncate">
                        {isFixedPrice ? `${formatDuration(serviceDuration)}` : `${selectedBreed?.name ?? "Breed Not Listed"}${selectedBreed ? ` · ${formatDuration(selectedBreed.duration_minutes)}` : ""}`}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-accent font-body tabular-nums">
                      {isEstimatePrice ? "~" : ""}£{basePrice}
                    </p>
                  </div>
                  {isEstimatePrice && (
                    <p className="text-[0.65rem] text-muted-foreground mt-2 leading-snug">
                      <span className="font-semibold text-foreground">Estimated price only.</span> Your groomer will confirm the exact breed and final price upon arrival. The final cost may be higher or lower than £52 depending on coat condition and dog size.
                    </p>
                  )}
                </div>

                <div className="px-5 pt-4 pb-8">
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

                  <div className="h-px bg-border/60 my-6" />

                  {selectedDate ? (
                    <div>
                      <h3 className="text-base font-heading text-foreground mb-1">Available times</h3>
                      <p className="text-xs text-muted-foreground font-body mb-4">{formatSelectedDate(selectedDate)}</p>
                      {verifyingSlots ? (
                        <div className="flex justify-center py-8">
                          <TailWagSpinner size={36} label="Checking availability…" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                          {availableTimeSlots.map((time) => {
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
                          {availableTimeSlots.length === 0 && (
                            <div className="col-span-2 py-2">
                              <p className="text-center text-sm text-muted-foreground py-2">
                                We're fully booked on this date for {selectedSub === "Bath & Brush" ? "Bath & Brush" : "Full Groom"} — please choose another day
                              </p>
                              {(altSuggestions.bathBrush || altSuggestions.nailTrim) && (
                                <div className="mt-3 rounded-2xl bg-accent/10 border border-accent/20 p-4 space-y-3">
                                  <p className="text-sm font-body text-foreground leading-relaxed">
                                    ✨ Good news — we still have space on this day for:
                                  </p>
                                  <div className="flex flex-col gap-2">
                                    {altSuggestions.bathBrush && selectedSub !== "Bath & Brush" && (
                                      <button
                                        onClick={switchToBathBrush}
                                        className="w-full text-left rounded-xl bg-card border border-border/60 hover:border-accent/60 hover:shadow-sm px-4 py-3 transition-all active:scale-[0.98]"
                                      >
                                        <p className="font-heading font-semibold text-foreground text-sm">🛁 Bath & Brush</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Luxurious wash, conditioner & full brush-out — switch and pick a time</p>
                                      </button>
                                    )}
                                    {altSuggestions.nailTrim && (
                                      <button
                                        onClick={switchToNailTrim}
                                        className="w-full text-left rounded-xl bg-card border border-border/60 hover:border-accent/60 hover:shadow-sm px-4 py-3 transition-all active:scale-[0.98]"
                                      >
                                        <p className="font-heading font-semibold text-foreground text-sm">✂️ Nail Trim & Filing — £15</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Quick 10-min trim & file — book this instead</p>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
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
              <div className="px-4 sm:px-6 py-8 space-y-6 max-w-lg mx-auto">
                <div className="rounded-2xl bg-muted/50 border border-border/40 p-4">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-heading font-semibold text-foreground">{serviceType}</p>
                    <p className="text-xl font-bold text-accent">{isEstimatePrice ? "~" : ""}£{totalPrice}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isFixedPrice ? "" : `${selectedBreed?.name ?? "Breed Not Listed"} • `}{formatSelectedDate(selectedDate!)} at {selectedTime}
                  </p>
                  {isEstimatePrice && (
                    <p className="text-[0.65rem] text-muted-foreground mt-1.5 leading-snug">
                      Estimated price — final cost confirmed by groomer on arrival.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="font-heading font-semibold text-foreground text-lg mb-1">Add the finishing touches</h3>
                  <p className="text-sm text-muted-foreground mb-4">Make it extra special for your pup</p>
                  <div className="space-y-3">
                    {filteredAddOns?.map((addon) => {
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
                    {(!filteredAddOns || filteredAddOns.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">No extras available right now</p>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <Button onClick={() => goToStep("guest-details", "forward")} className="w-full h-14 text-base rounded-xl" size="lg">
                    Next {isEstimatePrice ? "~" : ""}£{totalPrice}
                  </Button>
                  <button onClick={() => goToStep("guest-details", "forward")} className="w-full text-center text-sm text-muted-foreground mt-3 hover:text-foreground transition-colors">
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
              <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
                <div className="rounded-2xl bg-muted/50 border border-border/40 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="font-heading font-semibold">{serviceType}</p>
                    <p className="text-xl font-bold text-accent">{isEstimatePrice ? "~" : ""}£{totalPrice.toFixed(2)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isFixedPrice ? "" : `${selectedBreed?.name ?? "Breed Not Listed"} • `}{formatSelectedDate(selectedDate!)} at {selectedTime}
                  </p>
                  {isEstimatePrice && (
                    <div className="rounded-xl bg-accent/5 border border-accent/20 p-2.5 mt-2">
                      <p className="text-[0.7rem] text-muted-foreground leading-snug">
                        <span className="font-semibold text-foreground">Estimated price only.</span> Your groomer will confirm the exact breed and final price upon arrival. The final cost may be higher or lower than £52 depending on coat condition and dog size.
                      </p>
                    </div>
                  )}
                  {selectedAddOns.length > 0 && (
                    <p className="text-xs text-muted-foreground">+ {selectedAddOns.map(id => dbAddOns?.find(a => a.id === id)?.name).filter(Boolean).join(", ")}</p>
                  )}
                  {appliedCoupon && couponDiscount > 0 && (
                    <div className="flex justify-between items-center text-sm text-accent">
                      <span>Coupon ({appliedCoupon.code})</span>
                      <span>-£{couponDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-border/40 pt-3 space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{isEstimatePrice ? "Estimated Total" : "Total Price"}</span>
                      <span className="font-semibold text-foreground">{isEstimatePrice ? "~" : ""}£{totalPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">60% Deposit option</span>
                      <span className="font-medium text-muted-foreground">£{depositAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Remaining after service</span>
                      <span className="font-medium text-muted-foreground">£{remainingAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {isNewCustomer && (
                  <div className="text-center">
                    <h2 className="text-xl font-heading text-foreground">Create Your Account</h2>
                    <p className="text-muted-foreground text-sm mt-1">Quick setup, then we'll confirm your booking</p>
                  </div>
                )}

                {isExistingCustomer && (
                  <div className="text-center">
                    <h2 className="text-xl font-heading text-foreground">Confirm & Pay</h2>
                    <p className="text-muted-foreground text-sm mt-1">Booking for <span className="font-semibold">{guestForm.dogName || "your pup"}</span></p>
                  </div>
                )}

                {isExistingCustomer && groomers && groomers.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Choose your groomer</Label>

                    {/* Returning customer suggestion */}
                    {lastGroomerId && lastGroomerName && (
                      <div className="rounded-xl p-4 mb-2" style={{ backgroundColor: "#FFF3E0" }}>
                        <p className="text-sm font-medium text-foreground mb-2">
                          🐾 Last time you were seen by <span className="font-bold">{lastGroomerName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">Would you like to book with them again?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedStaffId(lastGroomerId)}
                            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all duration-200
                              ${selectedStaffId === lastGroomerId
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-card border border-border text-foreground hover:border-primary/30'
                              }`}
                          >
                            Yes, book with {lastGroomerName?.split(" ")[0]}
                          </button>
                          <button
                            onClick={() => setSelectedStaffId(null)}
                            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all duration-200
                              ${selectedStaffId === null
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-card border border-border text-muted-foreground hover:border-primary/30'
                              }`}
                          >
                            No preference
                          </button>
                        </div>
                      </div>
                    )}

                    {/* No preference message */}
                    {selectedStaffId === null && (
                      <div className="rounded-xl bg-muted/50 border border-border/40 p-3 text-center">
                        <p className="text-sm text-muted-foreground">
                          Our next available groomer will be assigned to your booking
                        </p>
                      </div>
                    )}

                    {/* Groomer list (only show if no last groomer, or user wants to browse) */}
                    {!lastGroomerId && (
                      <div className="space-y-2">
                        {groomers.map((g) => {
                          const isSelected = selectedStaffId === g.id;
                          return (
                            <button
                              key={g.id}
                              onClick={() => setSelectedStaffId(g.id)}
                              className={`w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-200
                                ${isSelected
                                  ? 'border-accent bg-accent/10 shadow-sm'
                                  : 'border-border bg-card hover:border-accent/50 hover:shadow-sm'
                                }`}
                            >
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors
                                ${isSelected ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                                {isSelected ? <Check className="h-4 w-4" /> : <span className="text-sm font-semibold">{g.name.charAt(0)}</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground text-sm">{g.name}</p>
                              </div>
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setSelectedStaffId(null)}
                          className={`w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-200
                            ${selectedStaffId === null
                              ? 'border-accent bg-accent/10 shadow-sm'
                              : 'border-border bg-card hover:border-accent/50 hover:shadow-sm'
                            }`}
                        >
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors
                            ${selectedStaffId === null ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {selectedStaffId === null ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-foreground text-sm">No preference</p>
                            <p className="text-xs text-muted-foreground">We'll assign the best available groomer</p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {!isExistingCustomer && (
                    <>
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
                        <div className="relative">
                          <Input
                            value={guestForm.email}
                            onChange={(e) => {
                              setGuestForm({ ...guestForm, email: e.target.value });
                              if (migratedDetected) setMigratedDetected(null);
                            }}
                            onBlur={async () => {
                              const trimmed = guestForm.email.trim().toLowerCase();
                              if (!trimmed || !trimmed.includes("@") || !isNewCustomer) return;
                              setCheckingMigrated(true);
                              try {
                                const { data } = await supabase.functions.invoke("check-migrated-customer", {
                                  body: { email: trimmed, action: "check" },
                                });
                                if (data?.found && data.status === "pending") {
                                  setMigratedDetected({ found: true, name: data.name });
                                } else {
                                  setMigratedDetected(null);
                                }
                              } catch {
                                setMigratedDetected(null);
                              } finally {
                                setCheckingMigrated(false);
                              }
                            }}
                            placeholder="jane@example.com"
                            type="email"
                            className="h-12 rounded-xl"
                          />
                          {checkingMigrated && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                            </div>
                          )}
                        </div>
                        {migratedDetected?.found && (
                          <div className="rounded-xl p-3 mt-1" style={{ backgroundColor: "#FFF3E0" }}>
                            <p className="text-sm text-foreground">
                              👋 We recognise you{migratedDetected.name ? `, ${migratedDetected.name.split(" ")[0]}` : ""}! You've visited us before. Your booking history will be connected to this booking.
                            </p>
                          </div>
                        )}
                        {isNewCustomer && !migratedDetected?.found && (
                          <p className="text-xs italic" style={{ color: "#8B6F5C" }}>
                            Been with us before? Use your same email address and we'll restore your history 🐾
                          </p>
                        )}
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
                        <Label className="text-sm font-medium">Phone <span className="text-destructive">*</span></Label>
                        <Input value={guestForm.phone} onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })} placeholder="07xxx xxxxxx" type="tel" className="h-12 rounded-xl" required />
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Notes for the groomer</Label>
                    <textarea
                      value={guestForm.notes}
                      onChange={(e) => setGuestForm({ ...guestForm, notes: e.target.value })}
                      placeholder="Any special requests, allergies, or things we should know about your dog…"
                      className="flex w-full rounded-xl border border-input bg-background px-3 py-3 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[80px] resize-none"
                      maxLength={500}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">Optional — visible to your groomer on the day</p>
                  </div>

                  {/* Coupon Code */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Have a coupon code?</Label>
                    {appliedCoupon ? (
                      <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
                        <Ticket className="h-4 w-4 text-accent shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            <code className="font-mono">{appliedCoupon.code}</code>
                            {" - "}
                            {appliedCoupon.discount_type === "percentage"
                              ? `${appliedCoupon.discount_value}% off`
                              : `£${appliedCoupon.discount_value.toFixed(2)} off`}
                          </p>
                          <p className="text-xs text-accent">You save £{couponDiscount.toFixed(2)}</p>
                        </div>
                        <button onClick={removeCoupon} className="text-muted-foreground hover:text-foreground p-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={couponCode}
                          onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                          placeholder="Enter code"
                          className="h-12 rounded-xl font-mono uppercase flex-1"
                          maxLength={20}
                          onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                        />
                        <Button
                          variant="outline"
                          onClick={applyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="h-12 rounded-xl px-6"
                        >
                          {couponLoading ? "..." : "Apply"}
                        </Button>
                      </div>
                    )}
                    {couponError && <p className="text-xs text-destructive">{couponError}</p>}
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
                      <button
                        type="button"
                        className="text-accent underline underline-offset-2 hover:text-accent/80"
                        onClick={(e) => { e.stopPropagation(); setTermsOpen(true); }}
                      >
                        Terms & Conditions
                      </button>
                    </span>
                  </label>

                  {/* No Cash Notice */}
                  <div className="rounded-xl border p-4" style={{ backgroundColor: "#FFF3E0", borderColor: "#FF6B35" }}>
                    <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>
                      💳 We no longer accept cash payments. All payments are taken securely by card online. If you have any questions please call us on{" "}
                      <a href="tel:01708606655" className="underline font-bold">01708 606655</a>.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => handlePayment("full")}
                      disabled={!acceptedTerms || isSubmitting}
                      className="w-full h-14 text-base rounded-xl"
                      size="lg"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <TailWagSpinner size={20} /> Processing…
                        </span>
                      ) : (
                        `Pay Full Amount £${totalPrice.toFixed(2)}`
                      )}
                    </Button>
                    <Button
                      onClick={() => handlePayment("deposit")}
                      disabled={!acceptedTerms || isSubmitting}
                      variant="outline"
                      className="w-full h-14 text-base rounded-xl border-2"
                      size="lg"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <TailWagSpinner size={20} /> Processing…
                        </span>
                      ) : (
                        `Pay 60% Deposit £${depositAmount.toFixed(2)}`
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">Remaining balance of £{remainingAmount.toFixed(2)} due after your appointment</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Terms Dialog */}
        <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle className="font-heading">Terms &amp; Conditions</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 min-h-0 pr-4">
              <div
                className="prose prose-sm max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: termsContent ?? "" }}
              />
            </ScrollArea>
            <div className="pt-4 border-t">
              <Button variant="outline" className="w-full" onClick={() => setTermsOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Alert Dialog */}
        <Dialog open={!!alertMessage} onOpenChange={() => setAlertMessage(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading">Notice</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{alertMessage}</p>
            <div className="pt-2">
              <Button className="w-full" onClick={() => setAlertMessage(null)}>OK</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Puppy Special Auto-Switch Popup */}
        <Dialog open={showPuppyPopup} onOpenChange={() => {}}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <PawPrint className="h-5 w-5 text-accent" />
                Puppy Special! 🐾
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Because your dog is 6 months or younger, we've updated your service to our <span className="font-semibold text-foreground">"Puppy Special"</span> to ensure the best care for your pup!
            </p>
            <p className="text-xs text-muted-foreground">
              This service is specially designed for young puppies with a gentle, introductory grooming experience.
            </p>
            <div className="pt-2">
              <Button className="w-full" onClick={() => { setShowPuppyPopup(false); goToStep("calendar", "forward"); }}>
                <Sparkles className="h-4 w-4 mr-2" />
                Got it, continue!
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
