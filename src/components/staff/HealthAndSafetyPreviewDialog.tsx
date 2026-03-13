import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { HealthAndSafetyContent } from "./HealthAndSafetyContent";
import { downloadDocumentPdf } from "@/lib/downloadDocumentPdf";
import { toast } from "sonner";

interface StaffMember {
  name: string;
  hs_status?: string;
  hs_signed_at?: string | null;
  hs_signed_ip?: string | null;
}

interface Props {
  staff: StaffMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HealthAndSafetyPreviewDialog({ staff, open, onOpenChange }: Props) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadDocumentPdf(
        "hs-pdf-content",
        `${staff.name.replace(/\s+/g, "_")}_Health_Safety_Policy.pdf`
      );
      toast.success("Health & Safety Policy downloaded");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="font-heading">Health & Safety Policy</DialogTitle>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading} className="shrink-0">
              {downloading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
              Download PDF
            </Button>
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div id="hs-pdf-content" className="bg-background p-2">
            <HealthAndSafetyContent staff={staff} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
