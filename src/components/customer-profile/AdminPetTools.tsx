import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, Send, Scissors, Image, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AdminPetToolsProps {
  petId: string;
  petName: string;
  customerUserId: string;
  customerEmail: string;
  staffId: string | null;
  staffName: string;
}

export function AdminPetTools({ petId, petName, customerUserId, customerEmail, staffId, staffName }: AdminPetToolsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [recommendation, setRecommendation] = useState("");

  // Fetch existing photos for this pet
  const { data: photos = [] } = useQuery({
    queryKey: ["admin-pet-photos", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_photos")
        .select("*")
        .eq("pet_id", petId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!petId,
  });

  // Fetch existing recommendations
  const { data: recommendations = [] } = useQuery({
    queryKey: ["admin-pet-recommendations", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groomer_recommendations")
        .select("*, staff:staff_id(name)")
        .eq("pet_id", petId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!petId,
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${customerUserId}/${petId}/${Date.now()}.${ext}`;

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
          user_id: user.id,
          photo_url: publicUrl,
          uploaded_by_role: "groomer",
          groomer_name: staffName,
        });

      if (insertError) throw insertError;
      toast({ title: `Photo added to ${petName}'s gallery! 📸` });
      queryClient.invalidateQueries({ queryKey: ["admin-pet-photos", petId] });

      // Notify the customer via email
      try {
        await supabase.functions.invoke("send-customer-email", {
          body: {
            customer_email: customerEmail,
            subject: `New grooming photo of ${petName}! 📸`,
            body: `Hi there!\n\n${staffName} has just uploaded a new photo of ${petName} to their gallery.\n\nLog in to your account to see the latest pictures:\nhttps://fluff-scruff-studio.lovable.app/my-pets\n\nFluff & Scruff Studio 🐾`,
          },
        });
      } catch (emailErr) {
        console.error("Failed to send photo notification email:", emailErr);
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deletePhoto = async (photoId: string) => {
    const { error } = await supabase.from("pet_photos").delete().eq("id", photoId);
    if (error) {
      toast({ title: "Failed to delete", variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin-pet-photos", petId] });
    }
  };

  const addRecommendationMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!staffId) throw new Error("No staff ID");
      const { error } = await supabase.from("groomer_recommendations").insert({
        pet_id: petId,
        staff_id: staffId,
        recommendation: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setRecommendation("");
      queryClient.invalidateQueries({ queryKey: ["admin-pet-recommendations", petId] });
      toast({ title: "Recommendation saved ✨" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 mt-3">
      {/* Photo Uploader */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4 text-accent" /> Grooming Photo Drop
            </h4>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <div className="animate-spin h-3 w-3 border-2 border-accent border-t-transparent rounded-full" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              Upload After Photo
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.slice(0, 8).map((photo: any) => (
                <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden">
                  <img src={photo.photo_url} alt="Pet" className="w-full h-full object-cover" />
                  <button
                    onClick={() => deletePhoto(photo.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  {photo.uploaded_by_role === "groomer" && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                      <span className="text-[8px] text-white">by {photo.groomer_name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {photos.length === 0 && (
            <div className="text-center py-4 border border-dashed border-border rounded-lg">
              <Image className="h-8 w-8 text-muted-foreground/30 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">No photos yet. Upload an 'After Groom' photo!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendation Box */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Scissors className="h-4 w-4 text-accent" /> Groomer's Corner Note
          </h4>
          <div className="flex gap-2">
            <Textarea
              placeholder={`Write personalised advice for ${petName}'s owner...`}
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="min-h-[60px] text-sm"
            />
            <Button
              size="icon"
              className="shrink-0 self-end"
              disabled={!recommendation.trim() || addRecommendationMutation.isPending || !staffId}
              onClick={() => addRecommendationMutation.mutate(recommendation.trim())}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {recommendations.length > 0 && (
            <div className="space-y-2">
              {recommendations.map((rec: any) => (
                <div key={rec.id} className="p-3 rounded-lg border bg-accent/5">
                  <p className="text-sm">{rec.recommendation}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    — {(rec.staff as any)?.name} • {format(new Date(rec.created_at), "dd MMM yyyy")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
