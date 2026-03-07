import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useState } from "react";

interface BreedAdviceFeedProps {
  breedId: string | null;
  breedName: string | null;
  userId: string;
}

interface AdviceTopic {
  icon: string;
  title: string;
  content: string;
}

export function BreedAdviceFeed({ breedId, breedName, userId }: BreedAdviceFeedProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: topics = [], isLoading, isFetching } = useQuery({
    queryKey: ["breed-advice", breedId, refreshKey],
    queryFn: async () => {
      if (!breedId || !breedName) return [];
      const { data, error } = await supabase.functions.invoke("generate-breed-advice", {
        body: { breed_id: breedId, breed_name: breedName, force_refresh: refreshKey > 0 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.topics || []) as AdviceTopic[];
    },
    enabled: !!breedId && !!breedName,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const { data: savedTitles = [] } = useQuery({
    queryKey: ["saved-advice-titles", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("saved_advice")
        .select("title")
        .eq("user_id", userId);
      return (data || []).map((r: any) => r.title);
    },
    enabled: !!userId,
  });

  const saveMutation = useMutation({
    mutationFn: async (topic: AdviceTopic) => {
      const { error } = await supabase.from("saved_advice").insert({
        user_id: userId,
        breed_name: breedName || "Unknown",
        title: topic.title,
        content: topic.content,
        icon: topic.icon,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saved to My Advice! 💡" });
      queryClient.invalidateQueries({ queryKey: ["saved-advice-titles", userId] });
      queryClient.invalidateQueries({ queryKey: ["saved-advice", userId] });
    },
    onError: (e: any) => {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    },
  });

  if (!breedId || !breedName) {
    return (
      <div className="rounded-[18px] bg-card p-5 text-center shadow-sm">
        <p className="text-sm text-muted-foreground font-body">Add a breed to your pet to get personalised daily advice!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold font-body text-foreground">
          ✨ Daily {breedName} Advice
        </h3>
        <button
          className="text-xs font-bold font-body text-accent hover:text-accent/80 transition-colors"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          ↻ Refresh
        </button>
      </div>

      {isLoading || isFetching ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground font-body">Generating advice for your {breedName}...</p>
        </div>
      ) : topics.length === 0 ? (
        <div className="rounded-[18px] bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground font-body">No advice available right now. Try refreshing!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic, idx) => {
            const isSaved = savedTitles.includes(topic.title);
            return (
              <motion.div
                key={`${refreshKey}-${idx}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.15, ease: "easeOut" }}
                className="rounded-[18px] bg-card p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="text-[28px] shrink-0 leading-none mt-0.5">{topic.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold font-body text-foreground mb-1">{topic.title}</h4>
                    <p className="text-[12px] text-muted-foreground font-body leading-relaxed">{topic.content}</p>
                    <button
                      className={`mt-2 text-[12px] font-bold font-body transition-colors ${isSaved ? "text-accent" : "text-accent hover:text-accent/80"}`}
                      onClick={() => !isSaved && saveMutation.mutate(topic)}
                      disabled={isSaved || saveMutation.isPending}
                    >
                      {isSaved ? "✅ Saved" : "🔖 Save to My Advice"}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
