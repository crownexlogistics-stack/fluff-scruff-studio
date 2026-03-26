import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GroomerLayout } from "@/components/GroomerLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Loader2, Trash2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const conversationStarters = [
  "Who are my customers today?",
  "I got an error — help me report it",
  "What is our cancellation policy?",
  "Show my earnings this month",
  "Find a customer booking for me",
];

export default function GroomerAssistantPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [staffId, setStaffId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("staff").select("id").eq("auth_user_id", user.id).maybeSingle()
      .then(({ data }) => setStaffId(data?.id ?? null));
  }, [user]);

  const storageKey = `groomer-assistant-${staffId || "unknown"}`;

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Re-init messages when staffId changes
  useEffect(() => {
    if (!staffId) return;
    const key = `groomer-assistant-${staffId}`;
    try {
      const stored = localStorage.getItem(key);
      setMessages(stored ? JSON.parse(stored) : []);
    } catch { setMessages([]); }
  }, [staffId]);

  useEffect(() => {
    if (!staffId) return;
    try {
      localStorage.setItem(`groomer-assistant-${staffId}`, JSON.stringify(messages));
    } catch {}
  }, [messages, staffId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = { role: "user", content: text.trim(), timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    const conversationHistory = newMessages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groomer-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ messages: conversationHistory }),
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

      setMessages((prev) => [...prev, { role: "assistant", content: "", timestamp: new Date().toISOString() }]);

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
          } catch {}
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
          } catch {}
        }
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev.filter((m) => m.role !== "assistant" || m.content),
        { role: "assistant", content: `⚠️ Error: ${e.message}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming]);

  const handleNewConversation = () => {
    setMessages([]);
    setInput("");
    if (staffId) localStorage.removeItem(`groomer-assistant-${staffId}`);
  };

  return (
    <GroomerLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/portal")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Groomer Assistant
              </h1>
              <p className="text-xs text-muted-foreground">Your AI helper for bookings, policies & more</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleNewConversation}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> New Chat
            </Button>
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0 border rounded-lg bg-background">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
                <div className="text-center">
                  <Sparkles className="h-10 w-10 mx-auto text-primary/40 mb-3" />
                  <h2 className="text-lg font-semibold mb-1">Hey! How can I help? 🐾</h2>
                  <p className="text-sm text-muted-foreground">Ask me anything about your bookings, customers, or the salon</p>
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
                  <div className={cn(
                    "max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  )}>
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
                      {format(new Date(msg.timestamp), "HH:mm")}
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

          {/* Input */}
          <div className="border-t p-3 shrink-0">
            <div className="flex gap-2 items-end">
              <Textarea
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
                }}
                className="min-h-[2.5rem] max-h-32 resize-none"
                rows={1}
                disabled={isStreaming}
              />
              <Button
                size="icon"
                className="shrink-0 h-9 w-9"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
              >
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </GroomerLayout>
  );
}
