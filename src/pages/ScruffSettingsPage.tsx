import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bot, MessageSquare, Clock, Mail } from "lucide-react";

export default function ScruffSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["scruff-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("key, value")
        .in("key", ["scruff_enabled", "scruff_welcome_message", "scruff_away_mode", "scruff_away_message", "scruff_handoff_email"]);
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });

  const [enabled, setEnabled] = useState(true);
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [awayMode, setAwayMode] = useState(false);
  const [awayMessage, setAwayMessage] = useState("");
  const [handoffEmail, setHandoffEmail] = useState("info@fluffandscruff.co.uk");

  useEffect(() => {
    if (settings) {
      setEnabled(settings.scruff_enabled !== false);
      setWelcomeMsg(typeof settings.scruff_welcome_message === "string" ? settings.scruff_welcome_message : "");
      setAwayMode(settings.scruff_away_mode === true);
      setAwayMessage(typeof settings.scruff_away_message === "string" ? settings.scruff_away_message : "");
      setHandoffEmail(typeof settings.scruff_handoff_email === "string" ? settings.scruff_handoff_email : "info@fluffandscruff.co.uk");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (entries: Array<{ key: string; value: any }>) => {
      for (const entry of entries) {
        const { error } = await supabase
          .from("site_config")
          .upsert({ key: entry.key, value: entry.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scruff-settings"] });
      toast({ title: "Settings saved ✅" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate([
      { key: "scruff_enabled", value: enabled },
      { key: "scruff_welcome_message", value: welcomeMsg },
      { key: "scruff_away_mode", value: awayMode },
      { key: "scruff_away_message", value: awayMessage },
      { key: "scruff_handoff_email", value: handoffEmail },
    ]);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">⚙️ Scruff Settings</h1>
          <p className="text-sm text-muted-foreground">Configure the AI chat assistant</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="w-5 h-5" /> Scruff On/Off</CardTitle>
            <CardDescription>Enable or disable Scruff across the entire website</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <span className="text-sm">{enabled ? "Scruff is LIVE 🟢" : "Scruff is OFF 🔴"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Welcome Message</CardTitle>
            <CardDescription>Customise Scruff's opening message when a customer opens chat</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={welcomeMsg}
              onChange={e => setWelcomeMsg(e.target.value)}
              placeholder="Woof! 👋 I'm Scruff, your grooming assistant! What can I help with today? 🐾"
              rows={3}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Away Mode</CardTitle>
            <CardDescription>When enabled, Scruff adds a note that the team is currently away</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={awayMode} onCheckedChange={setAwayMode} />
              <span className="text-sm">{awayMode ? "Away mode ON" : "Away mode OFF"}</span>
            </div>
            {awayMode && (
              <Textarea
                value={awayMessage}
                onChange={e => setAwayMessage(e.target.value)}
                placeholder="Just so you know, our team is currently away but will be back Tuesday at 10am. I'll make sure any messages get to them!"
                rows={2}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Handoff Email</CardTitle>
            <CardDescription>Which email receives notifications when a customer is handed off to staff</CardDescription>
          </CardHeader>
          <CardContent>
            <Input value={handoffEmail} onChange={e => setHandoffEmail(e.target.value)} type="email" />
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </AppLayout>
  );
}
