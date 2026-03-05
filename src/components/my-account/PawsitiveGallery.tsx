import { useState, useRef } from "react";
import { Plus, Camera, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Photo {
  id: string;
  photo_url: string;
  caption: string | null;
  uploaded_by_role: string;
  groomer_name: string | null;
  created_at: string;
}

interface PawsitiveGalleryProps {
  petId: string;
  petName: string;
  photos: Photo[];
  userId: string;
  onRefresh: () => void;
}

export function PawsitiveGallery({ petId, petName, photos, userId, onRefresh }: PawsitiveGalleryProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${petId}/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("pet-photos")
        .upload(path, file);
      
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("pet-photos")
        .getPublicUrl(path);

      const { error: insertError } = await supabase
        .from("pet_photos")
        .insert({
          pet_id: petId,
          user_id: userId,
          photo_url: publicUrl,
          uploaded_by_role: "customer",
        });

      if (insertError) throw insertError;
      toast({ title: "Photo uploaded! 📸" });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deletePhoto = async (photo: Photo) => {
    const { error } = await supabase.from("pet_photos").delete().eq("id", photo.id);
    if (error) {
      toast({ title: "Failed to delete", variant: "destructive" });
    } else {
      setViewPhoto(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          {petName}'s Pawsitive Gallery
        </h3>
        <span className="text-xs text-muted-foreground">{photos.length} photo{photos.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 rounded-xl overflow-hidden">
        {/* Upload tile */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="aspect-square bg-muted/50 border-2 border-dashed border-border hover:border-accent flex flex-col items-center justify-center gap-1 transition-colors rounded-lg"
        >
          {uploading ? (
            <div className="animate-spin h-5 w-5 border-2 border-accent border-t-transparent rounded-full" />
          ) : (
            <>
              <Plus className="h-5 w-5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Add Photo</span>
            </>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

        {/* Photo grid */}
        {photos.slice(0, 8).map((photo) => (
          <button
            key={photo.id}
            onClick={() => setViewPhoto(photo)}
            className="aspect-square relative overflow-hidden rounded-lg group"
          >
            <img
              src={photo.photo_url}
              alt={photo.caption || "Pet photo"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            {photo.uploaded_by_role === "groomer" && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                <span className="text-[9px] text-white font-medium flex items-center gap-0.5">
                  <Camera className="h-2.5 w-2.5" /> {photo.groomer_name ? `by ${photo.groomer_name}` : "Groomer photo"}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Full view dialog */}
      <Dialog open={!!viewPhoto} onOpenChange={(open) => !open && setViewPhoto(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {viewPhoto && (
            <div>
              <img
                src={viewPhoto.photo_url}
                alt={viewPhoto.caption || "Pet photo"}
                className="w-full max-h-[70vh] object-contain bg-black"
              />
              <div className="p-4 space-y-2">
                {viewPhoto.uploaded_by_role === "groomer" && (
                  <Badge variant="secondary" className="gap-1 bg-accent/10 text-accent border-accent/20">
                    <Camera className="h-3 w-3" /> {viewPhoto.groomer_name ? `Photo by ${viewPhoto.groomer_name}` : "Groomer photo"}
                  </Badge>
                )}
                {viewPhoto.caption && <p className="text-sm">{viewPhoto.caption}</p>}
                <button
                  onClick={() => deletePhoto(viewPhoto)}
                  className="text-xs text-destructive hover:underline"
                >
                  Delete photo
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
