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

export function BookingFlow({ service, onClose, preselectedBreedId, preselectedPetName, isNewCustomer, dogAgeYears, dogAgeMonths }: BookingFlowProps) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const utmCampaignId = searchParams.get("utm_campaign") || null;
  const isExistingCustomer = !isNewCustomer && !!user;

  const [step, setStep] = useState<Step>(null);
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

  // Track if we auto-switched to Puppy Special
  const effectiveService = puppySwitched ? "Puppy Special" : service;

  // Fetch matching service record from DB (for fixed-price services)
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
  // Only Grooming and Puppy Special need breed selection
  const needsBreed = effectiveService === "Grooming" || effectiveService === "Puppy Special";

  // If breed is preselected, skip to sub-service (for grooming) or calendar
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

  // Pre-fill form for existing (logged-in) customers
  useEffect(() => {
    if (isExistingCustomer && user) {
      const meta = user.user_metadata;
      setGuestForm(prev => ({
        ...prev,
        name: meta?.full_name || prev.name,
        email: user.email || prev.email,
        phone: meta?.phone || prev.phone,
        dogName: preselectedPetName || prev.dogName,
      }));
    }
  }, [isExistingCustomer, user, preselectedPetName]);

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

  // Fetch groomers (staff with role containing "groomer" or similar)
  const { data: groomers } = useQuery({
    queryKey: ["groomers-for-booking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, name, role")
        .ilike("role", "%groomer%")
        .order("name");
      if (error) throw error;
      return data as Groomer[];
    },
  });

  // Fetch base working hours for all groomers
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

  // Compute the visible week range for fetching overrides
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

  // Fetch ALL schedule overrides for the visible WEEK range (blocks + overtime)
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

  // Filter overrides for the selected date (for slot generation)
  const allOverridesForDate = useMemo(() => {
    if (!selectedDate || !allOverridesForWeek) return [];
    return allOverridesForWeek.filter(o => o.override_date === selectedDate);
  }, [selectedDate, allOverridesForWeek]);

  // For returning customers: find the last groomer who served them
  const { data: lastGroomerBooking } = useQuery({
    queryKey: ["last-groomer", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("bookings")
        .select("staff_id")
        .eq("customer_email", user.email)
        .not("staff_id", "is", null)
        .order("booking_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isExistingCustomer && !!user?.email,
  });

  const lastGroomerId = lastGroomerBooking?.staff_id ?? null;

  // Fetch add-ons from DB
  const { data: dbAddOns } = useQuery({
    queryKey: ["add_ons_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("add_ons").select("*").eq("is_active", true).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Fetch add-on → service links
  const { data: addOnServiceLinks } = useQuery({
    queryKey: ["add_on_services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("add_on_services").select("add_on_id, service_id");
      if (error) throw error;
      return data;
    },
  });

  // Resolve current service ID for filtering add-ons
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

  // Filter add-ons: only show those linked to the current service (or all if no links exist)
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

      // Check per-customer usage if email provided
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
    setStep("breed");
  };

  const handleBreedSelect = (breed: any | null) => {
    setSelectedBreed(breed);
    setSelectedAddOns([]);
    setSelectedDate(null);
    setSelectedTime(null);
    // If age is already provided (existing customer), skip age step
    if (dogAgeYears != null || dogAgeMonths != null) {
      setStep("calendar");
    }
    // Otherwise stay on breed step to collect age (UI will show age picker when breed is selected)
  };

  const handleBreedAndAgeContinue = () => {
    const years = parseInt(ageYears, 10);
    const months = parseInt(ageMonths, 10);
    const isPuppy = years === 0 && months <= 6;

    // Auto-switch to Puppy Special if dog is 6 months or younger
    // and the current service is Full Groom or Bath & Brush
    if (isPuppy && (selectedSub === "Full Groom" || selectedSub === "Bath & Brush" || service === "Grooming")) {
      setPuppySwitched(true);
      setSelectedSub(null); // Clear sub-service since Puppy Special is its own service
      setShowPuppyPopup(true);
      // Don't advance step yet — popup will handle it
      return;
    }

    setStep("calendar");
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOns(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const handlePayment = (type: "deposit" | "full") => {
    setPaymentType(type);
    handleGuestSubmit(type);
  };

  const handleGuestSubmit = async (selectedPaymentType: "deposit" | "full" = "full") => {
    if (!guestForm.name.trim() || !guestForm.dogName.trim()) {
      setAlertMessage("Please fill in your name and dog's name");
      return;
    }
    if (!acceptedTerms) {
      setAlertMessage("Please accept the Terms & Conditions to continue");
      return;
    }

    setIsSubmitting(true);

    // New customer: create account first
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

      // If user already exists, try signing in instead
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
          // Signed in successfully — continue with booking
        } else {
          setAlertMessage(signUpError.message);
          setIsSubmitting(false);
          return;
        }
      } else {
        // New account created — sign in immediately
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: guestForm.email,
          password: guestForm.password,
        });

        if (signInError) {
          // Don't block — continue without session, booking insert allows anyone
          console.warn("Auto sign-in failed:", signInError.message);
        }

        // Save pet to customer_pets if we have a user
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

    // Final real-time validation: re-check availability at submission time
    // This catches cases where the schedule changed while the customer was filling in details
    let assignedStaffId: string | null = null;
    if (isExistingCustomer && selectedStaffId) {
      assignedStaffId = selectedStaffId;
    } else if (groomers && groomers.length > 0 && baseSchedules) {
      // Re-fetch fresh data for final validation
      const [freshBookingsRes, freshOverridesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("booking_time, staff_id, services(duration_minutes), breeds(duration_minutes)")
          .eq("booking_date", selectedDate!)
          .not("status", "in", "(Cancelled,No Show,Refunded)"),
        supabase
          .from("staff_schedule_overrides")
          .select("staff_id, override_date, start_time, end_time, is_working")
          .eq("override_date", selectedDate!),
      ]);

      const freshBookings = (freshBookingsRes.data || []) as ExistingBooking[];
      const freshOverrides = (freshOverridesRes.data || []) as ScheduleOverride[];
      const bookingDate = new Date(selectedDate! + "T00:00:00");

      const freeGroomer = findFreeGroomer(
        selectedTime!,
        serviceDuration,
        bookingDate,
        groomers,
        baseSchedules,
        freshOverrides,
        freshBookings
      );

      if (!freeGroomer) {
        setAlertMessage("This slot is no longer available. The groomer's schedule changed while you were booking. Please choose another time.");
        setIsSubmitting(false);
        return;
      }

      assignedStaffId = freeGroomer.id;
    }

    const { data: insertedBooking, error } = await supabase.from("bookings").insert({
      customer_name: guestForm.name,
      customer_phone: guestForm.phone || null,
      customer_email: guestForm.email || null,
      dog_name: guestForm.dogName,
      breed_id: selectedBreed?.id ?? null,
      service_id: dbService?.id ?? null,
      staff_id: assignedStaffId,
      booking_date: selectedDate!,
      booking_time: selectedTime!,
      total_price: totalPrice,
      deposit_paid: 0,
      notes: guestForm.notes.trim() || null,
      status: "Pending",
      campaign_id: utmCampaignId,
    }).select("id").single();

    if (error) {
      setAlertMessage("Failed to book — please try again");
      setIsSubmitting(false);
      return;
    }

    // Track coupon usage
    if (appliedCoupon && insertedBooking?.id) {
      try {
        await supabase.from("coupon_usages").insert({
          coupon_id: appliedCoupon.id,
          customer_email: (guestForm.email || "guest").toLowerCase(),
          booking_id: insertedBooking.id,
        });
        // Increment times_used
        const { data: couponData } = await supabase.from("coupons").select("times_used").eq("id", appliedCoupon.id).single();
        if (couponData) {
          await supabase.from("coupons").update({ times_used: couponData.times_used + 1 }).eq("id", appliedCoupon.id);
        }
      } catch { /* ignore */ }
    }

    // Redirect to Stripe for payment FIRST — do NOT confirm or email until payment succeeds
    try {
      if (totalPrice <= 0) {
        throw new Error("Total price must be greater than £0");
      }

      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-deposit-checkout", {
        body: {
          customer_name: guestForm.name,
          customer_email: guestForm.email || null,
          dog_name: guestForm.dogName,
          service_name: serviceType,
          total_price: totalPrice,
          booking_id: insertedBooking.id,
          payment_type: selectedPaymentType,
        },
      });

      if (checkoutError || !checkoutData?.url) {
        throw new Error(checkoutData?.error || "Failed to create payment session");
      }

      // Update booking with expected payment amount
      const paidAmount = selectedPaymentType === "full" ? totalPrice : depositAmount;
      await supabase.from("bookings").update({ deposit_paid: paidAmount }).eq("id", insertedBooking.id);

      window.location.href = checkoutData.url;
      return;
    } catch (stripeErr: any) {
      console.error("Stripe checkout error:", stripeErr);
      // Delete the pending booking since payment failed
      await supabase.from("bookings").delete().eq("id", insertedBooking.id);
      setAlertMessage("Payment could not be processed. Please try again.");
      setIsSubmitting(false);
      return; // Stay on the page — do NOT close
    }
  };

  const goBack = useCallback(() => {
    if (step === "guest-details" && isFixedPrice) {
      setStep("calendar");
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedStaffId(null);
    } else if (step === "guest-details") {
      setStep("addons");
      setSelectedAddOns([]);
    } else if (step === "addons") {
      setStep("calendar");
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedStaffId(null);
    } else if (step === "calendar" && needsBreed) {
      // Always go back to age picker (breed still selected) or breed search
      if (dogAgeYears != null || dogAgeMonths != null) {
        setStep("breed");
        setSelectedBreed(null);
        setBreedsSearch("");
      } else {
        setStep("breed");
        // Keep selectedBreed to show age picker, but reset age
        setAgeYears("0");
        setAgeMonths("0");
      }
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedStaffId(null);
      // If we auto-switched to Puppy Special, undo it
      if (puppySwitched) {
        setPuppySwitched(false);
      }
    } else if (step === "breed" && selectedBreed) {
      // From age picker, go back to breed search
      setSelectedBreed(null);
      setBreedsSearch("");
      setAgeYears("0");
      setAgeMonths("0");
    } else if (step === "breed" && (service === "Grooming" || effectiveService === "Grooming")) {
      setStep("sub-service");
      setSelectedSub(null);
      setPuppySwitched(false);
    } else {
      onClose();
    }
  }, [step, service, effectiveService, onClose, needsBreed, dogAgeYears, dogAgeMonths, selectedBreed, puppySwitched, isFixedPrice]);

  // Fetch existing appointments for selected date to check availability
  const { data: existingBookingsForDate } = useQuery({
    queryKey: ["bookings-for-date", selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("booking_time, staff_id, status, services(duration_minutes), breeds(duration_minutes)")
        .eq("booking_date", selectedDate)
        .not("status", "in", "(Cancelled,No Show,Refunded)");
      if (error) throw error;
      return (data || []) as ExistingBooking[];
    },
    enabled: !!selectedDate,
  });

  // Generate available time slots using the availability engine
  const availableTimeSlots = useMemo(() => {
    if (!selectedDate || !groomers?.length || !baseSchedules) return [];
    const date = new Date(selectedDate + "T00:00:00");
    return generateAvailableSlots(
      date,
      serviceDuration,
      groomers,
      baseSchedules,
      allOverridesForDate || [],
      existingBookingsForDate || [],
      30
    );
  }, [selectedDate, groomers, baseSchedules, allOverridesForDate, existingBookingsForDate, serviceDuration]);

  // Week-strip: check if a date is selectable (not in the past, has at least one groomer working)
  const isDateSelectableDate = (d: Date) => {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (d <= todayStart) return false;
    if (!groomers?.length || !baseSchedules) return false;
    // Filter overrides for this specific date
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
            {step === "sub-service" ? service : step === "guest-details" ? (isExistingCustomer ? "Confirm & Pay" : "Your Details") : step === "addons" ? "Extras" : selectedSub ?? service}
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
            {!selectedBreed ? (
              <>
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
              </>
            ) : (
              /* Age picker after breed selected */
              <div className="px-5 py-8 space-y-6 max-w-lg mx-auto animate-fade-in">
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
                      <p className="col-span-2 text-center text-sm text-muted-foreground py-4">No available slots on this date. Please try another day.</p>
                    )}
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
            <div className="rounded-2xl bg-muted/50 border border-border/40 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="font-heading font-semibold">{serviceType}</p>
                <p className="text-xl font-bold text-accent">£{totalPrice.toFixed(2)}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {isFixedPrice ? "" : `${selectedBreed?.name ?? "Breed Not Listed"} • `}{formatSelectedDate(selectedDate!)} at {selectedTime}
              </p>
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
                  <span className="text-muted-foreground">Total Price</span>
                  <span className="font-semibold text-foreground">£{totalPrice.toFixed(2)}</span>
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

            {/* Groomer picker for returning customers */}
            {isExistingCustomer && groomers && groomers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Choose your groomer</Label>
                <div className="space-y-2">
                  {groomers.map((g) => {
                    const isLast = g.id === lastGroomerId;
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
                          {isLast && (
                            <p className="text-xs text-accent font-medium">✨ Groomed your dog last time</p>
                          )}
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
              </div>
            )}

            <div className="space-y-4">
              {/* Only show personal details fields for new customers */}
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

            <div className="space-y-3">
              <Button
                onClick={() => handlePayment("full")}
                disabled={!acceptedTerms || isSubmitting}
                className="w-full h-14 text-base rounded-xl"
                size="lg"
              >
                {isSubmitting ? "Processing..." : `Pay Full Amount`} £{totalPrice.toFixed(2)}
              </Button>
              <Button
                onClick={() => handlePayment("deposit")}
                disabled={!acceptedTerms || isSubmitting}
                variant="outline"
                className="w-full h-14 text-base rounded-xl border-2"
                size="lg"
              >
                {isSubmitting ? "Processing..." : `Pay 60% Deposit`} £{depositAmount.toFixed(2)}
              </Button>
              <p className="text-xs text-center text-muted-foreground">Remaining balance of £{remainingAmount.toFixed(2)} due after your appointment</p>
            </div>
            </div>
          </div>
        )}

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

        {/* Alert Dialog - centered with X close */}
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
              <Button className="w-full" onClick={() => { setShowPuppyPopup(false); setStep("calendar"); }}>
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
