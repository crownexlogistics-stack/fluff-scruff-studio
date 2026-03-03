import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bookmark, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

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

  const { data: topics = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["breed-advice", breedId],
    queryFn: async () => {
      if (!breedId || !breedName) return [];
      const { data, error } = await supabase.functions.invoke("generate-breed-advice", {
        body: { breed_id: breedId, breed_name: breedName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.topics || []) as AdviceTopic[];
    },
    enabled: !!breedId && !!breedName,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

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
      <div className="rounded-2xl border border-border/50 bg-card p-5 text-center">
        <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Add a breed to your pet to get personalised daily advice!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          Daily {breedName} Advice
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-muted-foreground"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Generating advice for your {breedName}...</p>
        </div>
      ) : topics.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">No advice available right now. Try refreshing!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic, idx) => {
            const isSaved = savedTitles.includes(topic.title);
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.15, ease: "easeOut" }}
                className="rounded-2xl border border-border/50 bg-card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 mt-0.5">{topic.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold font-body text-foreground mb-1">{topic.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{topic.content}</p>
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 text-xs gap-1 ${isSaved ? "text-accent" : "text-muted-foreground"}`}
                    onClick={() => !isSaved && saveMutation.mutate(topic)}
                    disabled={isSaved || saveMutation.isPending}
                  >
                    <Bookmark className={`h-3 w-3 ${isSaved ? "fill-accent" : ""}`} />
                    {isSaved ? "Saved" : "Save to My Advice"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
