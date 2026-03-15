import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function SmsTrackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const campaignName = searchParams.get("c") || "";
    const phoneHash = searchParams.get("p") || "";
    const destination = searchParams.get("url") || "https://fluffandscruff.co.uk";

    // Log the click (fire and forget)
    supabase
      .from("sms_link_clicks")
      .insert({
        campaign_name: campaignName,
        phone_hash: phoneHash,
        destination_url: destination,
      })
      .then(() => {})
      .catch(() => {});

    // Redirect immediately
    window.location.href = destination;
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground text-sm">Redirecting...</p>
      </div>
    </div>
  );
}
