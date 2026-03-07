import { Dog } from "lucide-react";

interface Pet {
  id: string;
  pet_name: string;
  breed_name?: string | null;
  profile_photo?: string | null;
}

interface PetStoryIconsProps {
  pets: Pet[];
  selectedPetId: string | null;
  onSelect: (petId: string) => void;
  onAddPet: () => void;
}

export function PetStoryIcons({ pets, selectedPetId, onSelect, onAddPet }: PetStoryIconsProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 px-1 scrollbar-hide">
      {pets.map((pet) => {
        const isActive = selectedPetId === pet.id;
        return (
          <button
            key={pet.id}
            onClick={() => onSelect(pet.id)}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div className={`relative w-[72px] h-[72px] rounded-full p-[3px] transition-all duration-200 ${
              isActive
                ? "shadow-lg shadow-accent/20"
                : "bg-border group-hover:bg-accent/30"
            }`}
              style={isActive ? { background: 'linear-gradient(135deg, hsl(18 100% 60%), hsl(43 100% 50%))' } : {}}
            >
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
                {pet.profile_photo ? (
                  <img src={pet.profile_photo} alt={pet.pet_name} className="w-full h-full object-cover" />
                ) : (
                  <Dog className={`h-7 w-7 ${isActive ? "text-accent" : "text-muted-foreground"}`} />
                )}
              </div>
            </div>
            <span className={`text-[12px] font-bold font-body truncate max-w-[72px] ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`}>
              {pet.pet_name}
            </span>
          </button>
        );
      })}
      <button
        onClick={onAddPet}
        className="flex flex-col items-center gap-1.5 shrink-0 group"
      >
        <div className="w-[72px] h-[72px] rounded-full border-2 border-dashed border-gold bg-background flex items-center justify-center transition-colors group-hover:border-accent">
          <span className="text-xl text-gold group-hover:text-accent transition-colors">+</span>
        </div>
        <span className="text-[12px] font-body text-muted-foreground">Add Pet</span>
      </button>
    </div>
  );
}
