import { useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VoucherCard, type VoucherOccasion } from "@/components/vouchers/VoucherCard";
import { Button } from "@/components/ui/button";
import { Copy, Download, Printer, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo-transparent.png";

export default function VoucherViewPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const { data: v, isLoading, isError } = useQuery({
    queryKey: ["voucher-view", token],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gift-voucher", { body: { action: "view", token } });
      if (error || data?.error) throw new Error("not found");
      return data as { code: string; amount: number; occasion: VoucherOccasion; description: string; holder: string; from: string | null; message: string | null; expires_at: string; status: string };
    },
    retry: false,
  });

  const saveImage = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: null, useCORS: true });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `fluff-scruff-gift-card-${v?.code}.png`;
      a.click();
    } catch {
      toast.error("Couldn't save the image — take a screenshot instead");
    } finally { setSaving(false); }
  };

  if (isLoading) return <div className="min-h-screen grid place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (isError || !v) return (
    <div className="min-h-screen grid place-items-center text-center px-6">
      <div><h1 className="font-heading text-2xl">Gift card not found</h1><p className="text-muted-foreground mt-2">Please check the link, or call us on 01708 606655.</p></div>
    </div>
  );

  const expired = new Date(v.expires_at).getTime() < Date.now();
  const usable = v.status === "active" && !expired;
  const expiryText = new Date(v.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background print:bg-background">
      <header className="max-w-xl mx-auto px-4 pt-6 flex justify-center print:hidden"><Link to="/"><img src={logo} alt="Fluff & Scruff" className="h-14 w-auto" /></Link></header>
      <main className="max-w-xl mx-auto px-4 py-8 space-y-6 text-center">
        {params.get("new") && <p className="rounded-xl bg-primary/10 text-primary font-semibold py-2 print:hidden">Payment successful — your gift card has been sent 🎉</p>}
        <div>
          <h1 className="font-heading text-3xl">{v.from ? `A gift from ${v.from}` : "Your Fluff & Scruff gift card"}</h1>
          {v.description && <p className="text-muted-foreground mt-1">{v.description}</p>}
        </div>

        <div className="flex justify-center"><VoucherCard ref={cardRef} occasion={v.occasion} amount={v.amount} code={v.code} holder={v.holder} expiresAt={v.expires_at} redeemed={!usable} /></div>

        {v.message && <blockquote className="italic rounded-2xl bg-card border p-4">“{v.message}”</blockquote>}

        {!usable && <p className="font-semibold text-destructive">{expired && v.status === "active" ? "This gift card has expired." : v.status === "cancelled" ? "This gift card is no longer valid." : "This gift card has been used."}</p>}

        <div className="grid grid-cols-2 gap-2 print:hidden">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(v.code); toast.success("Code copied"); }}><Copy className="h-4 w-4 mr-2" />Copy code</Button>
          <Button variant="outline" onClick={saveImage} disabled={saving}><Download className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save image"}</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
          {usable && <Button asChild><Link to="/book"><CalendarPlus className="h-4 w-4 mr-2" />Book now</Link></Button>}
        </div>

        <div className="text-left text-sm text-muted-foreground rounded-2xl border p-4 space-y-1">
          <p className="font-semibold text-foreground">How to use it</p>
          <p>• Book online and enter the code at the payment step, or call 01708 606655 and quote the code.</p>
          <p>• Single use — the full value is used on one appointment. No cash value.</p>
          <p>• Valid until {expiryText}. <Link to="/terms" className="underline">Terms apply</Link>.</p>
          <p className="print:hidden">Tip: take a screenshot or tap "Save image" to keep it in your photos.</p>
        </div>
      </main>
    </div>
  );
}
