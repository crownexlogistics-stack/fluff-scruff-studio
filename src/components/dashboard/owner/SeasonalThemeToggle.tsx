import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonalTheme } from "@/hooks/useSeasonalTheme";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

/** One switch: Halloween look on the website + Halloween Special extra bookable. */
export function SeasonalThemeToggle() {
  const qc = useQueryClient();
  const { data: theme, isLoading } = useSeasonalTheme();
  const on = theme === "halloween";

  const m = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("site_config")
        .upsert({ key: "seasonal_theme", value: { active: next ? "halloween" : null }, updated_at: new Date().toISOString() } as any);
      if (error) throw error;
      const { error: e2 } = await supabase.from("add_ons").update({ is_active: next }).ilike("name", "%halloween%");
      if (e2) throw e2;
    },
    onSuccess: (_, next) => {
      qc.invalidateQueries({ queryKey: ["seasonal_theme"] });
      qc.invalidateQueries({ queryKey: ["add_ons"] });
      toast.success(next ? "Halloween is ON for the website and bookings" : "Halloween is OFF — website back to normal");
    },
    onError: () => toast.error("Couldn't change the Halloween switch — please try again"),
  });

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4">
      <div>
        <p className="font-heading text-base">🎃 Halloween Special</p>
        <p className="text-xs text-muted-foreground">
          {on ? "On: Halloween look on the website and the +£10 extra can be booked." : "Off: website looks normal and the extra is hidden."}
        </p>
      </div>
      <Switch checked={on} disabled={isLoading || m.isPending} onCheckedChange={(v) => m.mutate(v)} />
    </div>
  );
}
