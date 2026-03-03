import { Plus, Dog } from "lucide-react";

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
                ? "bg-gradient-to-br from-accent via-primary to-accent shadow-lg shadow-accent/20"
                : "bg-gradient-to-br from-border to-muted group-hover:from-accent/50 group-hover:to-primary/50"
            }`}>
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
                {pet.profile_photo ? (
                  <img src={pet.profile_photo} alt={pet.pet_name} className="w-full h-full object-cover" />
                ) : (
                  <Dog className={`h-7 w-7 ${isActive ? "text-accent" : "text-muted-foreground"}`} />
                )}
              </div>
            </div>
            <span className={`text-[11px] font-medium truncate max-w-[72px] ${
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
        <div className="w-[72px] h-[72px] rounded-full border-2 border-dashed border-border group-hover:border-accent flex items-center justify-center transition-colors">
          <Plus className="h-6 w-6 text-muted-foreground group-hover:text-accent transition-colors" />
        </div>
        <span className="text-[11px] text-muted-foreground">Add Pet</span>
      </button>
    </div>
  );
}
