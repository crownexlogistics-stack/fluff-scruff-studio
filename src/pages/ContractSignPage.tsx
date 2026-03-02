import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, PartyPopper, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ContractContent } from "@/components/staff/ContractPreviewDialog";
import { HealthAndSafetyContent } from "@/components/staff/HealthAndSafetyContent";
import { SignaturePadDialog } from "@/components/staff/SignaturePadDialog";
import logoTransparent from "@/assets/logo-transparent.png";

type Step = "contract" | "contract-done" | "health-safety" | "hs-done" | "all-done";

const ContractSignPage = () => {
  const { staffId } = useParams<{ staffId: string }>();
  const queryClient = useQueryClient();
  const [sigOpen, setSigOpen] = useState(false);
  const [signingFor, setSigningFor] = useState<"contract" | "health_and_safety">("contract");
  const [step, setStep] = useState<Step | null>(null);

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
    mutationFn: async ({ docType, signatureDataUrl }: { docType: "contract" | "health_and_safety"; signatureDataUrl: string }) => {
      let ip = "unknown";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const json = await res.json();
        ip = json.ip;
      } catch { /* fallback */ }

      const { data, error } = await supabase.functions.invoke("sign-document", {
        body: {
          staff_id: staffId,
          document_type: docType,
          signature_data: signatureDataUrl,
          ip_address: ip,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
      setSigOpen(false);
      if (variables.docType === "contract") {
        setStep("contract-done");
      } else {
        setStep("all-done");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading documents...</p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Documents not found.</p>
      </div>
    );
  }

  const contractSigned = staff.contract_status === "signed";
  const hsSigned = (staff as any).hs_status === "signed";
  const isSent = staff.contract_status === "sent";

  // Determine current step from DB state if not manually set
  const currentStep: Step = step
    ? step
    : contractSigned && hsSigned
      ? "all-done"
      : contractSigned && !hsSigned
        ? "health-safety"
        : "contract";

  // Gate: not ready
  if (!isSent && !contractSigned && !step) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-2">
            <p className="text-muted-foreground">These documents are not ready for signing yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const headerSubtitle = currentStep === "health-safety" || currentStep === "hs-done"
    ? "Health & Safety Policy — Review & Sign"
    : "Contract Review & Signing";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoTransparent} alt="Fluff & Scruff Studio" className="h-10 w-10 rounded-lg object-contain" />
          <div>
            <h1 className="font-heading text-lg font-bold">Fluff & Scruff Studio</h1>
            <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ── Step: Contract (unsigned) ── */}
        {currentStep === "contract" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-semibold">Your Contract</h2>
              <Badge variant="secondary" className="bg-primary/15 text-primary">Step 1 of 2</Badge>
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
                  By signing below, you confirm that you have read and agree to all terms outlined in the contract above.
                </p>
                <Button className="w-full" size="lg" onClick={() => { setSigningFor("contract"); setSigOpen(true); }}>
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

        {/* ── Step: Contract just signed → transition to H&S ── */}
        {currentStep === "contract-done" && (
          <Card className="border-2 border-primary">
            <CardContent className="p-8 text-center space-y-5">
              <CheckCircle2 className="h-14 w-14 text-success mx-auto" />
              <h2 className="font-heading text-2xl font-bold">Contract Signed ✓</h2>
              <Separator />
              <div className="bg-primary/10 rounded-xl p-6 space-y-3">
                <ShieldCheck className="h-12 w-12 text-primary mx-auto" />
                <h3 className="font-heading text-xl font-bold">One More Step!</h3>
                <p className="text-muted-foreground">
                  You also need to review and sign the <strong>Health & Safety Policy</strong> before you're all set.
                </p>
                <Button size="lg" onClick={() => setStep("health-safety")} className="mt-2 w-full text-base">
                  Continue to Health & Safety Policy
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step: Health & Safety (unsigned) ── */}
        {currentStep === "health-safety" && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-sm text-success font-medium">Contract signed</span>
              </div>
              <Badge variant="secondary" className="bg-primary/15 text-primary">Step 2 of 2</Badge>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-semibold">Health & Safety Policy</h2>
            </div>

            <Card>
              <CardContent className="p-6">
                <HealthAndSafetyContent staff={staff} />
              </CardContent>
            </Card>

            <Separator />

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-heading font-semibold text-lg">Digital Signature</h3>
                <p className="text-sm text-muted-foreground">
                  By signing below, you confirm that you have read, understood, and agree to comply with the Health & Safety Policy above.
                </p>
                <Button className="w-full" size="lg" onClick={() => { setSigningFor("health_and_safety"); setSigOpen(true); }}>
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

        {/* ── Step: All done ── */}
        {currentStep === "all-done" && (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <PartyPopper className="h-16 w-16 text-primary mx-auto" />
              <h2 className="font-heading text-2xl font-bold">All Done, {staff.name}!</h2>
              <p className="text-muted-foreground">
                Both your contract and Health & Safety Policy have been signed successfully.
              </p>
              <div className="flex flex-col items-center gap-2 pt-4">
                <div className="flex items-center gap-2 text-success text-sm">
                  <CheckCircle2 className="h-4 w-4" /> Contract signed
                  {staff.signed_at && (
                    <span className="text-muted-foreground ml-1">
                      — {format(new Date(staff.signed_at), "PPP")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-success text-sm">
                  <ShieldCheck className="h-4 w-4" /> Health & Safety signed
                  {(staff as any).hs_signed_at && (
                    <span className="text-muted-foreground ml-1">
                      — {format(new Date((staff as any).hs_signed_at), "PPP")}
                    </span>
                  )}
                </div>
              </div>
              <Separator />
              <div className="bg-accent/10 rounded-xl p-5 space-y-2">
                <h3 className="font-heading text-lg font-bold">📧 Check Your Email!</h3>
                <p className="text-sm text-muted-foreground">
                  We've sent you an email with a link to <strong>set your password</strong> and access your Staff Portal, where you can view your bookings, messages, and more.
                </p>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                If you don't see the email, check your spam folder. Any questions? Contact the studio.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <SignaturePadDialog
        open={sigOpen}
        onOpenChange={setSigOpen}
        onSign={(dataUrl) => signMutation.mutate({ docType: signingFor, signatureDataUrl: dataUrl })}
        staffName={staff.name}
        isPending={signMutation.isPending}
      />
    </div>
  );
};

export default ContractSignPage;
