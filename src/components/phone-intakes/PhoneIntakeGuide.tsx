import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const Quote = ({ children }: { children: React.ReactNode }) => (
  <p className="border-l-4 border-primary bg-muted/50 rounded-r-md px-4 py-2 italic">{children}</p>
);

export function PhoneIntakeGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline"><BookOpen className="h-4 w-4 mr-2" />How to use &amp; phone script</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Quick guide &amp; phone script</DialogTitle></DialogHeader>
        <div className="space-y-6 text-sm">
          <section className="space-y-2">
            <h3 className="font-heading text-lg">How it works</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>On the phone:</strong> take their mobile number, ask if they have WhatsApp, and agree a day/time if they want one.</li>
              <li><strong>On the computer:</strong> click <em>Generate intake link</em>, enter the number, pick the agreed slot (it's held on the calendar for 1 hour), then click <em>Copy text message</em>.</li>
              <li><strong>Send it:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Has WhatsApp:</strong> paste and send via WhatsApp Web on the work computer.</li>
                  <li><strong>No WhatsApp:</strong> paste it into your own chat on WhatsApp Web, open it on the salon mobile, then copy it into a normal text message to the customer.</li>
                </ul>
              </li>
              <li>When they submit, the card turns green — click <em>Convert to booking</em>.</li>
            </ol>
          </section>
          <section className="space-y-3">
            <h3 className="font-heading text-lg">What to say</h3>
            <p className="font-semibold">1. Greet &amp; keep it quick</p>
            <Quote>"Hello, Fluff &amp; Scruff! I'm just with a dog right now so I can't stay on the line for long — can I take your mobile number? Do you have WhatsApp on that number?"</Quote>
            <p className="font-semibold">2. Agree the slot (if they want one)</p>
            <Quote>"Perfect, I've put a temporary 1-hour hold on tomorrow at 2:00 PM for you."</Quote>
            <p className="font-semibold">3. Tell them what's coming</p>
            <p className="text-muted-foreground">Has WhatsApp:</p>
            <Quote>"I'm sending a quick 30-second link to your WhatsApp right now. Please just tap it and enter your details within the hour so that spot stays locked in for you!"</Quote>
            <p className="text-muted-foreground">No WhatsApp:</p>
            <Quote>"No problem at all! I'll text the link directly to your mobile instead. Please just tap it and enter your details within the hour so that spot stays locked in for you!"</Quote>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
