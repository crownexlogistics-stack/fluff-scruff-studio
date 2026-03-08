import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TellUsMoreModalProps {
  open: boolean;
  onClose: () => void;
  errorReportId: string | null;
}

function TellUsMoreModal({ open, onClose, errorReportId }: TellUsMoreModalProps) {
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim() || !errorReportId) return;
    setSubmitting(true);
    try {
      await supabase
        .from("error_reports" as any)
        .update({ steps_to_reproduce: description.trim() } as any)
        .eq("id", errorReportId);
      toast.success("Thanks for the extra detail! 🐾");
      setDescription("");
      onClose();
    } catch {
      toast.error("Couldn't save — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-h-[50vh] overflow-y-auto"
        style={{ background: "#FFFAF4" }}
      >
        <SheetHeader className="text-left">
          <SheetTitle
            style={{
              fontFamily: "'Fredoka One', cursive",
              color: "#2D1B0E",
              fontSize: "20px",
            }}
          >
            Tell us more 🐾
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label
              className="text-sm font-bold mb-1 block"
              style={{ fontFamily: "Nunito, sans-serif", color: "#2D1B0E" }}
            >
              What were you trying to do?
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. I was trying to book an appointment..."
              rows={3}
              style={{ fontFamily: "Nunito, sans-serif", borderRadius: "14px" }}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            className="w-full py-5 text-white font-bold"
            style={{
              background: "#FF6B35",
              borderRadius: "30px",
              fontFamily: "Nunito, sans-serif",
            }}
          >
            {submitting ? "Sending..." : "Submit"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { TellUsMoreModal };

// Utility: show API error toast with "Tell us more" link
export async function handleApiError(error: Error | string, pageUrl?: string) {
  const err = typeof error === "string" ? new Error(error) : error;
  const { reportErrorSilently } = await import("@/components/ErrorBoundary");

  const url = pageUrl || window.location.href;
  reportErrorSilently(err, url);

  // Return the error report ID for the "tell us more" modal
  const { data } = await supabase
    .from("error_reports" as any)
    .select("id")
    .eq("page_url", url)
    .order("created_at", { ascending: false })
    .limit(1);

  return (data as any)?.[0]?.id || null;
}
