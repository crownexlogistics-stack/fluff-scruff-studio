import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  const [status, setStatus] = useState<"loading" | "unsubscribed" | "resubscribed" | "error" | "invalid">("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!email) {
      setStatus("invalid");
      return;
    }
    handleUnsubscribe();
  }, [email]);

  const handleUnsubscribe = async () => {
    if (!email) return;
    try {
      // Upsert into email_unsubscribes (anon INSERT policy allows this)
      const { error } = await supabase
        .from("email_unsubscribes")
        .upsert({ email: email.toLowerCase().trim() }, { onConflict: "email" });
      if (error) throw error;
      setStatus("unsubscribed");
    } catch (err) {
      console.error("Unsubscribe error:", err);
      setStatus("error");
    }
  };

  const handleResubscribe = async () => {
    if (!email) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("email_unsubscribes")
        .delete()
        .eq("email", email.toLowerCase().trim());
      if (error) throw error;
      setStatus("resubscribed");
    } catch (err) {
      console.error("Resubscribe error:", err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{
      fontFamily: "'Georgia', serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      margin: 0,
      background: "#FFFAF4",
    }}>
      <div style={{
        textAlign: "center",
        padding: "48px 32px",
        maxWidth: "480px",
        width: "100%",
      }}>
        {/* Logo / Brand */}
        <div style={{ fontSize: "56px", marginBottom: "16px" }}>🐾</div>
        <h1 style={{
          color: "#2D3142",
          fontSize: "24px",
          fontWeight: "bold",
          marginBottom: "8px",
          fontFamily: "'Georgia', serif",
        }}>
          Fluff & Scruff Studio
        </h1>

        {status === "loading" && (
          <div style={{ marginTop: "32px" }}>
            <p style={{ color: "#666", fontSize: "16px", lineHeight: 1.6 }}>
              Processing your request...
            </p>
          </div>
        )}

        {status === "invalid" && (
          <div style={{ marginTop: "32px" }}>
            <p style={{ color: "#666", fontSize: "16px", lineHeight: 1.6 }}>
              Invalid unsubscribe link. Please check the link and try again.
            </p>
          </div>
        )}

        {status === "error" && (
          <div style={{ marginTop: "32px" }}>
            <p style={{ color: "#666", fontSize: "16px", lineHeight: 1.6 }}>
              Something went wrong. Please try again or contact us at{" "}
              <a href="mailto:info@fluffandscruff.co.uk" style={{ color: "#FF6B35" }}>
                info@fluffandscruff.co.uk
              </a>
            </p>
          </div>
        )}

        {status === "unsubscribed" && (
          <div style={{ marginTop: "32px" }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "#E8F5E9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: "28px",
            }}>
              ✓
            </div>
            <h2 style={{
              color: "#2D3142",
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "12px",
            }}>
              You've been unsubscribed
            </h2>
            <p style={{
              color: "#666",
              fontSize: "15px",
              lineHeight: 1.7,
              marginBottom: "32px",
            }}>
              You will no longer receive marketing emails from Fluff & Scruff Studio.
              <br />
              <span style={{ fontSize: "13px", color: "#999" }}>
                Booking confirmations and reminders are not affected.
              </span>
            </p>
            <button
              onClick={handleResubscribe}
              disabled={processing}
              style={{
                background: "none",
                border: "2px solid #FF6B35",
                color: "#FF6B35",
                padding: "10px 28px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: processing ? "not-allowed" : "pointer",
                opacity: processing ? 0.6 : 1,
                fontFamily: "'Arial', sans-serif",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!processing) {
                  e.currentTarget.style.background = "#FF6B35";
                  e.currentTarget.style.color = "#fff";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.color = "#FF6B35";
              }}
            >
              {processing ? "Processing..." : "Changed your mind? Resubscribe"}
            </button>
          </div>
        )}

        {status === "resubscribed" && (
          <div style={{ marginTop: "32px" }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "#FFF3E0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: "28px",
            }}>
              🎉
            </div>
            <h2 style={{
              color: "#2D3142",
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "12px",
            }}>
              Welcome back!
            </h2>
            <p style={{
              color: "#666",
              fontSize: "15px",
              lineHeight: 1.7,
            }}>
              You've been resubscribed and will receive our marketing emails again.
            </p>
          </div>
        )}

        <div style={{
          marginTop: "48px",
          paddingTop: "24px",
          borderTop: "1px solid #E8D5B7",
        }}>
          <p style={{ color: "#999", fontSize: "12px", lineHeight: 1.6 }}>
            138 Hillview Avenue, Hornchurch RM11 2DL
            <br />
            01708 606655 • info@fluffandscruff.co.uk
          </p>
        </div>
      </div>
    </div>
  );
}
