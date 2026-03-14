import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Phone, Minus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  show_booking_button?: boolean;
  show_call_button?: boolean;
  show_whatsapp_button?: boolean;
}

interface ConversationContext {
  customerName: string | null;
  dogName: string | null;
  breed: string | null;
  serviceInterest: string | null;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Woof! 👋 I'm Scruff, your grooming assistant! I can help with breed advice, check availability, or answer any questions about Fluff & Scruff Studio. What can I help you with today? 🐾",
  timestamp: new Date(),
};

const QUICK_REPLIES = [
  "📅 Check availability",
  "💰 Pricing",
  "✂️ Our services",
];

const SESSION_KEY = "scruff-chat-session";
const GREETED_KEY = "scruff-greeted";
const PROMO_SHOWN_KEY = "scruff-promo-shown";

function loadSession(): { messages: ChatMessage[]; context: ConversationContext; lastActiveAt: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      messages: parsed.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
    };
  } catch {
    return null;
  }
}

function saveSession(messages: ChatMessage[], context: ConversationContext) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ messages, context, lastActiveAt: Date.now() }));
  } catch {}
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

export function AIChatWidget() {
  const SCRUFF_ENABLED = true;
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Load persisted session
  const savedSession = useRef(loadSession());

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(
    savedSession.current?.messages || [WELCOME_MESSAGE]
  );
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(
    !savedSession.current || savedSession.current.messages.length <= 1
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showPromoBubble, setShowPromoBubble] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageCount = useRef(messages.length);

  const [sessionId] = useState(() => crypto.randomUUID());
  const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";

  const [context, setContext] = useState<ConversationContext>(
    savedSession.current?.context || {
      customerName: null,
      dogName: null,
      breed: null,
      serviceInterest: null,
    }
  );

  const [proactiveSuggestionShown, setProactiveSuggestionShown] = useState(false);
  const [bookingTapped, setBookingTapped] = useState(false);

  // Persist session on message/context changes
  useEffect(() => {
    saveSession(messages, context);
  }, [messages, context]);

  // Welcome back message if >5 min gap
  const welcomeBackShown = useRef(false);
  useEffect(() => {
    if (isOpen && savedSession.current && !welcomeBackShown.current) {
      const gap = Date.now() - savedSession.current.lastActiveAt;
      if (gap > 5 * 60 * 1000 && messages.length > 1) {
        welcomeBackShown.current = true;
        setMessages((prev) => [
          ...prev,
          {
            id: "welcome-back-" + Date.now(),
            role: "assistant",
            content: "Welcome back! Continuing our chat 🐾",
            timestamp: new Date(),
          },
        ]);
      }
    }
  }, [isOpen]);

  // Lock body scroll on mobile when chat open
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isMobile, isOpen]);

  // Promo bubble after 30s (once per session)
  useEffect(() => {
    if (sessionStorage.getItem(PROMO_SHOWN_KEY)) return;
    const timer = setTimeout(() => {
      if (!isOpen) {
        setShowPromoBubble(true);
        sessionStorage.setItem(PROMO_SHOWN_KEY, "1");
        setTimeout(() => setShowPromoBubble(false), 5000);
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      scrollToBottom();
      // If chat not open, count as unread
      if (!isOpen && messages[messages.length - 1]?.role === "assistant") {
        setUnreadCount((c) => c + 1);
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages, scrollToBottom, isOpen]);

  useEffect(() => {
    if (isTyping) scrollToBottom();
  }, [isTyping, scrollToBottom]);

  // Clear unread when opening
  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  const extractContext = (text: string) => {
    const lower = text.toLowerCase();
    const dogNameMatch = text.match(
      /(?:my dog(?:'s name)?\s+(?:is\s+)?|my\s+(?:pup|puppy|boy|girl)(?:'s name)?\s+(?:is\s+)?|(?:called|named)\s+)([A-Z][a-z]+)/i
    );
    if (dogNameMatch) setContext((prev) => ({ ...prev, dogName: dogNameMatch[1] }));
    const nameMatch = text.match(/(?:my name is|i'm|i am|this is|call me)\s+([A-Z][a-z]+)/i);
    if (nameMatch) setContext((prev) => ({ ...prev, customerName: nameMatch[1] }));
    if (/nail|claw/i.test(lower)) setContext((prev) => ({ ...prev, serviceInterest: "nail trim" }));
    else if (/teeth|dental|ultrasonic/i.test(lower)) setContext((prev) => ({ ...prev, serviceInterest: "teeth cleaning" }));
    else if (/puppy|first.?groom/i.test(lower)) setContext((prev) => ({ ...prev, serviceInterest: "puppy groom" }));
    else if (/bath|wash/i.test(lower)) setContext((prev) => ({ ...prev, serviceInterest: "bath and blow dry" }));
    else if (/full groom|groom/i.test(lower)) setContext((prev) => ({ ...prev, serviceInterest: "full groom" }));
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setShowQuickReplies(false);
    extractContext(text);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const conversationHistory = messages
        .filter((m) => m.id !== "welcome" && !m.id.startsWith("welcome-back"))
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("ai-grooming-assistant", {
        body: {
          message: text.trim(),
          conversation: conversationHistory,
          context,
          session_id: sessionId,
          device_type: deviceType,
          page_url: window.location.pathname,
        },
      });

      if (error) throw error;

      if (data.detected_breed) {
        setContext((prev) => ({ ...prev, breed: data.detected_breed }));
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
        show_booking_button: data.show_booking_button,
        show_call_button: data.show_call_button,
        show_whatsapp_button: data.show_whatsapp_button,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Oops, I got a bit tangled up! 🐾 Please try again, or give us a call on 01708 606655.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleMinimise = () => {
    setIsOpen(false);
    setShowCloseConfirm(false);
  };

  const handleCloseRequest = () => {
    setShowCloseConfirm(true);
  };

  const handleEndChat = () => {
    clearSession();
    setMessages([WELCOME_MESSAGE]);
    setContext({ customerName: null, dogName: null, breed: null, serviceInterest: null });
    setShowQuickReplies(true);
    setShowCloseConfirm(false);
    setIsOpen(false);
    setUnreadCount(0);
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const shouldShowProactive = !proactiveSuggestionShown && !bookingTapped && userMsgCount >= 3;

  if (!SCRUFF_ENABLED) return null;

  // Animation variants
  const panelVariants = isMobile
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
    : { initial: { y: 40, opacity: 0, scale: 0.95 }, animate: { y: 0, opacity: 1, scale: 1 }, exit: { y: 40, opacity: 0, scale: 0.95 } };

  const panelTransition = isMobile
    ? { type: "tween" as const, duration: 0.3, ease: [0, 0, 0.2, 1] as const }
    : { type: "spring" as const, stiffness: 400, damping: 30 };

  return (
    <>
      {/* Floating bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            className="fixed z-50"
            style={{ bottom: 80, right: 20 }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            {/* Promo bubble */}
            <AnimatePresence>
              {showPromoBubble && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold shadow-lg"
                  style={{
                    background: "#fff",
                    color: "#2D1B0E",
                    fontFamily: "Nunito, sans-serif",
                    border: "1px solid #e8d8ca",
                  }}
                >
                  Hi! 👋 Need help? I'm Scruff!
                  <div className="absolute bottom-0 right-5 translate-y-1/2 rotate-45 w-2 h-2 bg-white border-r border-b" style={{ borderColor: "#e8d8ca" }} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Unread badge */}
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
              >
                {unreadCount}
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(255,107,53,0.4)",
                  "0 0 0 12px rgba(255,107,53,0)",
                ],
              }}
              transition={{
                boxShadow: { repeat: Infinity, duration: 8, repeatDelay: 0 },
              }}
              onClick={() => { setIsOpen(true); setShowPromoBubble(false); }}
              className="flex items-center justify-center"
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#FF6B35",
              }}
              title="Chat with Scruff 🐾"
            >
              <span className="text-2xl">🐾</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            {...panelVariants}
            transition={panelTransition}
            className={`fixed z-50 flex flex-col overflow-hidden ${
              isMobile
                ? "inset-0"
                : "shadow-2xl"
            }`}
            style={
              isMobile
                ? { background: "#FFFAF4" }
                : {
                    bottom: 16,
                    right: 16,
                    width: 420,
                    height: "85vh",
                    maxHeight: 700,
                    borderRadius: "24px 24px 16px 16px",
                    background: "#FFFAF4",
                  }
            }
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3 shrink-0"
              style={{ background: "#FF6B35" }}
            >
              <div className="relative w-9 h-9 rounded-full bg-white flex items-center justify-center text-lg shrink-0">
                🐶
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                  style={{ background: "#4ADE80", borderColor: "#FF6B35" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-white font-bold text-lg leading-tight"
                  style={{ fontFamily: "'Fredoka One', cursive" }}
                >
                  Scruff
                </div>
                <div
                  className="text-white/80 text-xs"
                  style={{ fontFamily: "Nunito, sans-serif" }}
                >
                  Fluff & Scruff Assistant
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleMinimise}
                  className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
                  title="Minimise"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCloseRequest}
                  className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Close confirmation overlay */}
            <AnimatePresence>
              {showCloseConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex items-center justify-center px-6"
                  style={{ background: "rgba(45,27,14,0.6)", backdropFilter: "blur(4px)" }}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="rounded-2xl p-5 text-center max-w-xs w-full shadow-xl"
                    style={{ background: "#FFFAF4" }}
                  >
                    <p className="text-sm font-semibold mb-1" style={{ color: "#2D1B0E", fontFamily: "Nunito, sans-serif" }}>
                      End this chat?
                    </p>
                    <p className="text-xs mb-4" style={{ color: "#A89585", fontFamily: "Nunito, sans-serif" }}>
                      Your conversation will be saved if you want to come back 🐾
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => setShowCloseConfirm(false)}
                        className="text-xs font-bold px-4 py-2 rounded-full text-white"
                        style={{ background: "#FF6B35" }}
                      >
                        Keep chatting
                      </button>
                      <button
                        onClick={handleEndChat}
                        className="text-xs font-bold px-4 py-2 rounded-full border"
                        style={{ borderColor: "#e8d8ca", color: "#A89585" }}
                      >
                        End chat
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg, idx) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className={`flex items-end gap-2 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-sm shrink-0 shadow-sm">
                        🐶
                      </div>
                    )}
                    <div
                      className="max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed"
                      style={
                        msg.role === "user"
                          ? {
                              background: "#FF6B35",
                              color: "#fff",
                              borderRadius: "18px 18px 4px 18px",
                              fontFamily: "Nunito, sans-serif",
                            }
                          : {
                              background: "#fff",
                              color: "#2D1B0E",
                              borderRadius: "18px 18px 18px 4px",
                              fontFamily: "Nunito, sans-serif",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                            }
                      }
                    >
                      {msg.content}
                    </div>
                  </div>
                  <div
                    className={`text-[10px] mt-1 ${
                      msg.role === "user" ? "text-right" : "text-left pl-9"
                    }`}
                    style={{ color: "#A89585" }}
                  >
                    {formatTime(msg.timestamp)}
                  </div>

                  {/* Action buttons */}
                  {msg.role === "assistant" &&
                    (msg.show_booking_button || msg.show_call_button || msg.show_whatsapp_button) && (
                      <div className="flex flex-wrap gap-2 mt-2 pl-9">
                        {msg.show_booking_button && (
                          <button
                            onClick={() => {
                              setBookingTapped(true);
                              handleMinimise();
                              navigate("/book");
                            }}
                            className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
                            style={{ background: "#FF6B35", fontFamily: "Nunito, sans-serif" }}
                          >
                            Book Now 🐾
                          </button>
                        )}
                        {msg.show_whatsapp_button && (
                          <a
                            href="https://wa.me/447476452782"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold px-3 py-1.5 rounded-full text-white inline-flex items-center gap-1"
                            style={{ background: "#25D366" }}
                          >
                            WhatsApp Us 💬
                          </a>
                        )}
                        {msg.show_call_button && (
                          <a
                            href="tel:01708606655"
                            className="text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1"
                            style={{ background: "#E8D8CA", color: "#2D1B0E" }}
                          >
                            <Phone className="w-3 h-3" /> Call Us
                          </a>
                        )}
                      </div>
                    )}

                  {/* Proactive suggestion */}
                  {msg.role === "assistant" && idx === messages.length - 1 && shouldShowProactive && (
                    <div className="pl-9 mt-2">
                      <p
                        className="text-[11px] italic"
                        style={{ color: "#A89585", fontFamily: "Nunito, sans-serif" }}
                      >
                        Ready to book? It only takes 2 minutes 🐾{" "}
                        <button
                          onClick={() => {
                            setBookingTapped(true);
                            setProactiveSuggestionShown(true);
                            handleMinimise();
                            navigate("/book");
                          }}
                          className="font-bold not-italic underline"
                          style={{ color: "#FF6B35" }}
                        >
                          Book now →
                        </button>
                      </p>
                      {(() => {
                        if (!proactiveSuggestionShown) {
                          setTimeout(() => setProactiveSuggestionShown(true), 0);
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Quick replies */}
              {showQuickReplies && messages.length <= 1 && (
                <div className="flex flex-wrap gap-2 pl-9">
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr}
                      onClick={() => sendMessage(qr)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors hover:bg-orange-50"
                      style={{
                        borderColor: "#FF6B35",
                        color: "#FF6B35",
                        fontFamily: "Nunito, sans-serif",
                      }}
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-sm shrink-0 shadow-sm">
                    🐶
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-white shadow-sm flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{ background: "#A89585" }}
                        animate={{ y: [0, -6, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              className="shrink-0 flex flex-col px-3 py-3 gap-2"
              style={{ borderTop: "1px solid #e8d8ca", background: "#fff" }}
            >
              {/* Quick replies above input at start */}
              {showQuickReplies && messages.length <= 1 && isMobile && (
                <div className="flex flex-wrap gap-2">
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr}
                      onClick={() => sendMessage(qr)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors hover:bg-orange-50"
                      style={{
                        borderColor: "#FF6B35",
                        color: "#FF6B35",
                        fontFamily: "Nunito, sans-serif",
                      }}
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                  placeholder="Message Scruff..."
                  className="flex-1 text-sm px-3 py-2 rounded-full border-none outline-none"
                  style={{
                    background: "#F5EDE4",
                    color: "#2D1B0E",
                    fontFamily: "Nunito, sans-serif",
                  }}
                  disabled={isTyping}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isTyping}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition-opacity"
                  style={{ background: "#FF6B35" }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
