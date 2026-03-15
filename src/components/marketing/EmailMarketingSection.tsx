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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Sparkles, Send, Eye, Save, Users, UserMinus, Crown, UserX,
  Loader2, Mail, FileText, CheckCircle2, Wand2, Paperclip, X,
  Copy, Trash2, Clock, CalendarIcon, FolderOpen, Inbox, BookTemplate,
  MoreHorizontal, AlertCircle, Palette, ImagePlus, Zap, MessageSquare,
  FlaskConical, Search, XCircle, Upload, Pencil
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { CampaignROIDashboard } from "./CampaignROIDashboard";
import { AutomationsSection } from "./AutomationsSection";
import { SMSSection } from "./SMSSection";

type Segment = "all" | "one-timers" | "lost-regulars" | "vips";
type CampaignFolder = "sent" | "drafts" | "templates" | "scheduled";

interface CustomerBucket {
  email: string;
  name: string;
  completedCount: number;
  lastBooking: string;
  source?: string;
}

const UNSUBSCRIBE_FOOTER_PREVIEW = `
<div style="border-top:1px solid #e0e0e0;margin-top:32px;padding-top:20px;text-align:center;font-family:Arial,sans-serif;">
  <p style="font-size:12px;color:#999;line-height:1.6;margin:0;">
    You are receiving this email because you are part of the Fluff &amp; Scruff family.<br/>
    To unsubscribe from future marketing emails, <a href="https://fluffandscruff.co.uk/unsubscribe?email=preview@example.com" style="color:#999;text-decoration:underline;">click here</a>.
  </p>
</div>`;

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
  const [excludedEmails, setExcludedEmails] = useState<Set<string>>(new Set());
  const [showSegmentList, setShowSegmentList] = useState(false);
  const [segmentListSearch, setSegmentListSearch] = useState("");
  // A/B testing state
  const [abEnabled, setAbEnabled] = useState(false);
  const [variantBSubject, setVariantBSubject] = useState("");
  const [abTestPercentage, setAbTestPercentage] = useState(20);
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

  // Edit mode state
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

  // Test email state
  const [testEmail, setTestEmail] = useState("");
  const [showTestEmail, setShowTestEmail] = useState(false);

  // Upload template state
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

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

  // Fetch migrated customers with emails
  const { data: migratedCustomers } = useQuery({
    queryKey: ["marketing-migrated-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("migrated_customers")
        .select("email, full_name")
        .not("email", "is", null);
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

  // Build customer segments - include ALL sources
  const segments = useMemo(() => {
    const map = new Map<string, CustomerBucket>();

    // 1. Add from bookings
    for (const b of (bookings || [])) {
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
          source: "booking",
        });
      }
    }

    // 2. Add from migrated customers (if not already in map)
    for (const mc of (migratedCustomers || [])) {
      if (!mc.email) continue;
      const key = mc.email.toLowerCase().trim();
      if (unsubSet.has(key) || map.has(key)) continue;
      map.set(key, {
        email: mc.email,
        name: mc.full_name || mc.email,
        completedCount: 0,
        lastBooking: "",
        source: "migrated",
      });
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
  }, [bookings, migratedCustomers, unsubSet]);

  // Effective list after exclusions
  const effectiveList = useMemo(() => {
    return segments[selectedSegment].filter(c => !excludedEmails.has(c.email.toLowerCase()));
  }, [segments, selectedSegment, excludedEmails]);

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
        body: { prompt: campaignPrompt, bookingUrl: "https://fluffandscruff.co.uk/book" },
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
      const targetEmails = effectiveList.map(c => c.email);
      if (targetEmails.length === 0) throw new Error("No customers in this segment");

      let campaignId = opts.campaignId;
      const abData = abEnabled && variantBSubject.trim() ? {
        variant_b_subject: variantBSubject,
        ab_test_percentage: abTestPercentage,
      } : {};

      if (!campaignId) {
        const { data: inserted, error: insertErr } = await supabase
          .from("email_campaigns")
          .insert({ subject: generatedSubject, html_body: generatedHtml, prompt, segment: selectedSegment, status: "sending", created_by: user!.id, ...abData })
          .select("id").single();
        if (insertErr) throw insertErr;
        campaignId = inserted.id;
      } else {
        await supabase.from("email_campaigns").update({ status: "sending", ...abData }).eq("id", campaignId);
      }

      const { data, error } = await supabase.functions.invoke("send-campaign", {
        body: {
          campaignId, emails: targetEmails, subject: generatedSubject, htmlBody: generatedHtml,
          ...(abEnabled && variantBSubject.trim() ? { variantBSubject, abTestPercentage } : {}),
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
      setActiveFolder("sent");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Schedule campaign (or update if editing)
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!scheduleDate) throw new Error("Please select a date");
      const [hours, mins] = scheduleTime.split(":").map(Number);
      const scheduledAt = new Date(scheduleDate);
      scheduledAt.setHours(hours, mins, 0, 0);
      if (scheduledAt <= new Date()) throw new Error("Scheduled time must be in the future");

      if (editingCampaignId) {
        const { error } = await supabase.from("email_campaigns").update({
          subject: generatedSubject, html_body: generatedHtml, prompt, segment: selectedSegment,
          scheduled_at: scheduledAt.toISOString(),
        }).eq("id", editingCampaignId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("email_campaigns").insert({
          subject: generatedSubject, html_body: generatedHtml, prompt, segment: selectedSegment,
          status: "scheduled", created_by: user!.id, scheduled_at: scheduledAt.toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      setShowScheduler(false);
      setScheduleDate(undefined);
      const wasEditing = !!editingCampaignId;
      setEditingCampaignId(null);
      toast.success(wasEditing ? "Campaign updated!" : "Campaign scheduled!");
      setActiveTab("campaigns");
      setActiveFolder("scheduled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Update existing campaign (save changes without sending)
  const updateCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!editingCampaignId) throw new Error("No campaign selected for editing");
      const { error } = await supabase.from("email_campaigns").update({
        subject: generatedSubject, html_body: generatedHtml, prompt, segment: selectedSegment,
      }).eq("id", editingCampaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      toast.success("Campaign updated!");
      setEditingCampaignId(null);
      setActiveTab("campaigns");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Send test email
  const sendTestMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!email.trim()) throw new Error("Please enter a test email");
      const { data, error } = await supabase.functions.invoke("send-campaign", {
        body: { emails: [email.trim()], subject: `[TEST] ${generatedSubject}`, htmlBody: generatedHtml },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success(`Test email sent to ${testEmail}!`);
      setShowTestEmail(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File must be under 10MB");
      return;
    }

    setUploadingTemplate(true);
    const ext = file.name.split(".").pop()?.toLowerCase();

    try {
      if (ext === "html" || ext === "htm") {
        // Direct HTML file — load straight into editor
        const text = await file.text();
        setGeneratedHtml(text);
        setGeneratedSubject("");
        setPreviewText("");
        setPrompt(`Uploaded: ${file.name}`);
        setShowPreview(true);
        toast.success("HTML template loaded! You can now edit it with AI Refine.");
      } else {
        // PDF, DOCX, image, or other — convert to base64 and send to AI to extract/convert to email HTML
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          try {
            const { data, error } = await supabase.functions.invoke("generate-campaign-email", {
              body: {
                mode: "refine",
                currentHtml: `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;"><h1>Uploaded Template</h1><p>Converting uploaded file into email format...</p></div>`,
                editInstruction: `The user has uploaded a file named "${file.name}" (type: ${file.type}). The file content is provided as an image. Please recreate this design as a professional HTML email template. Preserve the layout, text, colours, and styling as closely as possible. Make it email-compatible with inline CSS, max-width 600px. Keep the Fluff & Scruff Studio branding with the Book Now button linking to https://fluffandscruff.co.uk/book and footer with address "138 Hillview Avenue, Hornchurch RM11 2DL", phone 01708 606655, WhatsApp +44 7476 452782, and an unsubscribe link placeholder {{UNSUBSCRIBE_URL}}.`,
                imageBase64: base64,
              },
            });
            if (error) throw error;
            if (data.error) throw new Error(data.error);
            setGeneratedSubject(data.subject || "");
            setGeneratedHtml(data.html || "");
            setPreviewText(data.previewText || "");
            setPrompt(`Uploaded: ${file.name}`);
            setShowPreview(true);
            toast.success("Template converted! Review the preview and refine with AI if needed.");
          } catch (err: any) {
            toast.error(err.message || "Failed to convert file");
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingTemplate(false);
      e.target.value = "";
    }
  };

  const loadCampaignToEditor = (c: any) => {
    setGeneratedSubject(c.subject);
    setGeneratedHtml(c.html_body);
    setPrompt(c.prompt || "");
    setSelectedSegment(c.segment as Segment);
    setShowPreview(true);
    setActiveTab("create");
  };

  const startEditing = (c: any) => {
    loadCampaignToEditor(c);
    setEditingCampaignId(c.id);
    if (c.scheduled_at) {
      const d = new Date(c.scheduled_at);
      setScheduleDate(d);
      setScheduleTime(format(d, "HH:mm"));
      setShowScheduler(true);
    } else {
      setShowScheduler(false);
      setScheduleDate(undefined);
    }
  };

  const cancelEditing = () => {
    setEditingCampaignId(null);
    setShowPreview(false);
    setGeneratedSubject("");
    setGeneratedHtml("");
    setPrompt("");
    setShowScheduler(false);
    setScheduleDate(undefined);
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
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== "create") { setEditingCampaignId(null); } }} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="create" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Create</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5"><FolderOpen className="h-3.5 w-3.5" /> Library</TabsTrigger>
          <TabsTrigger value="roi" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> ROI</TabsTrigger>
          <TabsTrigger value="automations" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Automations</TabsTrigger>
          <TabsTrigger value="sms" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> SMS</TabsTrigger>
        </TabsList>

        {/* ── CREATE TAB ─────────────────────────────── */}
        <TabsContent value="create" className="space-y-6">
          {/* Editing banner */}
          {editingCampaignId && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Editing: <strong>{generatedSubject || "Untitled"}</strong></span>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelEditing} className="gap-1 text-xs">
                <X className="h-3.5 w-3.5" /> Cancel Edit
              </Button>
            </div>
          )}
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

          {/* Upload Template Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Upload a Template</p>
                    <p className="text-xs text-muted-foreground">Import an HTML file directly, or upload a PDF / image and AI will convert it</p>
                  </div>
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept=".html,.htm,.pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleTemplateUpload} disabled={uploadingTemplate} />
                  <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" tabIndex={-1} disabled={uploadingTemplate}>
                    {uploadingTemplate ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Converting...</> : <><Upload className="h-3.5 w-3.5" /> Choose File</>}
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>


          {showPreview && generatedHtml && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg"><Eye className="h-5 w-5" /> Live Preview & Editor</CardTitle>
                  <div className="flex gap-2">
                    {editingCampaignId && (
                      <Button size="sm" onClick={() => updateCampaignMutation.mutate()} disabled={updateCampaignMutation.isPending} className="gap-1.5">
                        {updateCampaignMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
                      </Button>
                    )}
                    {!editingCampaignId && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
                          <Save className="h-3.5 w-3.5 mr-1" /> Save Draft
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => saveTemplateMutation.mutate()} disabled={saveTemplateMutation.isPending}>
                          <BookTemplate className="h-3.5 w-3.5 mr-1" /> Save as Template
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject Line {abEnabled ? "(Variant A)" : ""}</label>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => setAbEnabled(!abEnabled)}>
                      <FlaskConical className="h-3 w-3" />
                      {abEnabled ? "Disable A/B Test" : "A/B Test"}
                    </Button>
                  </div>
                  <Input value={generatedSubject} onChange={e => setGeneratedSubject(e.target.value)} />
                </div>

                {abEnabled && (
                  <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-primary" />
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">A/B Subject Line Test</label>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Variant B Subject</label>
                      <Input value={variantBSubject} onChange={e => setVariantBSubject(e.target.value)} placeholder="Alternative subject line to test..." />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Test group size: {abTestPercentage}% of audience per variant</label>
                      <Input type="range" min={10} max={50} value={abTestPercentage} onChange={e => setAbTestPercentage(Number(e.target.value))} className="h-2" />
                      <p className="text-[10px] text-muted-foreground">
                        {abTestPercentage}% get Variant A, {abTestPercentage}% get Variant B. The remaining {100 - abTestPercentage * 2}% get the winner after 2 hours.
                      </p>
                    </div>
                  </div>
                )}

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
                      <iframe srcDoc={generatedHtml + UNSUBSCRIBE_FOOTER_PREVIEW} className="w-full max-w-[620px] border-0" style={{ minHeight: 600 }} title="Email preview" sandbox="allow-same-origin" />
                    </div>
                  </div>
                  {/* Locked footer notice */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>The unsubscribe footer shown above is <strong>locked</strong> and will be automatically appended to every marketing email. It cannot be edited or removed (GDPR requirement).</span>
                  </div>
                </div>

                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">▸ Edit HTML Source</summary>
                  <Textarea value={generatedHtml} onChange={e => setGeneratedHtml(e.target.value)} className="mt-2 min-h-[200px] font-mono text-xs" />
                </details>

                {/* Visual Tools + AI Refine Section */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                  {/* Quick Tools Row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Tools</span>
                    {/* Colour Picker */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <Palette className="h-3.5 w-3.5" /> Brand Colour
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 space-y-3" align="start">
                        <p className="text-xs font-medium text-muted-foreground">Pick a colour to apply via AI</p>
                        <div className="grid grid-cols-6 gap-2">
                          {["#2D3142","#E8D5B7","#4A90D9","#D94A4A","#4AD97A","#9B59B6","#F39C12","#1ABC9C","#E74C3C","#3498DB","#2C3E50","#F1C40F"].map(color => (
                            <button key={color} className="w-8 h-8 rounded-md border border-border hover:scale-110 transition-transform" style={{ backgroundColor: color }}
                              onClick={() => {
                                setRefineInstruction(`Change the primary/header colour to ${color} and update all related elements to match`);
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input type="color" className="w-10 h-8 p-0.5 cursor-pointer" onChange={e => {
                            setRefineInstruction(`Change the primary/header colour to ${e.target.value} and update all related elements to match`);
                          }} />
                          <span className="text-xs text-muted-foreground self-center">Custom colour</span>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Image Swap */}
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 4 * 1024 * 1024) { toast.error("Image must be under 4MB"); return; }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setRefineImage(reader.result as string);
                          setRefineImageName(file.name);
                          setRefineInstruction("Replace the hero/placeholder image section with this uploaded image. Make it full-width and properly centered.");
                        };
                        reader.readAsDataURL(file);
                      }} />
                      <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" tabIndex={-1}>
                        <ImagePlus className="h-3.5 w-3.5" /> Swap Hero Image
                      </Button>
                    </label>
                  </div>

                  {/* AI Refine */}
                  <div className="space-y-3">
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
                    const excluded = segments[seg.key].filter(c => excludedEmails.has(c.email.toLowerCase())).length;
                    const isActive = selectedSegment === seg.key;
                    return (
                      <Card key={seg.key} className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${isActive ? "ring-2 ring-primary shadow-md" : ""}`} onClick={() => { setSelectedSegment(seg.key); setExcludedEmails(new Set()); }}>
                        <CardContent className="p-4 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Icon className={`h-5 w-5 ${seg.color}`} />
                            {isActive && <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">Selected</span>}
                          </div>
                          <p className="text-2xl font-bold font-heading">{count}</p>
                          <p className="text-sm font-medium">{seg.label}</p>
                          <p className="text-xs text-muted-foreground">{seg.desc}</p>
                          {isActive && (
                            <Button variant="outline" size="sm" className="mt-2 w-full gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); setSegmentListSearch(""); setShowSegmentList(true); }}>
                              <Eye className="h-3 w-3" /> View & Edit List
                              {excluded > 0 && <Badge variant="destructive" className="ml-1 text-[10px] h-4">{excluded} removed</Badge>}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Send / Schedule buttons */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Sending to <strong>{effectiveList.length}</strong> customer{effectiveList.length !== 1 ? "s" : ""}
                    {excludedEmails.size > 0 && <span className="ml-1 text-destructive">({excludedEmails.size} manually removed)</span>}
                    {unsubSet.size > 0 && <span className="ml-1">({unsubSet.size} unsubscribed excluded)</span>}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Popover open={showTestEmail} onOpenChange={setShowTestEmail}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-1.5">
                          <Mail className="h-4 w-4" /> Send Test
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 space-y-3" align="end">
                        <p className="text-sm font-medium">Send a test email</p>
                        <Input
                          type="email"
                          placeholder="Enter email address..."
                          value={testEmail}
                          onChange={e => setTestEmail(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && testEmail.trim()) sendTestMutation.mutate(testEmail); }}
                        />
                        <Button
                          onClick={() => sendTestMutation.mutate(testEmail)}
                          disabled={!testEmail.trim() || sendTestMutation.isPending}
                          className="w-full gap-1.5"
                          size="sm"
                        >
                          {sendTestMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</> : <><Send className="h-3.5 w-3.5" /> Send Test</>}
                        </Button>
                      </PopoverContent>
                    </Popover>
                    <Button variant="outline" onClick={() => setShowScheduler(!showScheduler)} className="gap-1.5">
                      <Clock className="h-4 w-4" /> Schedule
                    </Button>
                    <Button onClick={() => sendMutation.mutate({})} disabled={sendMutation.isPending || effectiveList.length === 0} className="gap-1.5" size="lg">
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
                        {c.status === "sent" && (c as any).unique_opens > 0 && (
                          <span>{(((c as any).unique_opens / c.emails_sent) * 100).toFixed(1)}% opened</span>
                        )}
                        {c.status === "sent" && (c as any).unique_clicks > 0 && (
                          <span>{(((c as any).unique_clicks / c.emails_sent) * 100).toFixed(1)}% clicked</span>
                        )}
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

        {/* ── AUTOMATIONS TAB ─────────────────── */}
        <TabsContent value="automations">
          <AutomationsSection />
        </TabsContent>

        {/* ── SMS TAB ─────────────────── */}
        <TabsContent value="sms">
          <SMSSection />
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

      {/* Segment Customer List Dialog */}
      <Dialog open={showSegmentList} onOpenChange={setShowSegmentList}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {segmentCards.find(s => s.key === selectedSegment)?.label} — {segments[selectedSegment].length} customers
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={segmentListSearch}
              onChange={e => setSegmentListSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          {excludedEmails.size > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-destructive font-medium">{excludedEmails.size} removed from send list</span>
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setExcludedEmails(new Set())}>
                Restore All
              </Button>
            </div>
          )}
          <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
            <div className="space-y-1 pr-3">
              {segments[selectedSegment]
                .filter(c => {
                  const q = segmentListSearch.toLowerCase();
                  return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
                })
                .map(c => {
                  const isExcluded = excludedEmails.has(c.email.toLowerCase());
                  return (
                    <div key={c.email} className={cn("flex items-center justify-between py-2 px-3 rounded-md", isExcluded ? "opacity-50 bg-muted/50" : "hover:bg-accent/50")}>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-medium truncate", isExcluded && "line-through")}>{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                        {c.source === "migrated" && <Badge variant="outline" className="text-[9px] h-4 mt-0.5">Wix</Badge>}
                      </div>
                      <Button
                        variant={isExcluded ? "outline" : "ghost"}
                        size="sm"
                        className={cn("shrink-0 ml-2 h-7", !isExcluded && "text-destructive hover:text-destructive")}
                        onClick={() => {
                          const next = new Set(excludedEmails);
                          const key = c.email.toLowerCase();
                          if (isExcluded) next.delete(key);
                          else next.add(key);
                          setExcludedEmails(next);
                        }}
                      >
                        {isExcluded ? "Restore" : <><XCircle className="h-3.5 w-3.5 mr-1" /> Remove</>}
                      </Button>
                    </div>
                  );
                })}
            </div>
          </ScrollArea>
          <div className="pt-3 border-t flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Will send to <strong>{effectiveList.length}</strong> of {segments[selectedSegment].length}
            </p>
            <Button onClick={() => setShowSegmentList(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
