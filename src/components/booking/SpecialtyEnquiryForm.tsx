import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Paperclip, X, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";

const schema = z.object({
  customer_name: z.string().trim().min(1, "Please enter your name").max(120),
  phone: z.string().trim().min(6, "Please enter a contact number").max(40),
  email: z.string().trim().email("Please enter a valid email").max(255).or(z.literal("")),
  dog_name: z.string().trim().max(80),
  breed: z.string().trim().min(1, "Please tell us the breed").max(120),
  request_details: z.string().trim().min(5, "Please describe what you'd like").max(4000),
});

const MAX_FILES = 6;
const MAX_SIZE = 20 * 1024 * 1024;

interface Props {
  defaultDogName?: string;
  defaultBreed?: string;
  onBack: () => void;
  onDone: () => void;
}

export function SpecialtyEnquiryForm({ defaultDogName, defaultBreed, onBack, onDone }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    customer_name: "", phone: "", email: user?.email ?? "",
    dog_name: defaultDogName ?? "", breed: defaultBreed ?? "", request_details: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      const p = data as Record<string, any> | null;
      setForm((f) => ({
        ...f,
        customer_name: f.customer_name || p?.full_name || "",
        phone: f.phone || p?.phone || "",
        email: f.email || user.email || "",
      }));
      const { data: pets } = await supabase.from("customer_pets").select("*").eq("user_id", user.id).limit(1);
      const pet = (pets as any[] | null)?.[0];
      if (pet) setForm((f) => ({ ...f, dog_name: f.dog_name || pet.name || pet.pet_name || "" }));
    })();
  }, [user]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) break;
      if (f.size > MAX_SIZE) { setErrors((e) => ({ ...e, files: `${f.name} is over 20MB` })); continue; }
      next.push(f);
    }
    setFiles(next);
  };

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[String(i.path[0])] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const folder = crypto.randomUUID();
      const attachments: { path: string; name: string; type: string; size: number }[] = [];
      for (const f of files) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
        const path = `${folder}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage.from("specialty-enquiries").upload(path, f, {
          contentType: f.type || "application/octet-stream",
        });
        if (error) throw error;
        attachments.push({ path, name: f.name, type: f.type, size: f.size });
      }
      const v = parsed.data;
      const { error } = await supabase.from("specialty_enquiries").insert({
        customer_user_id: user?.id ?? null,
        customer_name: v.customer_name,
        phone: v.phone,
        email: v.email || null,
        dog_name: v.dog_name || null,
        breed: v.breed,
        request_details: v.request_details,
        attachments,
      });
      if (error) throw error;
      setDone(true);
    } catch (e: any) {
      setErrors({ submit: "Sorry, something went wrong sending your request. Please try again." });
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="px-6 py-14 text-center max-w-md mx-auto">
        <CheckCircle2 className="h-14 w-14 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-heading mb-2">Thank you!</h2>
        <p className="text-muted-foreground mb-8">
          We've received your request. A groomer will review the details and be in touch shortly.
        </p>
        <Button onClick={onDone} className="rounded-full px-8">Close</Button>
      </div>
    );
  }

  const err = (k: string) => errors[k] && <p className="text-xs text-destructive mt-1">{errors[k]}</p>;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-lg mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div>
        <h2 className="text-xl sm:text-2xl font-heading">Specialty grooming request</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us what you'd like. A groomer will check whether we can do it, how long it will take and the price, then contact you.
        </p>
      </div>
      <div><Label>Your name</Label><Input value={form.customer_name} onChange={set("customer_name")} maxLength={120} />{err("customer_name")}</div>
      <div><Label>Phone number</Label><Input type="tel" value={form.phone} onChange={set("phone")} maxLength={40} />{err("phone")}</div>
      <div><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} maxLength={255} />{err("email")}</div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Dog's name</Label><Input value={form.dog_name} onChange={set("dog_name")} maxLength={80} /></div>
        <div><Label>Breed</Label><Input value={form.breed} onChange={set("breed")} maxLength={120} />{err("breed")}</div>
      </div>
      <div>
        <Label>What would you like?</Label>
        <Textarea rows={5} value={form.request_details} onChange={set("request_details")} maxLength={4000}
          placeholder="e.g. show trim, hand stripping, a specific style…" />
        {err("request_details")}
      </div>
      <div>
        <Label>Photos or files (optional)</Label>
        <label className="mt-1 flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl py-5 cursor-pointer text-sm text-muted-foreground hover:bg-muted/40">
          <Paperclip className="h-4 w-4" /> Attach photos or files
          <input type="file" multiple accept="*/*" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                <span className="truncate">{f.name}</span>
                <button onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {err("files")}
      </div>
      {err("submit")}
      <Button onClick={submit} disabled={submitting} className="w-full rounded-full h-12">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send request"}
      </Button>
    </div>
  );
}
