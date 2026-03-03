import { Camera } from "lucide-react";

interface Photo {
  id: string;
  photo_url: string;
  caption?: string | null;
  groomer_name?: string | null;
  uploaded_by_role: string;
  created_at: string;
}

interface PicturesTabProps {
  photos: Photo[];
  petName: string;
}

export function PicturesTab({ photos, petName }: PicturesTabProps) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-10">
        <Camera className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No photos of {petName} yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Photos from grooms will appear here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
        <Camera className="h-4 w-4 text-accent" />
        {petName}'s Gallery
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square border border-border/30">
            <img
              src={photo.photo_url}
              alt={photo.caption || petName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {(photo.caption || photo.groomer_name) && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {photo.caption && <p className="text-white text-xs">{photo.caption}</p>}
                {photo.groomer_name && <p className="text-white/70 text-[10px]">by {photo.groomer_name}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
