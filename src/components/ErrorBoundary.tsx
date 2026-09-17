import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
          className="min-h-screen flex items-center justify-center bg-background p-6"
        >
          <div className="text-center max-w-md space-y-5">
            <p className="text-6xl">🐾</p>
            <h1
              className="font-heading text-2xl text-foreground"
            >
              Oops, something went wrong! 🐾
            </h1>
            <p
              className="font-body text-sm text-muted-foreground"
            >
              Your information is safe. Please reload the page and try again.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/")}
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { reportErrorSilently };
