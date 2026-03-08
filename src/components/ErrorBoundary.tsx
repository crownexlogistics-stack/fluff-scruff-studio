import React from "react";
import { supabase } from "@/integrations/supabase/client";

function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  return `${browser} — ${ua}`;
}

function getDeviceInfo(): string {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const type = w < 768 ? "Mobile" : w < 1024 ? "Tablet" : "Desktop";
  return `${type} — ${w}x${h} — ${navigator.platform}`;
}

async function reportErrorSilently(error: Error, pageUrl: string) {
  const browserInfo = getBrowserInfo();
  const deviceInfo = getDeviceInfo();

  try {
    await supabase.from("error_reports" as any).insert({
      error_description: `${error.name}: ${error.message}`,
      steps_to_reproduce: error.stack || "No stack trace available",
      page_url: pageUrl,
      browser_info: browserInfo,
      device_info: deviceInfo,
      status: "new",
    } as any);
  } catch {}

  try {
    await supabase.functions.invoke("send-customer-email", {
      body: {
        customer_email: "info@fluffandscruff.co.uk",
        subject: "🚨 Auto Error Report — Fluff & Scruff",
        body: `Automatic Error Report\n\nTime: ${new Date().toLocaleString("en-GB")}\nPage: ${pageUrl}\nError: ${error.name}: ${error.message}\n\nStack Trace:\n${error.stack || "N/A"}\n\nBrowser: ${browserInfo}\nDevice: ${deviceInfo}`,
      },
    });
  } catch {}
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    reportErrorSilently(error, window.location.href);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center p-6"
          style={{ background: "#FFFAF4" }}
        >
          <div className="text-center max-w-md space-y-5">
            <p className="text-6xl">🐾</p>
            <h1
              style={{
                fontFamily: "'Fredoka One', cursive",
                color: "#2D1B0E",
                fontSize: "26px",
              }}
            >
              Oops, something went wrong! 🐾
            </h1>
            <p
              style={{
                fontFamily: "Nunito, sans-serif",
                color: "#8B6F5C",
                fontSize: "15px",
              }}
            >
              Don't worry — we've been notified and will fix it right away
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 text-white font-bold text-sm rounded-full"
                style={{
                  background: "#FF6B35",
                  fontFamily: "Nunito, sans-serif",
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="px-6 py-3 font-bold text-sm rounded-full border-2"
                style={{
                  borderColor: "#FF6B35",
                  color: "#FF6B35",
                  fontFamily: "Nunito, sans-serif",
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { reportErrorSilently };
