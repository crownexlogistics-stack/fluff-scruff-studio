import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, Package } from "lucide-react";
import logoTransparent from "@/assets/logo-transparent.png";

const TC_POINTS = [
  "Full payment is required upfront at time of booking.",
  "All session dates must be agreed at the time of purchase.",
  "Sessions may be rescheduled with a minimum of 48 hours notice. Sessions missed without 48 hours notice may be counted as used at the salon's discretion.",
  "If you do not attend a session without notice (no-show), that session is counted as used with no refund or replacement.",
  "If you cancel your package, a refund will be issued for remaining unused sessions at the package price per session.",
  "Packages are non-transferable to another person or dog.",
  "Sessions do not expire whilst the package is active.",
  "The discounted price is locked in at the time of purchase and will not be affected by future price increases.",
  "Fluff & Scruff Studio reserves the right to decline a session if there are welfare or behavioural concerns regarding your dog.",
  "These terms are governed by English law.",
];

export default function SignPackageTCPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tcRecord, setTcRecord] = useState<any>(null);
  const [packageBooking, setPackageBooking] = useState<any>(null);
  const [signatureName, setSignatureName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No signing token provided.");
      setLoading(false);
      return;
    }
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      const { data: tc, error: tcErr } = await supabase
        .from("package_tc_signatures" as any)
        .select("*")
        .eq("signing_token", token)
        .single();

      if (tcErr || !tc) {
        setError("This signing link is invalid or has expired.");
        setLoading(false);
        return;
      }

      const tcData = tc as any;

      if (tcData.status === "signed") {
        setSigned(true);
        setTcRecord(tcData);
        setLoading(false);
        return;
      }

      if (tcData.token_expires_at && new Date(tcData.token_expires_at) < new Date()) {
        setError("This signing link has expired. Please contact the salon to request a new one.");
        setLoading(false);
        return;
      }

      setTcRecord(tcData);

      // Load package booking details
      const { data: pb } = await supabase
        .from("package_bookings" as any)
        .select("*, packages(name, package_type, session_count, discount_percentage)")
        .eq("id", tcData.package_booking_id)
        .single();

      setPackageBooking(pb);
      setLoading(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!signatureName.trim() || !agreed || !tcRecord) return;
    setSigning(true);

    try {
      let ip = "unknown";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const json = await res.json();
        ip = json.ip;
      } catch {}

      const userAgent = navigator.userAgent;
      const now = new Date().toISOString();

      // Update the TC signature record
      await supabase
        .from("package_tc_signatures" as any)
        .update({
          signature_text: signatureName.trim(),
          signed_at: now,
          ip_address: ip,
          user_agent: userAgent,
          status: "signed",
        })
        .eq("id", tcRecord.id);

      // Update package booking tc_signed
      await supabase
        .from("package_bookings" as any)
        .update({
          tc_signed: true,
          tc_signed_at: now,
        })
        .eq("id", tcRecord.package_booking_id);

      // Send confirmation & notification emails via edge function
      await supabase.functions.invoke("send-package-tc-email", {
        body: {
          type: "signed_confirmation",
          tc_signature_id: tcRecord.id,
          package_booking_id: tcRecord.package_booking_id,
        },
      });

      setSigned(true);
      setTcRecord({ ...tcRecord, signature_text: signatureName.trim(), signed_at: now, status: "signed" });
    } catch (err: any) {
      console.error("Signing error:", err);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <img src={logoTransparent} alt="Fluff & Scruff Studio" className="h-16 mx-auto" />
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold">Link Invalid</h2>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">
              Contact us at <a href="mailto:info@fluffandscruff.co.uk" className="text-primary underline">info@fluffandscruff.co.uk</a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <img src={logoTransparent} alt="Fluff & Scruff Studio" className="h-16 mx-auto" />
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold">Thank You, {tcRecord?.customer_name}!</h2>
            <p className="text-muted-foreground">
              Your agreement has been recorded. A confirmation has been sent to{" "}
              <strong>{tcRecord?.customer_email}</strong>.
            </p>
            <div className="text-sm text-muted-foreground border-t pt-4">
              <p>Signed: {tcRecord?.signed_at ? new Date(tcRecord.signed_at).toLocaleString("en-GB") : "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <img src={logoTransparent} alt="Fluff & Scruff Studio" className="h-20 mx-auto" />
          <h1 className="text-2xl font-bold">Package Deal Agreement</h1>
        </div>

        {/* Package Details */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Your Package Details</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Customer</span>
                <p className="font-medium">{tcRecord?.customer_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Package</span>
                <p className="font-medium">{packageBooking?.packages?.name || "Package Deal"}</p>
              </div>
              {packageBooking?.dog_name && (
                <div>
                  <span className="text-muted-foreground">Dog</span>
                  <p className="font-medium">{packageBooking.dog_name}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Sessions</span>
                <p className="font-medium">{packageBooking?.sessions_total} sessions</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Paid</span>
                <p className="font-medium">£{Number(packageBooking?.total_paid || 0).toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Discount</span>
                <p className="font-medium">{packageBooking?.packages?.discount_percentage}% off</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms & Conditions */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold text-lg">Terms & Conditions</h2>
            <ol className="list-decimal list-outside ml-5 space-y-3 text-sm text-foreground">
              {TC_POINTS.map((point, i) => (
                <li key={i} className="pl-1">{point}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Signature */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold">Electronic Signature</h2>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Type your full name as your electronic signature
              </label>
              <Input
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="e.g. John Smith"
                className="text-lg"
              />
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="agree-tc"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
              />
              <label htmlFor="agree-tc" className="text-sm leading-relaxed cursor-pointer">
                I have read and agree to the Fluff & Scruff Studio Package Deal Terms & Conditions
              </label>
            </div>

            <Button
              onClick={handleSign}
              disabled={!signatureName.trim() || !agreed || signing}
              className="w-full"
              size="lg"
            >
              {signing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Sign & Confirm
            </Button>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              By signing, you confirm your agreement. Your signature, name, date and time will be recorded.
              This is a legally binding electronic signature under the Electronic Communications Act 2000.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
