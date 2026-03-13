import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { ContractContent } from "./ContractPreviewDialog";
import { downloadDocumentPdf } from "@/lib/downloadDocumentPdf";
import { toast } from "sonner";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  is_self_employed: boolean;
  start_date: string | null;
  contract_status: string;
  signed_at: string | null;
  signed_ip: string | null;
  contract_signature_data?: string | null;
}

// Re-export ContractContent so existing imports don't break
export { ContractContent };

interface Props {
  staff: StaffMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContractPreviewDialog({ staff, open, onOpenChange }: Props) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadDocumentPdf(
        "contract-pdf-content",
        `${staff.name.replace(/\s+/g, "_")}_Contract.pdf`
      );
      toast.success("Contract downloaded");
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
            <DialogTitle className="font-heading">
              Self-Employed Groomer Contract
            </DialogTitle>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading} className="shrink-0">
              {downloading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
              Download PDF
            </Button>
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div id="contract-pdf-content" className="bg-background p-2">
            <ContractContent staff={staff} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
