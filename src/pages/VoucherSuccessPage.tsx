import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** After Stripe: confirm payment server-side, then open the voucher card. */
export default function VoucherSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "slow" | "error">("checking");

  useEffect(() => {
    const sid = params.get("session_id");
    if (!sid) { setState("error"); return; }
    let tries = 0;
    let stop = false;
    const run = async () => {
      const { data } = await supabase.functions.invoke("gift-voucher", { body: { action: "finalize", session_id: sid } });
      if (stop) return;
      if (data?.view_token) { navigate(`/v/${data.view_token}?new=1`, { replace: true }); return; }
      tries++;
      if (tries >= 10) { setState("slow"); return; }
      setTimeout(run, 2000);
    };
    run();
    return () => { stop = true; };
  }, [params, navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6 text-center">
      <div className="max-w-md space-y-4">
        {state === "checking" && (<>
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <h1 className="font-heading text-2xl">Creating your gift card…</h1>
          <p className="text-muted-foreground">Confirming your payment — this only takes a moment.</p>
        </>)}
        {state === "slow" && (<>
          <h1 className="font-heading text-2xl">Payment received 🐾</h1>
          <p className="text-muted-foreground">Your gift card is on its way by email. If it hasn't arrived in 10 minutes, call us on 01708 606655 and we'll resend it.</p>
          <Button asChild><Link to="/">Back to home</Link></Button>
        </>)}
        {state === "error" && (<>
          <h1 className="font-heading text-2xl">Something's not right</h1>
          <p className="text-muted-foreground">We couldn't find this payment. If you were charged, please call us on 01708 606655.</p>
          <Button asChild><Link to="/vouchers">Back to vouchers</Link></Button>
        </>)}
      </div>
    </div>
  );
}
