import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HealthAndSafetyContent } from "./HealthAndSafetyContent";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-heading">Health & Safety Policy</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <HealthAndSafetyContent staff={staff} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
