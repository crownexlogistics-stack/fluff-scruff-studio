import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Sparkles, Send, Eye, Save, Users, UserMinus, Crown, UserX,
  Loader2, Mail, FileText, CheckCircle2, Wand2, Paperclip, X,
  Copy, Trash2, Clock, CalendarIcon, FolderOpen, Inbox, BookTemplate,
  MoreHorizontal, AlertCircle
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { CampaignROIDashboard } from "./CampaignROIDashboard";

type Segment = "all" | "one-timers" | "lost-regulars" | "vips";
type CampaignFolder = "sent" | "drafts" | "templates" | "scheduled";

interface CustomerBucket {
  email: string;
  name: string;
  completedCount: number;
  lastBooking: string;
}

export function EmailMarketingSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // AI Generator state
  const [prompt, setPrompt] = useState("");
  const [generatedSubject, setGeneratedSubject] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment>("all");
  const [activeTab, setActiveTab] = useState("create");
  const [activeFolder, setActiveFolder] = useState<CampaignFolder>("sent");

  // AI Refine state
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refineImage, setRefineImage] = useState<string | null>(null);
  const [refineImageName, setRefineImageName] = useState("");

  // Schedule state
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState("09:00");

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch all bookings for segmentation
  const { data: bookings } = useQuery({
    queryKey: ["marketing-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("customer_email, customer_name, status, booking_date")
        .not("customer_email", "is", null)
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch unsubscribes
  const { data: unsubscribes } = useQuery({
    queryKey: ["email-unsubscribes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_unsubscribes").select("email");
      if (error) throw error;
      return data;
    },
  });

  // Fetch campaigns
  const { data: campaigns } = useQuery({
    queryKey: ["email-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const unsubSet = useMemo(() => {
    return new Set((unsubscribes || []).map(u => u.email.toLowerCase()));
  }, [unsubscribes]);

  // Build customer segments
  const segments = useMemo(() => {
    if (!bookings) return { all: [], "one-timers": [], "lost-regulars": [], vips: [] };

    const map = new Map<string, CustomerBucket>();
    for (const b of bookings) {
      if (!b.customer_email) continue;
      const key = b.customer_email.toLowerCase().trim();
      if (unsubSet.has(key)) continue;

      const existing = map.get(key);
      const isCompleted = b.status === "Completed";
      if (existing) {
        if (isCompleted) existing.completedCount++;
        if (b.booking_date > existing.lastBooking) existing.lastBooking = b.booking_date;
      } else {
        map.set(key, {
          email: b.customer_email,
          name: b.customer_name,
          completedCount: isCompleted ? 1 : 0,
          lastBooking: b.booking_date,
        });
      }
    }

    const all = Array.from(map.values());
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoff = threeMonthsAgo.toISOString().slice(0, 10);

    return {
      all,
      "one-timers": all.filter(c => c.completedCount === 1),
      "lost-regulars": all.filter(c => c.completedCount >= 2 && c.lastBooking < cutoff),
      vips: all.filter(c => c.completedCount > 5),
    };
  }, [bookings, unsubSet]);

  // Filtered campaigns by folder
  const folderCampaigns = useMemo(() => {
    if (!campaigns) return [];
    switch (activeFolder) {
      case "sent": return campaigns.filter(c => c.status === "sent" || c.status === "sending");
      case "drafts": return campaigns.filter(c => c.status === "draft");
      case "templates": return campaigns.filter(c => c.status === "template");
      case "scheduled": return campaigns.filter(c => c.status === "scheduled");
      default: return campaigns;
    }
  }, [campaigns, activeFolder]);

  const folderCounts = useMemo(() => {
    if (!campaigns) return { sent: 0, drafts: 0, templates: 0, scheduled: 0 };
    return {
      sent: campaigns.filter(c => c.status === "sent" || c.status === "sending").length,
      drafts: campaigns.filter(c => c.status === "draft").length,
      templates: campaigns.filter(c => c.status === "template").length,
      scheduled: campaigns.filter(c => c.status === "scheduled").length,
    };
  }, [campaigns]);

  // AI generation
  const generateMutation = useMutation({
    mutationFn: async (campaignPrompt: string) => {
      const { data, error } = await supabase.functions.invoke("generate-campaign-email", {
        body: { prompt: campaignPrompt, bookingUrl: "https://fluff-scruff-studio.lovable.app/book" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setGeneratedSubject(data.subject || "");
      setGeneratedHtml(data.html || "");
      setPreviewText(data.previewText || "");
      setShowPreview(true);
      toast.success("Email campaign generated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // AI Refine mutation
  const refineMutation = useMutation({
    mutationFn: async ({ instruction, imageBase64 }: { instruction: string; imageBase64?: string | null }) => {
      const { data, error } = await supabase.functions.invoke("generate-campaign-email", {
        body: { mode: "refine", currentHtml: generatedHtml, editInstruction: instruction, imageBase64: imageBase64 || undefined },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data.subject) setGeneratedSubject(data.subject);
      if (data.html) setGeneratedHtml(data.html);
      if (data.previewText) setPreviewText(data.previewText);
      setRefineInstruction("");
      setRefineImage(null);
      setRefineImageName("");
      toast.success("Email refined successfully!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleRefineImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("Image must be under 4MB"); return; }
    setRefineImageName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => setRefineImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Save as draft
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("email_campaigns").insert({
        subject: generatedSubject, html_body: generatedHtml, prompt, segment: selectedSegment, status: "draft", created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      toast.success("Campaign saved as draft!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Save as template
  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("email_campaigns").insert({
        subject: generatedSubject, html_body: generatedHtml, prompt, segment: selectedSegment, status: "template", created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      toast.success("Saved as template!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Duplicate campaign
  const duplicateMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const source = campaigns?.find(c => c.id === campaignId);
      if (!source) throw new Error("Campaign not found");
      const { error } = await supabase.from("email_campaigns").insert({
        subject: `${source.subject} (Copy)`, html_body: source.html_body, prompt: source.prompt,
        segment: source.segment, status: "draft", created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      toast.success("Campaign duplicated as draft!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Delete campaign
  const deleteMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase.from("email_campaigns").delete().eq("id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      setDeleteId(null);
      toast.success("Campaign deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Send campaign
  const sendMutation = useMutation({
    mutationFn: async (opts: { campaignId?: string; fromDraft?: boolean }) => {
      const targetEmails = segments[selectedSegment].map(c => c.email);
      if (targetEmails.length === 0) throw new Error("No customers in this segment");

      let campaignId = opts.campaignId;
      if (!campaignId) {
        const { data: inserted, error: insertErr } = await supabase
          .from("email_campaigns")
          .insert({ subject: generatedSubject, html_body: generatedHtml, prompt, segment: selectedSegment, status: "sending", created_by: user!.id })
          .select("id").single();
        if (insertErr) throw insertErr;
        campaignId = inserted.id;
      } else {
        await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId);
      }

      const { data, error } = await supabase.functions.invoke("send-campaign", {
        body: { campaignId, emails: targetEmails, subject: generatedSubject, htmlBody: generatedHtml },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      toast.success(`Campaign sent! ${data.sent} emails delivered, ${data.skipped} unsubscribed skipped.`);
      setActiveTab("campaigns");
      setActiveFolder("sent");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Schedule campaign
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!scheduleDate) throw new Error("Please select a date");
      const [hours, mins] = scheduleTime.split(":").map(Number);
      const scheduledAt = new Date(scheduleDate);
      scheduledAt.setHours(hours, mins, 0, 0);
      if (scheduledAt <= new Date()) throw new Error("Scheduled time must be in the future");

      const { error } = await supabase.from("email_campaigns").insert({
        subject: generatedSubject, html_body: generatedHtml, prompt, segment: selectedSegment,
        status: "scheduled", created_by: user!.id, scheduled_at: scheduledAt.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      setShowScheduler(false);
      setScheduleDate(undefined);
      toast.success("Campaign scheduled!");
      setActiveTab("campaigns");
      setActiveFolder("scheduled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const loadCampaignToEditor = (c: any) => {
    setGeneratedSubject(c.subject);
    setGeneratedHtml(c.html_body);
    setPrompt(c.prompt || "");
    setSelectedSegment(c.segment as Segment);
    setShowPreview(true);
    setActiveTab("create");
  };

  const segmentCards: { key: Segment; label: string; desc: string; icon: React.ElementType; color: string }[] = [
    { key: "all", label: "Full List", desc: "Every customer email", icon: Users, color: "text-primary" },
    { key: "one-timers", label: "One-Timers", desc: "1 completed appointment only", icon: UserMinus, color: "text-orange-500" },
    { key: "lost-regulars", label: "Lost Regulars", desc: "2+ bookings, none in 3 months", icon: UserX, color: "text-destructive" },
    { key: "vips", label: "VIPs", desc: "More than 5 completed appointments", icon: Crown, color: "text-amber-500" },
  ];

  const folders: { key: CampaignFolder; label: string; icon: React.ElementType }[] = [
    { key: "sent", label: "Sent", icon: CheckCircle2 },
    { key: "drafts", label: "Drafts", icon: FileText },
    { key: "scheduled", label: "Scheduled", icon: Clock },
    { key: "templates", label: "Templates", icon: BookTemplate },
  ];

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="create" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Create</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5"><FolderOpen className="h-3.5 w-3.5" /> Campaign Library</TabsTrigger>
          <TabsTrigger value="roi" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> ROI & Attribution</TabsTrigger>
        </TabsList>

        {/* ── CREATE TAB ─────────────────────────────── */}
        <TabsContent value="create" className="space-y-6">
          {/* AI Prompt Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-amber-500" />
                AI Campaign Generator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe your email campaign... e.g. 'Valentine's Day promotion — 20% off couples grooming, mention our luxury spa bath add-on'"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              <div className="flex items-center gap-2">
                <Button onClick={() => generateMutation.mutate(prompt)} disabled={!prompt.trim() || generateMutation.isPending} className="gap-1.5">
                  {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate Email</>}
                </Button>
                {generateMutation.isPending && <span className="text-xs text-muted-foreground">AI is designing your email…</span>}
              </div>
            </CardContent>
          </Card>

          {/* Live Preview + Editor */}
          {showPreview && generatedHtml && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg"><Eye className="h-5 w-5" /> Live Preview & Editor</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
                      <Save className="h-3.5 w-3.5 mr-1" /> Save Draft
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => saveTemplateMutation.mutate()} disabled={saveTemplateMutation.isPending}>
                      <BookTemplate className="h-3.5 w-3.5 mr-1" /> Save as Template
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject Line</label>
                  <Input value={generatedSubject} onChange={e => setGeneratedSubject(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Preview</label>
                  <div className="border rounded-lg overflow-hidden bg-muted/30">
                    <div className="bg-muted px-4 py-2 flex items-center gap-2 border-b">
                      <div className="flex gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                      </div>
                      <span className="text-xs text-muted-foreground ml-2">Email Preview</span>
                    </div>
                    <div className="p-4 flex justify-center" style={{ background: "white" }}>
                      <iframe srcDoc={generatedHtml} className="w-full max-w-[620px] border-0" style={{ minHeight: 600 }} title="Email preview" sandbox="allow-same-origin" />
                    </div>
                  </div>
                </div>

                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">▸ Edit HTML Source</summary>
                  <Textarea value={generatedHtml} onChange={e => setGeneratedHtml(e.target.value)} className="mt-2 min-h-[200px] font-mono text-xs" />
                </details>

                {/* AI Refine Section */}
                <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-amber-500" />
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Refine</label>
                  </div>
                  <Textarea placeholder="Tell AI what to change... e.g. 'Make the header pink', 'Add a winter theme'" value={refineInstruction} onChange={e => setRefineInstruction(e.target.value)} className="min-h-[70px] resize-none text-sm" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button onClick={() => refineMutation.mutate({ instruction: refineInstruction, imageBase64: refineImage })} disabled={!refineInstruction.trim() || refineMutation.isPending} size="sm" className="gap-1.5">
                      {refineMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Refining...</> : <><Wand2 className="h-3.5 w-3.5" /> Apply Changes</>}
                    </Button>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handleRefineImageUpload} />
                      <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" tabIndex={-1}><Paperclip className="h-3.5 w-3.5" /> Attach Image</Button>
                    </label>
                    {refineImageName && (
                      <div className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded-md">
                        <span className="truncate max-w-[150px]">{refineImageName}</span>
                        <button onClick={() => { setRefineImage(null); setRefineImageName(""); }} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audience Selector */}
          {showPreview && generatedHtml && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" /> Choose Your Audience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {segmentCards.map(seg => {
                    const Icon = seg.icon;
                    const count = segments[seg.key].length;
                    const isActive = selectedSegment === seg.key;
                    return (
                      <Card key={seg.key} className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${isActive ? "ring-2 ring-primary shadow-md" : ""}`} onClick={() => setSelectedSegment(seg.key)}>
                        <CardContent className="p-4 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Icon className={`h-5 w-5 ${seg.color}`} />
                            {isActive && <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">Selected</span>}
                          </div>
                          <p className="text-2xl font-bold font-heading">{count}</p>
                          <p className="text-sm font-medium">{seg.label}</p>
                          <p className="text-xs text-muted-foreground">{seg.desc}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Send / Schedule buttons */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Sending to <strong>{segments[selectedSegment].length}</strong> customer{segments[selectedSegment].length !== 1 ? "s" : ""}
                    {unsubSet.size > 0 && <span className="ml-1">({unsubSet.size} unsubscribed excluded)</span>}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowScheduler(!showScheduler)} className="gap-1.5">
                      <Clock className="h-4 w-4" /> Schedule
                    </Button>
                    <Button onClick={() => sendMutation.mutate({})} disabled={sendMutation.isPending || segments[selectedSegment].length === 0} className="gap-1.5" size="lg">
                      {sendMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send Now</>}
                    </Button>
                  </div>
                </div>

                {/* Schedule picker */}
                {showScheduler && (
                  <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" /> Schedule for Later</h4>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {scheduleDate ? format(scheduleDate, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} disabled={(d) => d < new Date()} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Time</label>
                        <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-[140px]" />
                      </div>
                      <Button onClick={() => scheduleMutation.mutate()} disabled={!scheduleDate || scheduleMutation.isPending} className="gap-1.5">
                        {scheduleMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Scheduling...</> : <><Clock className="h-4 w-4" /> Confirm Schedule</>}
                      </Button>
                    </div>
                    {scheduleDate && (
                      <p className="text-xs text-muted-foreground">
                        Will send on <strong>{format(scheduleDate, "EEEE, d MMMM yyyy")}</strong> at <strong>{scheduleTime}</strong>
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── ROI & ATTRIBUTION TAB ─────────────────── */}
        <TabsContent value="roi">
          <CampaignROIDashboard />
        </TabsContent>

        {/* ── CAMPAIGN LIBRARY TAB ─────────────────────── */}
        <TabsContent value="campaigns" className="space-y-4">
          {/* Folder tabs */}
          <div className="flex gap-2 flex-wrap">
            {folders.map(f => {
              const Icon = f.icon;
              const count = folderCounts[f.key];
              const isActive = activeFolder === f.key;
              return (
                <Button key={f.key} variant={isActive ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setActiveFolder(f.key)}>
                  <Icon className="h-3.5 w-3.5" /> {f.label}
                  {count > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] text-[10px]">{count}</Badge>}
                </Button>
              );
            })}
          </div>

          {/* Campaign list */}
          {!folderCampaigns.length ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No {activeFolder === "templates" ? "templates" : activeFolder === "scheduled" ? "scheduled campaigns" : activeFolder} yet.</p>
                {activeFolder === "drafts" && <p className="text-xs mt-1">Create a campaign and save it as a draft to see it here.</p>}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {folderCampaigns.map(c => (
                <Card key={c.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{c.subject}</p>
                        <Badge variant={c.status === "sent" ? "default" : c.status === "scheduled" ? "secondary" : "outline"} className="shrink-0 text-[10px]">
                          {c.status === "sent" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {c.status === "scheduled" && <Clock className="h-3 w-3 mr-1" />}
                          {c.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {c.prompt && <span className="truncate max-w-[200px]">Prompt: {c.prompt}</span>}
                        <span>Segment: {c.segment}</span>
                        {c.status === "sent" && <span>{c.emails_sent} sent</span>}
                        {c.status === "scheduled" && c.scheduled_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(c.scheduled_at), "d MMM yyyy, HH:mm")}
                          </span>
                        )}
                        <span>{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 items-center">
                      <Button variant="outline" size="sm" onClick={() => loadCampaignToEditor(c)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                      {(c.status === "draft" || c.status === "scheduled") && (
                        <Button size="sm" onClick={() => {
                          setGeneratedSubject(c.subject);
                          setGeneratedHtml(c.html_body);
                          setSelectedSegment(c.segment as Segment);
                          sendMutation.mutate({ campaignId: c.id, fromDraft: true });
                        }} disabled={sendMutation.isPending}>
                          <Send className="h-3.5 w-3.5 mr-1" /> Send
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(c.id)}>
                            <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteId(c.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this campaign. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
