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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles, Send, Eye, Save, Users, UserMinus, Crown, UserX,
  Loader2, Mail, FileText, CheckCircle2, AlertCircle, Wand2, Paperclip, X
} from "lucide-react";

type Segment = "all" | "one-timers" | "lost-regulars" | "vips";

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

  // AI Refine state
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refineImage, setRefineImage] = useState<string | null>(null);
  const [refineImageName, setRefineImageName] = useState("");

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
        body: {
          mode: "refine",
          currentHtml: generatedHtml,
          editInstruction: instruction,
          imageBase64: imageBase64 || undefined,
        },
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
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4MB");
      return;
    }
    setRefineImageName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => setRefineImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Save as draft
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("email_campaigns").insert({
        subject: generatedSubject,
        html_body: generatedHtml,
        prompt,
        segment: selectedSegment,
        status: "draft",
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      toast.success("Campaign saved as draft!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Send campaign
  const sendMutation = useMutation({
    mutationFn: async (opts: { campaignId?: string; fromDraft?: boolean }) => {
      const targetEmails = segments[selectedSegment].map(c => c.email);
      if (targetEmails.length === 0) throw new Error("No customers in this segment");

      // Save campaign first if not from draft
      let campaignId = opts.campaignId;
      if (!campaignId) {
        const { data: inserted, error: insertErr } = await supabase
          .from("email_campaigns")
          .insert({
            subject: generatedSubject,
            html_body: generatedHtml,
            prompt,
            segment: selectedSegment,
            status: "sending",
            created_by: user!.id,
          })
          .select("id")
          .single();
        if (insertErr) throw insertErr;
        campaignId = inserted.id;
      } else {
        await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId);
      }

      const { data, error } = await supabase.functions.invoke("send-campaign", {
        body: {
          campaignId,
          emails: targetEmails,
          subject: generatedSubject,
          htmlBody: generatedHtml,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      toast.success(`Campaign sent! ${data.sent} emails delivered, ${data.skipped} unsubscribed skipped.`);
      setActiveTab("campaigns");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const segmentCards: { key: Segment; label: string; desc: string; icon: React.ElementType; color: string }[] = [
    { key: "all", label: "Full List", desc: "Every customer email", icon: Users, color: "text-primary" },
    { key: "one-timers", label: "One-Timers", desc: "1 completed appointment only", icon: UserMinus, color: "text-orange-500" },
    { key: "lost-regulars", label: "Lost Regulars", desc: "2+ bookings, none in 3 months", icon: UserX, color: "text-red-500" },
    { key: "vips", label: "VIPs", desc: "More than 5 completed appointments", icon: Crown, color: "text-amber-500" },
  ];

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="create" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Create</TabsTrigger>
        <TabsTrigger value="campaigns" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Campaigns</TabsTrigger>
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
              <Button
                onClick={() => generateMutation.mutate(prompt)}
                disabled={!prompt.trim() || generateMutation.isPending}
                className="gap-1.5"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate Email</>
                )}
              </Button>
              {generateMutation.isPending && (
                <span className="text-xs text-muted-foreground">AI is designing your email…</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Preview + Editor */}
        {showPreview && generatedHtml && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Eye className="h-5 w-5" /> Live Preview & Editor
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
                    <Save className="h-3.5 w-3.5 mr-1" /> Save Draft
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Editable subject line */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject Line</label>
                <Input value={generatedSubject} onChange={e => setGeneratedSubject(e.target.value)} />
              </div>

              {/* HTML Preview */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Preview</label>
                <div className="border rounded-lg overflow-hidden bg-muted/30">
                  <div className="bg-muted px-4 py-2 flex items-center gap-2 border-b">
                    <div className="flex gap-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">Email Preview</span>
                  </div>
                  <div className="p-4 flex justify-center bg-white">
                    <iframe
                      srcDoc={generatedHtml}
                      className="w-full max-w-[620px] border-0"
                      style={{ minHeight: 600 }}
                      title="Email preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              </div>

              {/* Raw HTML editor */}
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  ▸ Edit HTML Source
                </summary>
                <Textarea
                  value={generatedHtml}
                  onChange={e => setGeneratedHtml(e.target.value)}
                  className="mt-2 min-h-[200px] font-mono text-xs"
                />
              </details>

              {/* AI Refine Section */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-amber-500" />
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Refine</label>
                </div>
                <Textarea
                  placeholder="Tell AI what to change... e.g. 'Make the header pink', 'Add a winter theme', 'Use the attached image as the hero banner'"
                  value={refineInstruction}
                  onChange={e => setRefineInstruction(e.target.value)}
                  className="min-h-[70px] resize-none text-sm"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={() => refineMutation.mutate({ instruction: refineInstruction, imageBase64: refineImage })}
                    disabled={!refineInstruction.trim() || refineMutation.isPending}
                    size="sm"
                    className="gap-1.5"
                  >
                    {refineMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Refining...</>
                    ) : (
                      <><Wand2 className="h-3.5 w-3.5" /> Apply Changes</>
                    )}
                  </Button>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleRefineImageUpload} />
                    <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" tabIndex={-1}>
                      <Paperclip className="h-3.5 w-3.5" /> Attach Image
                    </Button>
                  </label>
                  {refineImageName && (
                    <div className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded-md">
                      <span className="truncate max-w-[150px]">{refineImageName}</span>
                      <button onClick={() => { setRefineImage(null); setRefineImageName(""); }} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
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
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" /> Choose Your Audience
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {segmentCards.map(seg => {
                  const Icon = seg.icon;
                  const count = segments[seg.key].length;
                  const isActive = selectedSegment === seg.key;
                  return (
                    <Card
                      key={seg.key}
                      className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${
                        isActive ? "ring-2 ring-primary shadow-md" : ""
                      }`}
                      onClick={() => setSelectedSegment(seg.key)}
                    >
                      <CardContent className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Icon className={`h-5 w-5 ${seg.color}`} />
                          {isActive && (
                            <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-2xl font-bold font-heading">{count}</p>
                        <p className="text-sm font-medium">{seg.label}</p>
                        <p className="text-xs text-muted-foreground">{seg.desc}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Send button */}
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Sending to <strong>{segments[selectedSegment].length}</strong> customer{segments[selectedSegment].length !== 1 ? "s" : ""}
                  {unsubSet.size > 0 && (
                    <span className="ml-1">({unsubSet.size} unsubscribed excluded)</span>
                  )}
                </p>
                <Button
                  onClick={() => sendMutation.mutate({})}
                  disabled={sendMutation.isPending || segments[selectedSegment].length === 0}
                  className="gap-1.5"
                  size="lg"
                >
                  {sendMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Send Now</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* ── CAMPAIGNS TAB ─────────────────────────── */}
      <TabsContent value="campaigns" className="space-y-4">
        {!campaigns?.length ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No campaigns yet. Create your first one!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <Card key={c.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{c.subject}</p>
                      <Badge variant={c.status === "sent" ? "default" : c.status === "sending" ? "secondary" : "outline"} className="shrink-0 text-[10px]">
                        {c.status === "sent" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {c.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {c.prompt && <span className="truncate max-w-[200px]">Prompt: {c.prompt}</span>}
                      <span>Segment: {c.segment}</span>
                      {c.status === "sent" && <span>{c.emails_sent} sent</span>}
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setGeneratedSubject(c.subject);
                        setGeneratedHtml(c.html_body);
                        setPrompt(c.prompt || "");
                        setSelectedSegment(c.segment as Segment);
                        setShowPreview(true);
                        setActiveTab("create");
                      }}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    {c.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setGeneratedSubject(c.subject);
                          setGeneratedHtml(c.html_body);
                          setSelectedSegment(c.segment as Segment);
                          sendMutation.mutate({ campaignId: c.id, fromDraft: true });
                        }}
                        disabled={sendMutation.isPending}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" /> Send
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
