import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Zap, Clock, UserPlus, RefreshCw, Loader2, Trash2 } from "lucide-react";

const TRIGGER_TYPES = [
  { value: "win_back", label: "Win-Back", desc: "Customers inactive for X days", icon: Clock, defaultConfig: { days_inactive: 60 } },
  { value: "welcome_series", label: "Welcome Series", desc: "New customers after first booking", icon: UserPlus, defaultConfig: { days_after_first: 3 } },
  { value: "re_engagement", label: "Re-Engagement", desc: "Opened campaign but didn't book", icon: RefreshCw, defaultConfig: { days_since_open: 14 } },
];

export function AutomationsSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState("win_back");
  const [formDays, setFormDays] = useState(60);
  const [formSubject, setFormSubject] = useState("");
  const [formHtml, setFormHtml] = useState("");

  const { data: rules, isLoading } = useQuery({
    queryKey: ["automation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sends } = useQuery({
    queryKey: ["automation-sends-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_sends")
        .select("rule_id");
      if (error) throw error;
      return data;
    },
  });

  const sendCountByRule = (ruleId: string) => (sends || []).filter(s => s.rule_id === ruleId).length;

  const createMutation = useMutation({
    mutationFn: async () => {
      const triggerInfo = TRIGGER_TYPES.find(t => t.value === formTrigger)!;
      const configKey = formTrigger === "win_back" ? "days_inactive" : formTrigger === "welcome_series" ? "days_after_first" : "days_since_open";
      const { error } = await supabase.from("automation_rules").insert({
        name: formName,
        trigger_type: formTrigger,
        trigger_config: { [configKey]: formDays },
        email_subject: formSubject,
        email_html: formHtml,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      setShowCreate(false);
      resetForm();
      toast.success("Automation created!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("automation_rules").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Automation updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automation_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Automation deleted");
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("run-automations");
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["automation-sends-count"] });
      toast.success(`Automations processed: ${data.sent} emails sent`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setFormName("");
    setFormTrigger("win_back");
    setFormDays(60);
    setFormSubject("");
    setFormHtml("");
  };

  const triggerLabel = (type: string) => TRIGGER_TYPES.find(t => t.value === type)?.label || type;
  const TriggerIcon = (type: string) => TRIGGER_TYPES.find(t => t.value === type)?.icon || Zap;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Customer Journey Automations</h3>
          <p className="text-sm text-muted-foreground">Set up automated email triggers based on customer behaviour</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runMutation.mutate()} disabled={runMutation.isPending} size="sm">
            {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Run Now
          </Button>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Automation
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !rules?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No automations yet. Create your first one to start sending triggered emails.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => {
            const Icon = TriggerIcon(rule.trigger_type);
            const config = rule.trigger_config as any;
            const days = config.days_inactive || config.days_after_first || config.days_since_open || 0;
            return (
              <Card key={rule.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg ${rule.is_active ? "bg-primary/10" : "bg-muted"}`}>
                      <Icon className={`h-5 w-5 ${rule.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{rule.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{triggerLabel(rule.trigger_type)}</Badge>
                        <span>{days} days</span>
                        <span>{sendCountByRule(rule.id)} sent</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch checked={rule.is_active} onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, active: checked })} />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => deleteMutation.mutate(rule.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Automation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. 60-Day Win-Back" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Trigger Type</label>
                <Select value={formTrigger} onValueChange={(v) => {
                  setFormTrigger(v);
                  const t = TRIGGER_TYPES.find(t => t.value === v);
                  const defaultDays = Object.values(t?.defaultConfig || {})[0] as number;
                  setFormDays(defaultDays);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label} — {t.desc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {formTrigger === "win_back" ? "Days Inactive" : formTrigger === "welcome_series" ? "Days After First Booking" : "Days Since Open"}
                </label>
                <Input type="number" value={formDays} onChange={e => setFormDays(Number(e.target.value))} min={1} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email Subject</label>
              <Input value={formSubject} onChange={e => setFormSubject(e.target.value)} placeholder="We miss you, {{CUSTOMER_NAME}}!" />
              <p className="text-[10px] text-muted-foreground">Use {"{{CUSTOMER_NAME}}"} for personalisation</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email HTML Body</label>
              <Textarea value={formHtml} onChange={e => setFormHtml(e.target.value)} placeholder="Paste your HTML email template here..." className="min-h-[120px] font-mono text-xs" />
              <p className="text-[10px] text-muted-foreground">Include {"{{UNSUBSCRIBE_URL}}"} for the unsubscribe link</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!formName || !formSubject || !formHtml || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
