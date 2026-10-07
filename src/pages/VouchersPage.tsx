import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import logo from "@/assets/logo-transparent.png";
import { VoucherCard, OCCASIONS, type VoucherOccasion } from "@/components/vouchers/VoucherCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ArrowLeft, Gift, Lock, Mail, MessageSquare, User } from "lucide-react";
import { toast } from "sonner";

type Options = { occasions: VoucherOccasion[]; presets: number[]; seasonal_extra: Record<string, number>; seasonal_services: string[] };

async function readError(error: unknown, data: any) {
  if (data?.error) return data.error as string;
  if (error instanceof FunctionsHttpError) {
    try { return (await error.context.json())?.error ?? "Something went wrong"; } catch { /* */ }
  }
  return "Something went wrong — please try again.";
}

export default function VouchersPage() {
  const [params] = useSearchParams();
  const { data: opts } = useQuery({
    queryKey: ["voucher-options"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gift-voucher", { body: { action: "options" } });
      if (error) throw error;
      return data as Options;
    },
  });
  const { data: breeds = [] } = useQuery({
    queryKey: ["voucher-breeds"],
    queryFn: async () => {
      const { data } = await supabase.from("breeds").select("id, name").order("name");
      return data ?? [];
    },
  });

  const [occasion, setOccasion] = useState<VoucherOccasion>("classic");
  const [amount, setAmount] = useState<number | null>(50);
  const [custom, setCustom] = useState("");
  const [serviceName, setServiceName] = useState("Full Groom");
  const [breedId, setBreedId] = useState("");
  const [breedSearch, setBreedSearch] = useState("");
  const [quote, setQuote] = useState<{ amount: number; description: string } | null>(null);
  const [quoteErr, setQuoteErr] = useState("");

  const [sendTo, setSendTo] = useState<"me" | "recipient">("recipient");
  const [delivery, setDelivery] = useState<"email" | "sms" | "both">("email");
  const [copyMe, setCopyMe] = useState(true);
  const [f, setF] = useState({ pName: "", pEmail: "", pPhone: "", rName: "", rEmail: "", rPhone: "", message: "" });
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (params.get("cancelled")) toast.info("Payment cancelled — nothing was charged."); }, [params]);
  useEffect(() => { document.title = "Gift Vouchers | Fluff & Scruff Grooming Studio"; }, []);

  const isPackage = occasion === "halloween" || (occasion === "christmas" && !!opts?.seasonal_extra?.christmas);
  const needsBreed = isPackage && serviceName !== "Puppy Special";

  useEffect(() => {
    setQuote(null); setQuoteErr("");
    if (!isPackage || (needsBreed && !breedId)) return;
    let live = true;
    supabase.functions.invoke("gift-voucher", { body: { action: "quote", occasion, service_name: serviceName, breed_id: breedId || null } })
      .then(async ({ data, error }) => {
        if (!live) return;
        if (error || data?.error) setQuoteErr(await readError(error, data));
        else setQuote(data);
      });
    return () => { live = false; };
  }, [isPackage, needsBreed, occasion, serviceName, breedId]);

  const finalAmount = isPackage ? quote?.amount ?? null : amount;
  const holder = sendTo === "recipient" ? f.rName : f.pName;
  const filteredBreeds = useMemo(
    () => breeds.filter((b: any) => b.name.toLowerCase().includes(breedSearch.toLowerCase())).slice(0, 8),
    [breeds, breedSearch],
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    if (!finalAmount) return toast.error(isPackage ? "Please choose the service and breed" : "Please choose an amount");
    if (!f.pName.trim() || !f.pEmail.trim()) return toast.error("Please enter your name and email");
    if (sendTo === "recipient") {
      if (!f.rName.trim()) return toast.error("Please enter who the gift is for");
      if (delivery !== "sms" && !f.rEmail.trim()) return toast.error("Please enter their email");
      if (delivery !== "email" && !f.rPhone.trim()) return toast.error("Please enter their mobile number");
    }
    if (!terms) return toast.error("Please accept the Terms & Conditions");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gift-voucher", {
      body: {
        action: "checkout", occasion,
        amount: isPackage ? undefined : finalAmount,
        service_name: isPackage ? serviceName : undefined,
        breed_id: needsBreed ? breedId : undefined,
        purchaser_name: f.pName.trim(), purchaser_email: f.pEmail.trim(), purchaser_phone: f.pPhone.trim() || null,
        send_to: sendTo,
        recipient_name: f.rName.trim() || null, recipient_email: f.rEmail.trim() || null, recipient_phone: f.rPhone.trim() || null,
        delivery_method: delivery, copy_to_purchaser: copyMe, gift_message: f.message.trim() || null,
        accepted_terms: true,
      },
    });
    if (error || !data?.url) {
      setBusy(false);
      return toast.error(await readError(error, data));
    }
    window.location.href = data.url;
  };

  const occasions = opts?.occasions ?? ["classic", "birthday"];

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/"><img src={logo} alt="Fluff & Scruff" className="h-12 w-auto" /></Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Home</Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-10 grid lg:grid-cols-[1fr_440px] gap-10">
        <div className="space-y-8">
          <header>
            <p className="text-sm font-semibold text-primary flex items-center gap-2"><Gift className="h-4 w-4" />Gift Vouchers</p>
            <h1 className="font-heading text-4xl sm:text-5xl mt-2">Give the gift of a pamper</h1>
            <p className="text-muted-foreground mt-3 max-w-xl">A digital Fluff &amp; Scruff gift card, sent instantly by email or text. Valid for 12 months on any groom or extra.</p>
          </header>

          <section className="space-y-3">
            <h2 className="font-heading text-xl">1. Choose a design</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {occasions.map((o) => (
                <button key={o} onClick={() => setOccasion(o)}
                  className={cn("rounded-2xl border-2 p-3 text-left transition", occasion === o ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                  <span className="text-2xl">{OCCASIONS[o].emoji}</span>
                  <p className="font-semibold text-sm mt-1">{OCCASIONS[o].label}</p>
                  <p className="text-xs text-muted-foreground">{OCCASIONS[o].tagline}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl">2. {isPackage ? "Choose the treat" : "Choose an amount"}</h2>
            {isPackage ? (
              <div className="space-y-4 rounded-2xl border p-4 bg-card">
                <p className="text-sm text-muted-foreground">
                  {OCCASIONS[occasion].label}: the groom price for their dog + £{opts?.seasonal_extra?.[occasion] ?? 10}
                  {occasion === "halloween" && " (Halloween shampoo, perfume, bandana & photo)"}.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(opts?.seasonal_services ?? []).map((s) => (
                    <Button key={s} type="button" variant={serviceName === s ? "default" : "outline"} size="sm" onClick={() => setServiceName(s)}>{s}</Button>
                  ))}
                </div>
                {needsBreed && (
                  <div className="space-y-2">
                    <Label>Dog's breed</Label>
                    <Input placeholder="Search breed, e.g. Cockapoo" value={breedSearch} onChange={(e) => { setBreedSearch(e.target.value); setBreedId(""); }} />
                    {!breedId && breedSearch && (
                      <div className="rounded-xl border divide-y max-h-56 overflow-auto">
                        {filteredBreeds.map((b: any) => (
                          <button key={b.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setBreedId(b.id); setBreedSearch(b.name); }}>{b.name}</button>
                        ))}
                        {filteredBreeds.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No match — try another spelling</p>}
                      </div>
                    )}
                  </div>
                )}
                {quote && <p className="font-semibold">{quote.description}: <span className="text-primary">£{quote.amount.toFixed(2)}</span></p>}
                {quoteErr && <p className="text-sm text-destructive">{quoteErr}</p>}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 items-center">
                {(opts?.presets ?? [25, 50, 75, 100]).map((p) => (
                  <Button key={p} type="button" variant={amount === p && !custom ? "default" : "outline"} onClick={() => { setAmount(p); setCustom(""); }}>£{p}</Button>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">or £</span>
                  <Input className="w-24" inputMode="numeric" placeholder="Other" value={custom}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                      setCustom(v);
                      const n = Number(v);
                      setAmount(n >= 10 && n <= 500 ? n : null);
                    }} />
                </div>
                {custom && amount === null && <p className="w-full text-xs text-destructive">Choose between £10 and £500</p>}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl">3. Who's it for?</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <button onClick={() => setSendTo("recipient")} className={cn("rounded-2xl border-2 p-4 text-left", sendTo === "recipient" ? "border-primary bg-primary/5" : "border-border")}>
                <Gift className="h-5 w-5 text-primary" /><p className="font-semibold mt-1">Send directly to them</p><p className="text-xs text-muted-foreground">By email, text or both</p>
              </button>
              <button onClick={() => setSendTo("me")} className={cn("rounded-2xl border-2 p-4 text-left", sendTo === "me" ? "border-primary bg-primary/5" : "border-border")}>
                <User className="h-5 w-5 text-primary" /><p className="font-semibold mt-1">Send it to me</p><p className="text-xs text-muted-foreground">I'll print or pass it on myself</p>
              </button>
            </div>

            {sendTo === "recipient" && (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <div><Label>Their name</Label><Input value={f.rName} onChange={set("rName")} maxLength={100} placeholder="e.g. Sarah & Buster" /></div>
                <div className="flex flex-wrap gap-2">
                  {([["email", "Email", Mail], ["sms", "Text message", MessageSquare], ["both", "Both", Gift]] as const).map(([k, l, Icon]) => (
                    <Button key={k} type="button" size="sm" variant={delivery === k ? "default" : "outline"} onClick={() => setDelivery(k)}><Icon className="h-4 w-4 mr-1" />{l}</Button>
                  ))}
                </div>
                {delivery !== "sms" && <div><Label>Their email</Label><Input type="email" value={f.rEmail} onChange={set("rEmail")} maxLength={255} /></div>}
                {delivery !== "email" && <div><Label>Their UK mobile</Label><Input type="tel" value={f.rPhone} onChange={set("rPhone")} maxLength={20} placeholder="07123 456789" /></div>}
                <div><Label>Gift message (optional)</Label><Textarea value={f.message} onChange={set("message")} maxLength={300} placeholder="Happy Birthday Buster! Love Auntie Sarah xx" /></div>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={copyMe} onCheckedChange={(v) => setCopyMe(!!v)} />Send a copy to my email as well</label>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl">4. Your details</h2>
            <div className="rounded-2xl border bg-card p-4 grid sm:grid-cols-2 gap-3">
              <div><Label>Your name</Label><Input value={f.pName} onChange={set("pName")} maxLength={100} /></div>
              <div><Label>Your email (for your receipt)</Label><Input type="email" value={f.pEmail} onChange={set("pEmail")} maxLength={255} /></div>
              <div className="sm:col-span-2"><Label>Your phone (optional)</Label><Input type="tel" value={f.pPhone} onChange={set("pPhone")} maxLength={20} /></div>
              {sendTo === "me" && <div className="sm:col-span-2"><Label>Gift message (optional)</Label><Textarea value={f.message} onChange={set("message")} maxLength={300} /></div>}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 h-fit space-y-5">
          <VoucherCard occasion={occasion} amount={finalAmount} holder={holder} />
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex justify-between font-semibold text-lg"><span>Total</span><span>{finalAmount ? `£${finalAmount.toFixed(2)}` : "—"}</span></div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} className="mt-0.5" />
              <span>I agree to the <Link to="/terms" target="_blank" className="underline">Terms &amp; Conditions</Link>, including the gift voucher policy (single use, 12 months, no cash value).</span>
            </label>
            <Button className="w-full" size="lg" disabled={busy || !finalAmount} onClick={submit}>
              <Lock className="h-4 w-4 mr-2" />{busy ? "Opening secure payment…" : `Pay ${finalAmount ? `£${finalAmount.toFixed(2)}` : ""} securely`}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Your voucher is created only after your card payment succeeds.</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
