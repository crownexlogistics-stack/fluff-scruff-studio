import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ErrorReportModalProps {
  open: boolean;
  onClose: () => void;
}

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

export function ErrorReportModal({ open, onClose }: ErrorReportModalProps) {
  const { user } = useAuth();
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [errorDescription, setErrorDescription] = useState("");
  const [email, setEmail] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!stepsToReproduce.trim() || !errorDescription.trim()) {
      toast.error("Please fill in both fields");
      return;
    }

    setSubmitting(true);
    try {
      let screenshotUrl: string | null = null;

      // Upload screenshot if provided
      if (screenshot) {
        const ext = screenshot.name.split(".").pop();
        const path = `error-reports/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("pet-photos")
          .upload(path, screenshot);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from("pet-photos")
            .getPublicUrl(path);
          screenshotUrl = urlData.publicUrl;
        }
      }

      const customerEmail = email.trim() || user?.email || null;
      const customerName = user?.user_metadata?.full_name || null;

      const { error } = await supabase.from("error_reports" as any).insert({
        customer_email: customerEmail,
        customer_name: customerName,
        page_url: window.location.href,
        error_description: errorDescription.trim(),
        steps_to_reproduce: stepsToReproduce.trim(),
        browser_info: getBrowserInfo(),
        device_info: getDeviceInfo(),
        screenshot_url: screenshotUrl,
        user_id: user?.id || null,
        status: "new",
      } as any);

      if (error) throw error;

      // Send email notification to admin
      try {
        await supabase.functions.invoke("send-customer-email", {
          body: {
            to: "info@fluffandscruff.co.uk",
            subject: "🚨 New Error Report — Fluff & Scruff",
            html: `
              <h2>🚨 New Error Report</h2>
              <p><strong>Time:</strong> ${new Date().toLocaleString("en-GB")}</p>
              <p><strong>Page:</strong> ${window.location.href}</p>
              <p><strong>What they were doing:</strong> ${stepsToReproduce}</p>
              <p><strong>What went wrong:</strong> ${errorDescription}</p>
              <p><strong>Customer email:</strong> ${customerEmail || "Not provided"}</p>
              <p><strong>Browser:</strong> ${getBrowserInfo()}</p>
              <p><strong>Device:</strong> ${getDeviceInfo()}</p>
              ${screenshotUrl ? `<p><strong>Screenshot:</strong> <a href="${screenshotUrl}">View</a></p>` : ""}
              <br/>
              <p><a href="https://fluffandscruff.co.uk/admin/error-reports">View in Admin Panel</a></p>
            `,
          },
        });
      } catch {
        // Non-critical — report saved even if email fails
      }

      setSubmitted(true);
    } catch (e: any) {
      toast.error("Failed to send report: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStepsToReproduce("");
    setErrorDescription("");
    setEmail("");
    setScreenshot(null);
    setSubmitted(false);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto" style={{ background: '#FFFAF4' }}>
        <SheetHeader className="text-left">
          <SheetTitle style={{ fontFamily: "'Fredoka One', cursive", color: '#2D1B0E', fontSize: '22px' }}>
            Something not working? 🔧
          </SheetTitle>
          <p style={{ fontFamily: 'Nunito, sans-serif', color: '#8B6F5C', fontSize: '14px' }}>
            Tell us what happened and we'll fix it right away!
          </p>
        </SheetHeader>

        {submitted ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-4xl">🐾</p>
            <p style={{ fontFamily: "'Fredoka One', cursive", color: '#2D1B0E', fontSize: '20px' }}>
              Thank you!
            </p>
            <p style={{ fontFamily: 'Nunito, sans-serif', color: '#8B6F5C', fontSize: '14px' }}>
              We've received your report and will look into it straight away 🐾
            </p>
            <Button onClick={handleClose} className="mt-4" style={{ background: '#FF6B35', borderRadius: '30px', fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-bold mb-1 block" style={{ fontFamily: 'Nunito, sans-serif', color: '#2D1B0E' }}>
                What were you trying to do? *
              </label>
              <Textarea
                value={stepsToReproduce}
                onChange={(e) => setStepsToReproduce(e.target.value)}
                placeholder="e.g. I was trying to book an appointment..."
                rows={3}
                style={{ fontFamily: 'Nunito, sans-serif', borderRadius: '14px' }}
              />
            </div>
            <div>
              <label className="text-sm font-bold mb-1 block" style={{ fontFamily: 'Nunito, sans-serif', color: '#2D1B0E' }}>
                What went wrong? *
              </label>
              <Textarea
                value={errorDescription}
                onChange={(e) => setErrorDescription(e.target.value)}
                placeholder="e.g. The page showed an error message..."
                rows={3}
                style={{ fontFamily: 'Nunito, sans-serif', borderRadius: '14px' }}
              />
            </div>
            <div>
              <label className="text-sm font-bold mb-1 block" style={{ fontFamily: 'Nunito, sans-serif', color: '#2D1B0E' }}>
                Your email (so we can follow up)
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={{ fontFamily: 'Nunito, sans-serif', borderRadius: '14px' }}
              />
            </div>
            <div>
              <label className="text-sm font-bold mb-1 block" style={{ fontFamily: 'Nunito, sans-serif', color: '#2D1B0E' }}>
                Attach a screenshot
              </label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                style={{ fontFamily: 'Nunito, sans-serif', borderRadius: '14px' }}
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-6 text-base text-white font-bold"
              style={{ background: '#FF6B35', borderRadius: '30px', fontFamily: 'Nunito, sans-serif' }}
            >
              {submitting ? "Sending..." : "Send Report 🐾"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
