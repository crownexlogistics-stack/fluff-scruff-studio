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

export function ContractContent({ staff }: { staff: StaffMember }) {
  const startDateFormatted = staff.start_date
    ? format(new Date(staff.start_date), "PPP")
    : "_______________";

  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <div className="text-center space-y-1 pb-4 border-b">
        <p className="text-xs text-muted-foreground">138 Hillview Avenue,</p>
        <p className="text-xs text-muted-foreground">Hornchurch</p>
        <p className="text-xs text-muted-foreground">RM11 2DL</p>
      </div>

      <h2 className="font-heading text-lg font-bold text-center">
        Contract for Self-Employed Dog Groomer
      </h2>

      <p>
        This contract ("Contract") is entered into between{" "}
        <strong>Fluff and Scruff Studio</strong>, located at 138 Hillview Ave,
        Hornchurch RM11 2DL and <strong>{staff.name}</strong> ("Contractor") for
        the provision of dog grooming services under the following terms and
        conditions:
      </p>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">1. Engagement of Services</h3>
        <p>
          The Contractor agrees to provide dog grooming services to the Company
          on a self-employed basis.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">2. Term</h3>
        <p>
          This Contract shall commence on <strong>{startDateFormatted}</strong>{" "}
          and shall be considered a temporary (probationary) agreement for the
          first two months. At the end of this period, an evaluation of the
          contractor's job performance, contribution to Fluff and Scruff Studio,
          and compatibility with Fluff and Scruff's Values and Code of Conduct
          will be conducted. The contract will only become permanent upon
          successful completion of this evaluation.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">3. Scope of Work</h3>
        <p>
          The Contractor shall perform dog grooming services as agreed upon
          between the parties. Any changes to the scope of work must be agreed
          upon in writing by both parties.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">4. Compensation</h3>
        <p>
          The Contractor shall receive <strong>40%</strong> of the revenue
          generated from dog grooming services provided by the Contractor.
          Payment shall be made upon submission of an invoice by the Contractor.
        </p>
        <p>
          The compensation rate of 40% is subject to review and potential
          adjustment at the time of contract renewal, which occurs every two (2)
          years. Any adjustments to the percentage may be based on factors such
          as the Contractor's tenure with Fluff and Scruff Studio and the level
          of expertise or experience gained during the term of the contract.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">
          5. Taxes and Insurance
        </h3>
        <p>
          The Contractor acknowledges and agrees that they are responsible for
          the payment of their own taxes and National Insurance contributions.
          The Company shall provide appropriate insurance coverage.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">6. Confidentiality</h3>
        <p>
          The Contractor shall maintain the confidentiality of any proprietary or
          confidential information belonging to the Company and shall not
          disclose such information to any third party.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">
          7. Intellectual Property
        </h3>
        <p>
          Any intellectual property created by the Contractor in the course of
          providing the dog grooming services shall belong to the Company.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">8. Termination</h3>
        <p>
          Either party may terminate this Contract by providing 30 days written
          notice to the other party. In the event of termination, the Contractor
          shall be compensated for any outstanding dog grooming services provided
          up to the date of termination.
        </p>
        <p>
          In the event of the termination of this contract, the contractor
          agrees that they will not solicit or take with them any clients or
          customers that they have met or worked with during their time with
          Fluff and Scruff Studio to another salon or grooming service for a
          period of <strong>36 months</strong> following the termination of this
          contract.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">
          9. Independent Contractor Status
        </h3>
        <p>
          The Contractor acknowledges and agrees that they are an independent
          contractor and not an employee of the Company. The Contractor shall not
          be entitled to any benefits provided to employees of the Company.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">
          10. Health and Safety
        </h3>
        <p>
          The Contractor acknowledges that they have undergone appropriate health
          and safety training and agrees to comply with all health and safety
          regulations and policies established by Fluff and Scruff Studio. This
          includes but is not limited to maintaining a safe working environment,
          following proper grooming procedures to prevent injury to themselves
          and pets, and reporting any health and safety concerns to the Company
          promptly.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">
          11. Renewal of Contract
        </h3>
        <p>
          This Contract shall automatically renew every two years unless
          terminated by either party in accordance with Clause 8. Prior to the
          expiration of each term, both parties shall review the terms of this
          Contract and negotiate any necessary amendments or changes in writing.
          The Contractor acknowledges and agrees to the automatic renewal
          provision of this Contract.
        </p>
      </div>

      <div className="pt-6 space-y-6 border-t">
        <p className="font-heading font-semibold">Fluff and Scruff Studio</p>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">By:</p>
            <div className="border-b border-dashed h-8" />
            <p className="text-xs text-muted-foreground">
              Date: _______________
            </p>
            <p className="text-xs text-muted-foreground">
              Signature: _______________
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Contractor: {staff.name}
            </p>
            <div className="border-b border-dashed h-8" />
            <p className="text-xs text-muted-foreground">
              Date: _______________
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContractPreviewDialog({ staff, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Self-Employed Groomer Contract
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <ContractContent staff={staff} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
