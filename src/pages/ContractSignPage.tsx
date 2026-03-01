import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { ContractContent } from "@/components/staff/ContractPreviewDialog";
import { SignaturePadDialog } from "@/components/staff/SignaturePadDialog";
import logoTransparent from "@/assets/logo-transparent.png";

const ContractSignPage = () => {
  const { staffId } = useParams<{ staffId: string }>();
  const queryClient = useQueryClient();
  const [sigOpen, setSigOpen] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

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
    mutationFn: async (signatureDataUrl: string) => {
      let ip = "unknown";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const json = await res.json();
        ip = json.ip;
      } catch { /* fallback */ }

      const { data, error } = await supabase.functions.invoke("sign-document", {
        body: {
          staff_id: staffId,
          document_type: "contract",
          signature_data: signatureDataUrl,
          ip_address: ip,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
      setSigOpen(false);
      setJustSigned(true);
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

  if (!isSent && !isSigned && !justSigned) {
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
          <img src={logoTransparent} alt="Fluff & Scruff Studio" className="h-10 w-10 rounded-lg object-contain" />
          <div>
            <h1 className="font-heading text-lg font-bold">Fluff & Scruff Studio</h1>
            <p className="text-xs text-muted-foreground">Contract Review & Signing</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {justSigned || isSigned ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              {justSigned ? (
                <>
                  <PartyPopper className="h-16 w-16 text-primary mx-auto" />
                  <h2 className="font-heading text-2xl font-bold">Thank You, {staff.name}!</h2>
                  <p className="text-muted-foreground">
                    Your contract has been signed successfully. A confirmation has been sent to your email.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You can close this page now. If you have any questions, please contact the studio.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
                  <h2 className="font-heading text-2xl font-bold">Contract Signed</h2>
                  <p className="text-muted-foreground">
                    Signed by {staff.name} on{" "}
                    {staff.signed_at ? format(new Date(staff.signed_at), "PPP 'at' p") : "—"}
                  </p>
                </>
              )}
              {(staff as any).contract_signature_data && !justSigned && (
                <div className="pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Signature:</p>
                  <img
                    src={(staff as any).contract_signature_data}
                    alt="Signature"
                    className="mx-auto max-h-24 border rounded-lg bg-white p-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-semibold">Your Contract</h2>
              <Badge variant="secondary" className="bg-primary/15 text-primary">
                Awaiting Signature
              </Badge>
            </div>

            <Card>
              <CardContent className="p-6">
                <ContractContent staff={staff} />
              </CardContent>
            </Card>

            <Separator />

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-heading font-semibold text-lg">Digital Signature</h3>
                <p className="text-sm text-muted-foreground">
                  By signing below, you confirm that you have read and agree to all terms outlined
                  in the contract above.
                </p>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setSigOpen(true)}
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Open Signature Pad
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Your signature, timestamp, and IP address will be recorded for verification purposes.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <SignaturePadDialog
        open={sigOpen}
        onOpenChange={setSigOpen}
        onSign={(dataUrl) => signMutation.mutate(dataUrl)}
        staffName={staff.name}
        isPending={signMutation.isPending}
      />
    </div>
  );
};

export default ContractSignPage;
