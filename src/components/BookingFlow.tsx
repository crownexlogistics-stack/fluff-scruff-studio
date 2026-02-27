import { useState, useCallback } from "react";
import { ArrowLeft, Scissors, Bath, Search, Dog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

type Step = "sub-service" | "breed" | null;

interface BookingFlowProps {
  service: string;
  onClose: () => void;
}

export function BookingFlow({ service, onClose }: BookingFlowProps) {
  const [step, setStep] = useState<Step>(service === "Grooming" ? "sub-service" : "breed");
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [breedSearch, setBreedsSearch] = useState("");

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
    // For now, just close. This can be extended to continue booking.
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
        <div>
          <h2 className="text-lg font-semibold font-body">
            {step === "sub-service" ? service : selectedSub ?? service}
          </h2>
          <p className="text-xs text-muted-foreground">
            {step === "sub-service" ? "Choose your style" : "Select breed"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {step === "sub-service" && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-muted-foreground text-sm mb-2">What type of groom?</p>
            {[
              { label: "Full Groom", desc: "Complete wash, dry, cut & style", icon: Scissors },
              { label: "Bath & Brush", desc: "Wash, condition & thorough brush out", icon: Bath },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleSubSelect(opt.label)}
                className="w-full touch-target flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all active:scale-[0.97] hover:border-accent hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gradient-rose text-accent-foreground">
                  <opt.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold font-body">{opt.label}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === "breed" && (
          <div className="space-y-4 animate-fade-in">
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
