import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, Clock, Paperclip, X } from "lucide-react";
import logo from "@/assets/logo-transparent.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { intakeAction, intakeDetailsSchema, holdIsActive, type IntakePhoto, type PhoneIntake } from "@/lib/phoneIntakes";
type PublicIntake = Pick<PhoneIntake, "phone" | "status" | "slot_date" | "slot_time" | "hold_expires_at" | "hold_released_at"> & { server_now: string };
export default function PhoneIntakeFormPage() {
  const { token } = useParams();
  const [row, setRow] = useState<PublicIntake | null>(null);
  const [form, setForm] = useState({ first_name: "", surname: "", email: "", dog_name: "", breed: "", notes: "", alternatives: "" });
  const [photos, setPhotos] = useState<IntakePhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [consent, setConsent] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    intakeAction<PublicIntake>({ action: "view", token }).then(r => { setRow(r); setOffset(Date.parse(r.server_now) - Date.now()); setDone(r.status !== "awaiting"); }).catch(e => setError(e.message));
  }, [token]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const upload = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true); setError("");
    try {
      if (photos.length + files.length > 6) throw new Error("Please attach no more than six photos.");
      for (const file of Array.from(files)) {
        if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error("Choose a dog photo in JPG, PNG, WebP or HEIC format, under 20MB.");
        const photo = { name: file.name.slice(0, 150), type: file.type, size: file.size };
        const signed = await intakeAction<{ path: string; upload_token: string }>({ action: "upload", token, photo });
        const { error: uploadError } = await supabase.storage.from("phone-intakes").uploadToSignedUrl(signed.path, signed.upload_token, file, { contentType: file.type });
        if (uploadError) throw new Error("Photo upload failed. Please try again.");
        setPhotos(p => [...p, { ...photo, path: signed.path }]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Photo upload failed"); }
    finally { setBusy(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    const parsed = intakeDetailsSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your details"); return; }
    if (!consent) { setError("Please confirm we can use these details to arrange your appointment."); return; }
    setBusy(true);
    try { await intakeAction({ action: "submit", token, details: parsed.data, attachments: photos }); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  };
  const active = row && holdIsActive(row, now + offset);
  const minutes = row?.hold_expires_at ? Math.max(0, Math.ceil((Date.parse(row.hold_expires_at) - now - offset) / 60000)) : 0;
  return <main className="min-h-screen bg-background text-foreground px-5 py-8"><div className="mx-auto max-w-lg">
    <Link to="/" className="flex items-center gap-3 mb-8"><img src={logo} alt="Fluff & Scruff" className="h-14 w-auto" /><span className="font-heading text-xl">Fluff & Scruff Studio</span></Link>
    {done ? <div className="py-8 space-y-4"><CheckCircle2 className="h-12 w-12 text-primary" /><h1 className="font-heading text-3xl">Thank you!</h1><p>Your details have been received. We’ll contact you to confirm your appointment and price.</p><p className="text-sm text-muted-foreground">Submitting this form does not confirm a booking. All dates and times are subject to availability.</p></div> : <>
      <h1 className="text-3xl font-heading">Your dog’s appointment</h1><p className="mt-2 mb-6 text-muted-foreground">Let’s get your details right.</p>
      {row?.slot_date && <div className="border-l-4 border-primary bg-primary/10 p-4 mb-6 space-y-2"><p className="font-semibold">Discussed appointment: {new Date(`${row.slot_date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at {row.slot_time?.slice(0, 5)}</p><p className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />{active ? `Temporarily held — ${minutes} minute${minutes === 1 ? "" : "s"} remaining` : "Not reserved — we’ll confirm availability with you."}</p><p className="text-sm">Subject to availability and salon confirmation. A hold lasts one hour from when the link was created, not from submission.</p></div>}
      {!row && !error && <p>Loading your form…</p>}
      {row && <form onSubmit={submit} className="space-y-5">
        <div><Label htmlFor="intake-mobile">Mobile number</Label><Input id="intake-mobile" value={row.phone} readOnly type="tel" autoComplete="tel" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{([['first_name','First name'],['surname','Surname']] as const).map(([key, label]) => <div key={key}><Label htmlFor={key}>{label}</Label><Input id={key} required autoComplete={key === "first_name" ? "given-name" : "family-name"} maxLength={100} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}</div>
        {([['email','Email address'],['dog_name',"Dog’s name"],['breed','Breed / crossbreed']] as const).map(([key, label]) => <div key={key}><Label htmlFor={key}>{label}</Label><Input id={key} required type={key === "email" ? "email" : "text"} autoComplete={key === "email" ? "email" : "off"} value={form[key]} maxLength={key === "email" ? 255 : 120} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}
        <div><Label htmlFor="notes">Special notes (optional)</Label><Textarea id="notes" rows={4} maxLength={4000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Grooming needs, health concerns or anything we should know" /></div>
        <div><Label htmlFor="alternatives">Preferred or alternative dates / times (optional)</Label><Textarea id="alternatives" rows={3} maxLength={2000} value={form.alternatives} onChange={e => setForm({ ...form, alternatives: e.target.value })} placeholder="If you'd prefer another time, tell us when you can come" /><p className="mt-1 text-xs text-muted-foreground">Requesting an alternative releases any temporary hold. All appointments are subject to availability.</p></div>
        <div><Label htmlFor="photos">Dog photos (optional)</Label><div className="flex items-center gap-2 mt-2"><Paperclip className="h-4 w-4" /><Input id="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple disabled={busy} onChange={e => { upload(e.target.files); e.target.value = ""; }} /></div>{photos.map(p => <div key={p.path} className="flex items-center justify-between gap-2 mt-2 text-sm"><span className="truncate">{p.name}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${p.name}`} onClick={() => setPhotos(photos.filter(x => x.path !== p.path))}><X className="h-4 w-4" /></Button></div>)}</div>
        <label className="flex items-start gap-3 text-sm"><Checkbox checked={consent} onCheckedChange={v => setConsent(v === true)} /><span>I agree that Fluff & Scruff can use these details and photos to arrange my dog’s appointment.</span></label>
        <p className="text-sm text-muted-foreground">This is an enquiry, not a confirmed booking. The salon will confirm availability and price.</p>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <Button type="submit" className="w-full h-12" disabled={busy}>{busy ? "Please wait…" : "Send my details"}</Button>
      </form>}{!row && error && <p role="alert" className="text-destructive">{error}</p>}
    </>}
  </div></main>;
}