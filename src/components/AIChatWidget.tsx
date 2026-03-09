import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Send, Phone, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
  "🐶 Breed grooming advice",
  "💰 Pricing info",
];

export function AIChatWidget() {
  const SCRUFF_ENABLED = true;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Session tracking
  const [sessionId] = useState(() => crypto.randomUUID());
  const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";

  // Conversation context memory
  const [context, setContext] = useState<ConversationContext>({
    customerName: null,
    dogName: null,
    breed: null,
    serviceInterest: null,
  });

  // Proactive suggestion
  const [proactiveSuggestionShown, setProactiveSuggestionShown] = useState(false);
  const [bookingTapped, setBookingTapped] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      scrollToBottom();
    }
    prevMessageCount.current = messages.length;
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isTyping) scrollToBottom();
  }, [isTyping, scrollToBottom]);

  useEffect(() => {
    if (isOpen && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  // Extract context from user messages
  const extractContext = (text: string) => {
    const lower = text.toLowerCase();

    // Detect dog name patterns
    const dogNameMatch = text.match(
      /(?:my dog(?:'s name)?\s+(?:is\s+)?|my\s+(?:pup|puppy|boy|girl)(?:'s name)?\s+(?:is\s+)?|(?:called|named)\s+)([A-Z][a-z]+)/i
    );
    if (dogNameMatch) {
      setContext((prev) => ({ ...prev, dogName: dogNameMatch[1] }));
    }

    // Detect customer name
    const nameMatch = text.match(
      /(?:my name is|i'm|i am|this is|call me)\s+([A-Z][a-z]+)/i
    );
    if (nameMatch) {
      setContext((prev) => ({ ...prev, customerName: nameMatch[1] }));
    }

    // Detect service interest
    if (/nail|claw/i.test(lower)) setContext((prev) => ({ ...prev, serviceInterest: "nail trim" }));
    else if (/teeth|dental|ultrasonic/i.test(lower)) setContext((prev) => ({ ...prev, serviceInterest: "teeth cleaning" }));
    else if (/puppy|first.?groom/i.test(lower)) setContext((prev) => ({ ...prev, serviceInterest: "puppy groom" }));
    else if (/bath|wash/i.test(lower)) setContext((prev) => ({ ...prev, serviceInterest: "bath and blow dry" }));
    else if (/full groom|groom/i.test(lower)) setContext((prev) => ({ ...prev, serviceInterest: "full groom" }));
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setShowQuickReplies(false);

    // Extract context from user message
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
      // Build conversation history (exclude welcome message for cleaner context)
      const conversationHistory = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("ai-grooming-assistant", {
        body: {
          message: text.trim(),
          conversation: conversationHistory,
          context,
        },
      });

      if (error) throw error;

      // Update context from edge function response
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
          content:
            "Oops, I got a bit tangled up! 🐾 Please try again, or give us a call on 01708 606655.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const shouldShowProactive =
    !proactiveSuggestionShown && !bookingTapped && userMsgCount >= 3;

  if (!SCRUFF_ENABLED) return null;

  return (
    <>
      {/* Floating bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed z-50 flex items-center justify-center shadow-lg"
            style={{
              bottom: 100,
              right: 16,
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#FF6B35",
            }}
            title="Chat with Scruff 🐾"
          >
            <span className="text-2xl">🐾</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed z-50 flex flex-col overflow-hidden shadow-2xl"
            style={{
              bottom: 16,
              right: 16,
              width: "min(340px, calc(100vw - 32px))",
              height: 500,
              borderRadius: "24px 24px 16px 16px",
              background: "#FFFAF4",
            }}
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
                  style={{
                    background: "#4ADE80",
                    borderColor: "#FF6B35",
                  }}
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
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg, idx) => (
                <div key={msg.id}>
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
                    (msg.show_booking_button ||
                      msg.show_call_button ||
                      msg.show_whatsapp_button) && (
                      <div className="flex flex-wrap gap-2 mt-2 pl-9">
                        {msg.show_booking_button && (
                          <button
                            onClick={() => {
                              setBookingTapped(true);
                              setIsOpen(false);
                              navigate("/book");
                            }}
                            className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
                            style={{
                              background: "#FF6B35",
                              fontFamily: "Nunito, sans-serif",
                            }}
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
                            style={{
                              background: "#E8D8CA",
                              color: "#2D1B0E",
                            }}
                          >
                            <Phone className="w-3 h-3" /> Call Us
                          </a>
                        )}
                      </div>
                    )}

                  {/* Proactive suggestion */}
                  {msg.role === "assistant" &&
                    idx === messages.length - 1 &&
                    shouldShowProactive && (
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
                              setIsOpen(false);
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
                </div>
              ))}

              {/* Quick replies */}
              {showQuickReplies && messages.length === 1 && (
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
                        transition={{
                          repeat: Infinity,
                          duration: 0.6,
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              className="shrink-0 flex items-center gap-2 px-3 py-3"
              style={{ borderTop: "1px solid #e8d8ca", background: "#fff" }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                placeholder="Ask Scruff anything..."
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
