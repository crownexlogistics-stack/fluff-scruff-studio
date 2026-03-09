import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface OverdueCustomer {
  name: string;
  email: string;
  dogName: string;
  daysOverdue: number;
}

interface Props {
  overdueCustomers: OverdueCustomer[];
}

export function QuickActionsBar({ overdueCustomers }: Props) {
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState(
    "Hi! We miss your pup at Fluff & Scruff! It's been a while — shall we get them booked in? Reply YES and we'll find you a slot 🐾"
  );
  const [sending, setSending] = useState(false);

  const handleSendBulkSms = async () => {
    setSending(true);
    try {
      // This would integrate with the existing SMS edge function
      toast({ title: "SMS Campaign", description: `Ready to send to ${overdueCustomers.length} overdue customers. SMS integration required.` });
      setSmsOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to send SMS", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setSmsOpen(true)}>
              <MessageSquare className="h-4 w-4 mr-2" /> 📱 SMS All Overdue ({overdueCustomers.length})
            </Button>
            <Button variant="outline" disabled>
              <Mail className="h-4 w-4 mr-2" /> 📧 Email Win-Back Campaign
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" /> 🔄 Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SMS All Overdue Customers</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will send a message to {overdueCustomers.length} customers who haven't been back in 6+ weeks.
          </p>
          <Textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsOpen(false)}>Cancel</Button>
            <Button onClick={handleSendBulkSms} disabled={sending}>
              {sending ? "Sending..." : `Send to ${overdueCustomers.length} customers`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
