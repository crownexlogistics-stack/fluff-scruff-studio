import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  is_self_employed: boolean;
  start_date: string | null;
  contract_status: string;
}

interface Props {
  staff: StaffMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContractPreviewDialog({ staff, open, onOpenChange }: Props) {
  const commissionRate = "50%";
  const studioRate = "50%";
  const nonOwnCustomerRate = "40%";
  const nonOwnStudioRate = "60%";
  const today = format(new Date(), "PPP");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-heading">Self-Employed Groomer Contract</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4 text-sm leading-relaxed">
            <div className="text-center space-y-1 pb-4 border-b">
              <h2 className="font-heading text-lg font-bold">Fluff & Scruff Studio</h2>
              <p className="text-muted-foreground">Self-Employed Groomer Agreement</p>
              <p className="text-xs text-muted-foreground">Generated: {today}</p>
            </div>

            <div className="space-y-1">
              <p><strong>Contractor:</strong> {staff.name}</p>
              <p><strong>Role:</strong> {staff.role}</p>
              {staff.start_date && <p><strong>Start Date:</strong> {format(new Date(staff.start_date), "PPP")}</p>}
            </div>

            <div className="space-y-2">
              <h3 className="font-heading font-semibold">1. Nature of Relationship</h3>
              <p>This agreement is between Fluff & Scruff Studio ("the Studio") and {staff.name} ("the Groomer") operating as a self-employed contractor. The Groomer is not an employee of the Studio and is responsible for their own tax and National Insurance contributions.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-heading font-semibold">2. Commission Structure</h3>
              <p>The Groomer's pay shall be calculated as follows:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Groomer's Own Customers:</strong> The Groomer shall receive {commissionRate} of the total service price. The Studio retains {studioRate}.</li>
                <li><strong>Studio Customers:</strong> The Groomer shall receive {nonOwnCustomerRate} of the total service price. The Studio retains {nonOwnStudioRate}.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-heading font-semibold">3. Deposits</h3>
              <p>A deposit of 60% of the total booking price is required from all customers at the time of booking. Deposits are non-refundable unless cancelled with 48 hours notice.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-heading font-semibold">4. Working Arrangements</h3>
              <p>The Groomer shall use the Studio's premises and equipment as agreed. The Groomer is responsible for maintaining their own grooming tools and professional standards.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-heading font-semibold">5. Insurance & Liability</h3>
              <p>The Groomer must hold their own professional liability insurance and provide proof of coverage to the Studio upon request.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-heading font-semibold">6. Termination</h3>
              <p>Either party may terminate this agreement with 30 days written notice. Outstanding payments will be settled within 14 days of termination.</p>
            </div>

            <div className="pt-6 space-y-6 border-t">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Studio Representative</p>
                  <div className="border-b border-dashed h-8" />
                  <p className="text-xs text-muted-foreground">Date: _______________</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Groomer: {staff.name}</p>
                  <div className="border-b border-dashed h-8" />
                  <p className="text-xs text-muted-foreground">Date: _______________</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
