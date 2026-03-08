import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Send, Phone, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getLocalChatResponse,
  detectBreed,
  detectName,
  detectEmail,
  type ConversationState,
  type NavLink,
} from "@/lib/chatRules";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  show_booking_button?: boolean;
  show_call_button?: boolean;
  show_whatsapp_button?: boolean;
  nav_links?: NavLink[];
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
  "🐶 What breed do I have?",
  "💰 Pricing info",
];

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Conversation state machine
  const [conversationState, setConversationState] = useState<ConversationState>("idle");

  // Conversation memory
  const [breedMentioned, setBreedMentioned] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);

  // Proactive suggestion — show only once
  const [proactiveSuggestionShown, setProactiveSuggestionShown] = useState(false);
  const [bookingTapped, setBookingTapped] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Only scroll to bottom when a NEW message is added, not on initial open
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      scrollToBottom();
    }
    prevMessageCount.current = messages.length;
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isTyping) scrollToBottom();
  }, [isTyping, scrollToBottom]);

  // Scroll to TOP when chat opens
  useEffect(() => {
    if (isOpen && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  // Personalise reply with breed/name memory
  const personalise = (reply: string, currentBreed: string | null): string => {
    let r = reply;
    const breed = currentBreed || breedMentioned;
    if (breed) {
      r = r.replace(/\byour dog\b/gi, `your ${breed}`);
      r = r.replace(/\byour pup\b/gi, `your ${breed}`);
    }
    if (customerName) {
      if (!r.startsWith("Great question") && !r.includes(customerName)) {
        r = `Great question ${customerName}! ${r}`;
      }
    }
    return r;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setShowQuickReplies(false);

    // Detect breed / name from user message
    const detectedBreed = detectBreed(text);
    if (detectedBreed) setBreedMentioned(detectedBreed);
    const detectedNameVal = detectName(text);
    if (detectedNameVal) setCustomerName(detectedNameVal);

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
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Handle contact details collection state in the widget
      if (conversationState === "waiting_for_contact_details") {
        const email = detectEmail(text);
        const name = detectName(text);
        if (name) setCustomerName(name);

        if (email) {
          // Build conversation history
          const allMsgs = [...messages, userMsg];
          const convoHistory = allMsgs
            .map((m) => `${m.role === "user" ? "Customer" : "Scruff"}: ${m.content}`)
            .join("\n");

          const finalName = name || customerName || "Not provided";

          const body = `A customer contacted Fluff & Scruff via the website chat assistant but Scruff was unable to resolve their query.\n\nCustomer name: ${finalName}\nCustomer email: ${email}\n\nOriginal conversation:\n${convoHistory}\n\nPlease respond to the customer directly.`;

          try {
            await supabase.functions.invoke("send-customer-email", {
              body: {
                customer_email: "info@fluffandscruff.co.uk",
                subject: "💬 Scruff couldn't help — customer needs assistance",
                body,
              },
            });
          } catch (e) {
            console.error("Failed to send escalation email:", e);
          }

          const confirmMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Perfect, I've passed this to the team at Fluff & Scruff! They'll be in touch at ${email} very soon 🐾`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, confirmMsg]);
          setConversationState("idle");
        } else {
          // No email found, ask again
          const retryMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "I just need your email address so the team can get back to you — could you pop it in below? 🐾",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, retryMsg]);
        }
        return;
      }

      // Normal flow — pass current state to rule engine
      const data = await getLocalChatResponse(text.trim(), conversationState);

      // Update conversation state
      if (data.new_state) {
        setConversationState(data.new_state);
      } else {
        setConversationState("idle");
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: personalise(data.reply, detectedBreed),
        timestamp: new Date(),
        show_booking_button: data.show_booking_button,
        show_call_button: data.show_call_button,
        show_whatsapp_button: data.show_whatsapp_button,
        nav_links: data.nav_links,
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

  // Should we show the proactive suggestion?
  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const shouldShowProactive =
    !proactiveSuggestionShown && !bookingTapped && userMsgCount >= 3;

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
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
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

                  {/* Nav link buttons */}
                  {msg.role === "assistant" && msg.nav_links && msg.nav_links.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 pl-9">
                      {msg.nav_links.map((link) =>
                        link.external ? (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold px-3 py-1.5 rounded-full text-white inline-flex items-center gap-1"
                            style={{ background: "#FF6B35", fontFamily: "Nunito, sans-serif" }}
                          >
                            {link.label} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <button
                            key={link.url}
                            onClick={() => {
                              setBookingTapped(true);
                              setIsOpen(false);
                              navigate(link.url);
                            }}
                            className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
                            style={{ background: "#FF6B35", fontFamily: "Nunito, sans-serif" }}
                          >
                            {link.label}
                          </button>
                        )
                      )}
                    </div>
                  )}

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

                  {/* Proactive suggestion — once per convo, after 3+ user messages */}
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
                placeholder={
                  conversationState === "waiting_for_breed"
                    ? "Type your breed name..."
                    : conversationState === "waiting_for_contact_details"
                    ? "Your name and email..."
                    : "Ask Scruff anything..."
                }
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
