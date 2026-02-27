import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Scissors } from "lucide-react";
import { toast } from "sonner";

const ContractSignPage = () => {
  const { staffId } = useParams<{ staffId: string }>();
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff", staffId],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").eq("id", staffId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!staffId,
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff").update({
        contract_status: "signed",
        signed_at: new Date().toISOString(),
      }).eq("id", staffId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
      toast.success("Contract signed successfully!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading contract...</p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Contract not found.</p>
      </div>
    );
  }

  const isSigned = staff.contract_status === "signed";
  const isSent = staff.contract_status === "sent";

  if (!isSent && !isSigned) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-2">
            <p className="text-muted-foreground">This contract is not ready for signing yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Scissors className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold">Fluff & Scruff Studio</h1>
            <p className="text-xs text-muted-foreground">Contract Review & Signing</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {isSigned ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
              <h2 className="font-heading text-2xl font-bold">Contract Signed</h2>
              <p className="text-muted-foreground">
                Signed by {staff.name} on {staff.signed_at ? format(new Date(staff.signed_at), "PPP 'at' p") : "—"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-semibold">Your Contract</h2>
              <Badge variant="secondary" className="bg-primary/15 text-primary">Awaiting Signature</Badge>
            </div>

            <Card>
              <CardContent className="p-6">
                <ScrollArea className="max-h-[50vh] pr-4">
                  <div className="space-y-4 text-sm leading-relaxed">
                    <div className="text-center space-y-1 pb-4 border-b">
                      <h2 className="font-heading text-lg font-bold">Fluff & Scruff Studio</h2>
                      <p className="text-muted-foreground">Self-Employed Groomer Agreement</p>
                    </div>

                    <div className="space-y-1">
                      <p><strong>Contractor:</strong> {staff.name}</p>
                      <p><strong>Role:</strong> {staff.role}</p>
                      {staff.start_date && <p><strong>Start Date:</strong> {format(new Date(staff.start_date), "PPP")}</p>}
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-heading font-semibold">1. Nature of Relationship</h3>
                      <p>This agreement is between Fluff & Scruff Studio ("the Studio") and {staff.name} ("the Groomer") operating as a self-employed contractor.</p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-heading font-semibold">2. Commission Structure</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Groomer's Own Customers:</strong> 50% of total service price.</li>
                        <li><strong>Studio Customers:</strong> 40% of total service price.</li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-heading font-semibold">3. Deposits</h3>
                      <p>A 60% deposit is required from all customers at booking.</p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-heading font-semibold">4. Working Arrangements</h3>
                      <p>The Groomer shall use the Studio's premises and equipment as agreed.</p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-heading font-semibold">5. Insurance & Liability</h3>
                      <p>The Groomer must hold their own professional liability insurance.</p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-heading font-semibold">6. Termination</h3>
                      <p>Either party may terminate with 30 days written notice.</p>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Separator />

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-heading font-semibold">Sign Contract</h3>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 rounded border-input accent-primary" />
                  <span className="text-sm">I, <strong>{staff.name}</strong>, have read and agree to the terms outlined in this self-employed groomer agreement with Fluff & Scruff Studio.</span>
                </label>
                <Button className="w-full" size="lg" disabled={!confirmed || signMutation.isPending} onClick={() => signMutation.mutate()}>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  {signMutation.isPending ? "Signing..." : "Sign Contract"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default ContractSignPage;
