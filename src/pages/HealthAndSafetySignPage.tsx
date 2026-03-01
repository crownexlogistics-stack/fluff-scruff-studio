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
import { CheckCircle2, ShieldCheck } from "lucide-react";
import logoTransparent from "@/assets/logo-transparent.png";
import { toast } from "sonner";
import { HealthAndSafetyContent } from "@/components/staff/HealthAndSafetyContent";
import { SignaturePadDialog } from "@/components/staff/SignaturePadDialog";

const HealthAndSafetySignPage = () => {
  const { staffId } = useParams<{ staffId: string }>();
  const queryClient = useQueryClient();
  const [sigOpen, setSigOpen] = useState(false);

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

      const { error } = await supabase.from("staff").update({
        hs_status: "signed",
        hs_signed_at: new Date().toISOString(),
        hs_signed_ip: ip,
        hs_signature_data: signatureDataUrl,
      } as any).eq("id", staffId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
      setSigOpen(false);
      toast.success("Health & Safety policy signed successfully!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Document not found.</p>
      </div>
    );
  }

  const isSigned = (staff as any).hs_status === "signed";
  const isSent = (staff as any).hs_status === "sent";

  if (!isSent && !isSigned) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-2">
            <p className="text-muted-foreground">This document is not ready for signing yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoTransparent} alt="Fluff & Scruff Studio" className="h-10 w-10 rounded-lg object-contain" />
          <div>
            <h1 className="font-heading text-lg font-bold">Fluff & Scruff Studio</h1>
            <p className="text-xs text-muted-foreground">Health & Safety Policy — Review & Sign</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {isSigned ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <ShieldCheck className="h-16 w-16 text-success mx-auto" />
              <h2 className="font-heading text-2xl font-bold">Health & Safety Policy Signed</h2>
              <p className="text-muted-foreground">
                Signed by {staff.name} on{" "}
                {(staff as any).hs_signed_at ? format(new Date((staff as any).hs_signed_at), "PPP 'at' p") : "—"}
              </p>
              {(staff as any).hs_signature_data && (
                <div className="pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Signature:</p>
                  <img
                    src={(staff as any).hs_signature_data}
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
              <h2 className="font-heading text-xl font-semibold">Health & Safety Policy</h2>
              <Badge variant="secondary" className="bg-primary/15 text-primary">
                Awaiting Signature
              </Badge>
            </div>

            <Card>
              <CardContent className="p-6">
                <ScrollArea className="pr-4">
                  <HealthAndSafetyContent staff={staff} />
                </ScrollArea>
              </CardContent>
            </Card>

            <Separator />

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-heading font-semibold text-lg">Digital Signature</h3>
                <p className="text-sm text-muted-foreground">
                  By signing below, you confirm that you have read, understood, and agree to comply
                  with the Health & Safety Policy above.
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

export default HealthAndSafetySignPage;
