import { Dog, Award, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PetHeroCardProps {
  petName: string;
  breedName?: string | null;
  ageYears?: number | null;
  ageMonths?: number | null;
  profilePhoto?: string | null;
  totalBookings: number;
  onUploadPhoto?: () => void;
}

export function PetHeroCard({ petName, breedName, ageYears, ageMonths, profilePhoto, totalBookings, onUploadPhoto }: PetHeroCardProps) {
  const ageText = ageYears != null ? `${ageYears}y ${ageMonths || 0}m` : null;
  const isTopDog = totalBookings >= 5;

  return (
    <div className="flex flex-col items-center text-center py-6">
      <div className="relative group">
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-accent/20 via-primary/10 to-accent/20 p-1 shadow-xl shadow-accent/10">
          <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
            {profilePhoto ? (
              <img src={profilePhoto} alt={petName} className="w-full h-full object-cover" />
            ) : (
              <Dog className="h-12 w-12 text-accent/60" />
            )}
          </div>
        </div>
        {onUploadPhoto && (
          <button
            onClick={onUploadPhoto}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
          >
            <Camera className="h-4 w-4" />
          </button>
        )}
      </div>

      <h2 className="text-2xl font-heading font-bold text-foreground mt-3">{petName}</h2>
      
      <div className="flex items-center gap-2 mt-1.5">
        {breedName && <span className="text-sm text-muted-foreground">{breedName}</span>}
        {breedName && ageText && <span className="text-muted-foreground/40">•</span>}
        {ageText && <span className="text-sm text-muted-foreground">{ageText}</span>}
      </div>

      {isTopDog && (
        <Badge className="mt-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-sm gap-1.5 px-3 py-1">
          <Award className="h-3.5 w-3.5" /> Top Dog
        </Badge>
      )}
    </div>
  );
}
