import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send, Sparkles, Plus, Paperclip, X, Loader2,
  CalendarCheck, AlertTriangle, PoundSterling, Users,
  Package, BarChart3, UserPlus, ShieldAlert, CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { StripeTransactionsTab } from "@/components/director/StripeTransactionsTab";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imagePreview?: string;
  fileName?: string;
}

const quickActions = [
  { label: "Today's bookings summary", icon: CalendarCheck },
  { label: "Who has unpaid deposits right now?", icon: AlertTriangle },
  { label: "Show this week's revenue breakdown", icon: PoundSterling },
  { label: "Check groomer performance this month", icon: Users },
  { label: "Any suspicious payment activity?", icon: ShieldAlert },
  { label: "Show active package deals", icon: Package },
  { label: "How are my marketing campaigns performing?", icon: BarChart3 },
  { label: "Show new customers this week", icon: UserPlus },
];

const conversationStarters = [
  "What's happening in the salon today?",
  "Show me any payments that look suspicious",
  "How are my groomers performing this month?",
  "Which customers haven't been back in 3 months?",
];

export default function DirectorAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState("assistant");
  const [attachment, setAttachment] = useState<{
    file: File;
    preview?: string;
    base64?: string;
    mediaType?: string;
    textContent?: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileSelect = useCallback(async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isCsv = file.name.endsWith(".csv");

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        setAttachment({ file, preview: dataUrl, base64, mediaType: file.type });
      };
      reader.readAsDataURL(file);
    } else if (isCsv) {
      const text = await file.text();
      setAttachment({ file, textContent: text.slice(0, 10000) });
    } else {
      setAttachment({ file, textContent: "[PDF uploaded — content extraction not available in browser. Describe what you'd like me to check.]" });
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() && !attachment) return;
    if (isStreaming) return;

    // Switch to assistant tab when sending
    setActiveTab("assistant");

    const userMsg: Message = {
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
      imagePreview: attachment?.preview,
      fileName: attachment?.file?.name,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    const conversationHistory = newMessages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const body: any = { messages: conversationHistory };
      if (attachment?.base64) {
        body.imageBase64 = attachment.base64;
        body.imageMediaType = attachment.mediaType;
      }
      if (attachment?.textContent) {
        body.fileContent = attachment.textContent;
      }
      setAttachment(null);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/director-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to get response");
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "", timestamp: new Date() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              assistantContent += parsed.delta.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: assistantContent };
                return updated;
              });
            }
          } catch { /* partial JSON */ }
        }
      }

      if (buffer.trim()) {
        for (const raw of buffer.split("\n")) {
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              assistantContent += parsed.delta.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: assistantContent };
                return updated;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev.filter((m) => m.role !== "assistant" || m.content),
        { role: "assistant", content: `⚠️ Error: ${e.message}`, timestamp: new Date() },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [messages, attachment, isStreaming]);

  const handleNewConversation = () => {
    setMessages([]);
    setInput("");
    setAttachment(null);
  };

  const handleInvestigate = (message: string) => {
    sendMessage(message);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 h-[calc(100vh-3.5rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Director's Assistant
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your private AI analyst with live salon data
            </p>
          </div>
          {activeTab === "assistant" && messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleNewConversation}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Conversation
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-fit shrink-0 mb-3">
            <TabsTrigger value="assistant" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI Assistant
            </TabsTrigger>
            <TabsTrigger value="stripe" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Stripe Transactions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assistant" className="flex-1 min-h-0 mt-0">
            <div className="flex gap-4 h-full">
              {/* Chat column */}
              <div className="flex-1 flex flex-col min-w-0 border rounded-lg bg-background">
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
                      <div className="text-center">
                        <Sparkles className="h-10 w-10 mx-auto text-primary/40 mb-3" />
                        <h2 className="text-lg font-semibold mb-1">Good morning, Sevak</h2>
                        <p className="text-sm text-muted-foreground">Ask me anything about your salon</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                        {conversationStarters.map((starter) => (
                          <button
                            key={starter}
                            onClick={() => sendMessage(starter)}
                            className="text-left text-sm p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            {starter}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md"
                          )}
                        >
                          {msg.imagePreview && (
                            <img src={msg.imagePreview} alt="Attached" className="max-w-48 rounded-lg mb-2" />
                          )}
                          {msg.fileName && !msg.imagePreview && (
                            <div className="text-xs opacity-70 mb-1">📎 {msg.fileName}</div>
                          )}
                          {msg.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              <ReactMarkdown>{msg.content || "..."}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          )}
                          <p className={cn(
                            "text-[10px] mt-1.5",
                            msg.role === "user" ? "text-primary-foreground/50" : "text-muted-foreground"
                          )}>
                            {format(msg.timestamp, "HH:mm")}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input area */}
                <div className="border-t p-3 shrink-0">
                  {attachment && (
                    <div className="flex items-center gap-2 mb-2 p-2 bg-muted/50 rounded-md text-xs">
                      {attachment.preview ? (
                        <img src={attachment.preview} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <span>📎</span>
                      )}
                      <span className="truncate flex-1">{attachment.file.name}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setAttachment(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2 items-end">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,.csv,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelect(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-9 w-9"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isStreaming}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Textarea
                      placeholder="Ask about your salon..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(input);
                        }
                      }}
                      className="min-h-[2.5rem] max-h-32 resize-none"
                      rows={1}
                      disabled={isStreaming}
                    />
                    <Button
                      size="icon"
                      className="shrink-0 h-9 w-9"
                      onClick={() => sendMessage(input)}
                      disabled={(!input.trim() && !attachment) || isStreaming}
                    >
                      {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="hidden lg:flex w-64 flex-col gap-2 shrink-0">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Quick Actions
                </h3>
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.label)}
                    disabled={isStreaming}
                    className="flex items-center gap-2.5 text-left text-sm p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    <action.icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="leading-tight">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stripe" className="flex-1 min-h-0 mt-0 overflow-y-auto">
            <StripeTransactionsTab onInvestigate={handleInvestigate} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
