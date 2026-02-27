import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Scissors, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ContractContent } from "@/components/staff/ContractPreviewDialog";

const ContractSignPage = () => {
  const { staffId } = useParams<{ staffId: string }>();
  const queryClient = useQueryClient();
  const [signatureName, setSignatureName] = useState("");

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
      // Fetch IP address
      let ip = "unknown";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const json = await res.json();
        ip = json.ip;
      } catch { /* fallback */ }

      const { error } = await supabase.from("staff").update({
        contract_status: "signed",
        signed_at: new Date().toISOString(),
        signed_ip: ip,
      }).eq("id", staffId!);
      if (error) throw error;

      // Send confirmation emails
      try {
        const contractUrl = `${window.location.origin}/contract/sign/${staffId}`;
        await supabase.functions.invoke("send-contract-email", {
          body: { staff_id: staffId, type: "signed_confirmation", signing_url: contractUrl },
        });
      } catch { /* non-blocking */ }
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

  const nameMatches = signatureName.trim().toLowerCase() === staff.name.trim().toLowerCase();

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
                Signed by {staff.name} on{" "}
                {staff.signed_at ? format(new Date(staff.signed_at), "PPP 'at' p") : "—"}
              </p>
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
                <ScrollArea className="max-h-[50vh] pr-4">
                  <ContractContent staff={staff} />
                </ScrollArea>
              </CardContent>
            </Card>

            <Separator />

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-heading font-semibold text-lg">Digital Signature</h3>
                <p className="text-sm text-muted-foreground">
                  By typing your full name below and clicking "Sign Agreement", you confirm that you
                  have read and agree to all terms outlined in the contract above.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="sig-name">Full Name</Label>
                  <Input
                    id="sig-name"
                    placeholder={`Type "${staff.name}" to sign`}
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                  />
                  {signatureName.length > 0 && !nameMatches && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Name must match "{staff.name}"
                    </p>
                  )}
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={!nameMatches || signMutation.isPending}
                  onClick={() => signMutation.mutate()}
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  {signMutation.isPending ? "Signing..." : "Sign Agreement"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Your signature timestamp and IP address will be recorded for verification purposes.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default ContractSignPage;
