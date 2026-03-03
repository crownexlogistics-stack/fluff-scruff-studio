import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface AdviceTabProps {
  userId: string;
}

export function AdviceTab({ userId }: AdviceTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: savedAdvice = [], isLoading } = useQuery({
    queryKey: ["saved-advice", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_advice")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_advice").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-advice", userId] });
      queryClient.invalidateQueries({ queryKey: ["saved-advice-titles", userId] });
      toast({ title: "Removed from saved advice" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin h-6 w-6 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-accent" />
        My Saved Advice
      </h3>

      {savedAdvice.length === 0 ? (
        <div className="text-center py-10">
          <Lightbulb className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No saved advice yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Save tips from your daily breed advice feed!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {savedAdvice.map((item: any) => (
            <div key={item.id} className="rounded-2xl border border-border/50 bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{item.icon || "💡"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold font-body text-foreground mb-0.5">{item.title}</h4>
                      <p className="text-[10px] text-muted-foreground/60">{item.breed_name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{item.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
