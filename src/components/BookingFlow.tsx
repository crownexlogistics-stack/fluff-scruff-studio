import { useState, useCallback, useRef } from "react";
import { ArrowLeft, Search, Dog, ChevronRight, PawPrint, Save, Move } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import serviceBathBrush from "@/assets/service-bath-brush.jpg";
import serviceFullGroomSub from "@/assets/service-full-groom-sub.jpg";

// Toggle this to reposition images, then tap Save
const ADJUST_MODE = true;

type Step = "sub-service" | "breed" | null;

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

function parsePosition(pos: string) {
  const parts = pos.split(" ");
  return { x: parseFloat(parts[0]), y: parseFloat(parts[1]) };
}

export function BookingFlow({ service, onClose }: BookingFlowProps) {
  const [step, setStep] = useState<Step>(service === "Grooming" ? "sub-service" : "breed");
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [breedSearch, setBreedsSearch] = useState("");
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

  // Compute positions: DB values > defaults
  const getPosition = (label: string, defaultPos: string) => {
    if (savedPositions && savedPositions[label]) return savedPositions[label];
    return defaultPos;
  };

  // Adjust mode state
  const [positions, setPositions] = useState<{ x: number; y: number }[] | null>(null);
  const dragRef = useRef<{ idx: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Initialize adjust positions from saved values
  const adjustPositions = positions ?? subServices.map((s) => {
    const pos = getPosition(s.label, s.defaultPosition);
    return parsePosition(pos);
  });

  // Save mutation
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

  const filteredBreeds = breeds?.filter((b) =>
    b.name.toLowerCase().includes(breedSearch.toLowerCase())
  );

  const handleSubSelect = (sub: string) => {
    setSelectedSub(sub);
    setStep("breed");
  };

  const handleBreedSelect = (breedName: string) => {
    onClose();
  };

  const goBack = useCallback(() => {
    if (step === "breed" && service === "Grooming") {
      setStep("sub-service");
      setSelectedSub(null);
    } else {
      onClose();
    }
  }, [step, service, onClose]);

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
            {step === "sub-service" ? service : selectedSub ?? service}
          </h2>
          <p className="text-xs text-muted-foreground">
            {step === "sub-service" ? "Choose your style" : "Select breed"}
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
        {step === "sub-service" && (
          <div className="px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
            {ADJUST_MODE && (
              <div className="flex items-center gap-2 justify-center mb-4 text-accent text-xs font-mono">
                <Move className="h-3 w-3" /> Drag images to reposition, then tap Save
              </div>
            )}

            {/* Section header */}
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

            {/* Cards */}
            <div className="grid sm:grid-cols-2 gap-5 sm:gap-8 max-w-4xl mx-auto">
              {subServices.map((opt, idx) => {
                const pos = ADJUST_MODE
                  ? `${adjustPositions[idx].x}% ${adjustPositions[idx].y}%`
                  : getPosition(opt.label, opt.defaultPosition);

                return (
                  <button
                    key={opt.label}
                    onClick={ADJUST_MODE ? undefined : () => handleSubSelect(opt.label)}
                    className="text-left group transition-colors duration-300"
                  >
                    <div className="relative bg-card rounded-3xl overflow-hidden border border-border/40 transition-[box-shadow,border-color,transform] duration-500 hover:shadow-xl hover:shadow-black/[0.06] hover:border-border/60 hover:-translate-y-1 active:scale-[0.98] shadow-md shadow-black/[0.03]">
                      {/* Image */}
                      <div className="relative overflow-hidden bg-card">
                        <img
                          src={opt.image}
                          alt={opt.label}
                          className="w-full aspect-[4/3] object-cover block"
                          style={{
                            objectPosition: pos,
                            maxHeight: '220px',
                            cursor: ADJUST_MODE ? 'grab' : undefined,
                            touchAction: ADJUST_MODE ? 'none' : undefined,
                          }}
                          onPointerDown={ADJUST_MODE ? (e) => {
                            (e.target as HTMLElement).setPointerCapture(e.pointerId);
                            dragRef.current = { idx, startX: e.clientX, startY: e.clientY, origX: adjustPositions[idx].x, origY: adjustPositions[idx].y };
                          } : undefined}
                          onPointerMove={ADJUST_MODE ? (e) => {
                            if (!dragRef.current || dragRef.current.idx !== idx) return;
                            const { startX, startY, origX, origY } = dragRef.current;
                            const dx = (e.clientX - startX) * -0.15;
                            const dy = (e.clientY - startY) * -0.15;
                            setPositions(prev => {
                              const base = prev ?? subServices.map((s) => parsePosition(getPosition(s.label, s.defaultPosition)));
                              return base.map((p, i) => i === idx ? { x: Math.min(100, Math.max(0, origX + dx)), y: Math.min(100, Math.max(0, origY + dy)) } : p);
                            });
                          } : undefined}
                          onPointerUp={ADJUST_MODE ? () => { dragRef.current = null; } : undefined}
                        />
                        {ADJUST_MODE && (
                          <div className="absolute top-2 left-2 bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full font-mono z-20">
                            {adjustPositions[idx].x.toFixed(0)}% {adjustPositions[idx].y.toFixed(0)}%
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-24 sm:h-32 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none" />
                      </div>

                      {/* Text */}
                      <div className="relative z-10 -mt-px bg-card px-5 pb-5 pt-1.5 sm:px-8 sm:pb-8 sm:pt-2">
                        <h3 className="text-xl sm:text-2xl font-heading text-foreground mb-1.5 sm:mb-2 group-hover:text-accent transition-colors duration-300">
                          {opt.label}
                        </h3>
                        <p className="text-muted-foreground font-body text-sm leading-relaxed mb-3 sm:mb-4">
                          {opt.desc}
                        </p>
                        <div className="flex items-center gap-2 text-charcoal font-body text-sm font-semibold group-hover:gap-3 transition-all duration-300">
                          Book this treat
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "breed" && (
          <div className="px-4 py-6 space-y-4 animate-fade-in">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search breeds…"
                value={breedSearch}
                onChange={(e) => setBreedsSearch(e.target.value)}
                className="pl-12 h-14 rounded-xl text-base"
              />
            </div>

            <div className="space-y-2">
              {filteredBreeds?.map((breed) => (
                <button
                  key={breed.id}
                  onClick={() => handleBreedSelect(breed.name)}
                  className="w-full touch-target flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all active:scale-[0.97] hover:border-accent"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    <Dog className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium font-body">{breed.name}</h3>
                    <p className="text-xs text-muted-foreground">{breed.size_category}</p>
                  </div>
                </button>
              ))}
              {filteredBreeds?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No breeds found</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
