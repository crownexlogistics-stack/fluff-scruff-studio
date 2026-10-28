import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GroomerLayout } from "@/components/GroomerLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy, FileText, Scissors, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useToast } from "@/hooks/use-toast";

type Attachment = { path: string; name: string; type: string; size: number };
type Enquiry = {
  id: string; created_at: string; customer_name: string; phone: string; email: string | null;
  dog_name: string | null; breed: string | null; request_details: string; attachments: Attachment[];
  status: "new" | "claimed" | "booked" | "declined"; claimed_by_staff_id: string | null;
  claimed_by_name: string | null; claimed_at: string | null; outcome_note: string | null; resolved_at: string | null;
};

const fmt = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS_LABEL: Record<Enquiry["status"], string> = { new: "New", claimed: "Claimed", booked: "Booked", declined: "Declined" };

export default function SpecialtyGroomingPage() {
  const { user } = useAuth();
  const { role } = useUserRole(user?.id);
  const { staff } = useCurrentStaff();
  const { toast } = useToast();
  const isGroomer = role === "groomer";
  const Layout = isGroomer ? GroomerLayout : AppLayout;

  const [rows, setRows] = useState<Enquiry[]>([]);
  const [open, setOpen] = useState<Enquiry | null>(null);
  const [outcome, setOutcome] = useState<{ kind: "booked" | "declined"; note: string } | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("specialty_enquiries").select("*").order("created_at", { ascending: false });
    if (error) { toast({ title: "Couldn't load requests", variant: "destructive" }); return; }
    setRows((data ?? []) as unknown as Enquiry[]);
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel("specialty-enquiries")
      .on("postgres_changes", { event: "*", schema: "public", table: "specialty_enquiries" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const next: Record<string, string> = {};
      for (const a of open.attachments ?? []) {
        const { data } = await supabase.storage.from("specialty-enquiries").createSignedUrl(a.path, 3600);
        if (data?.signedUrl) next[a.path] = data.signedUrl;
      }
      setUrls(next);
    })();
  }, [open]);

  const pool = useMemo(() => rows.filter((r) => r.status === "new"), [rows]);
  const active = useMemo(() => rows.filter((r) => r.status === "claimed" && (!isGroomer || r.claimed_by_staff_id === staff?.id)), [rows, isGroomer, staff]);
  const past = useMemo(() => rows.filter((r) => (r.status === "booked" || r.status === "declined") && (!isGroomer || r.claimed_by_staff_id === staff?.id)), [rows, isGroomer, staff]);

  const claim = async (r: Enquiry) => {
    if (!staff) { toast({ title: "Your staff profile wasn't found", variant: "destructive" }); return; }
    const { data, error } = await supabase.from("specialty_enquiries")
      .update({ status: "claimed", claimed_by_staff_id: staff.id, claimed_by_name: staff.name, claimed_at: new Date().toISOString() })
      .eq("id", r.id).eq("status", "new").select().maybeSingle();
    if (error || !data) { toast({ title: "Someone else has already claimed this", variant: "destructive" }); load(); return; }
    toast({ title: "Claimed — it's now in your list" });
    setOpen(data as unknown as Enquiry);
    load();
  };

  const resolve = async () => {
    if (!open || !outcome) return;
    const { error } = await supabase.from("specialty_enquiries")
      .update({ status: outcome.kind, outcome_note: outcome.note.trim().slice(0, 2000) || null, resolved_at: new Date().toISOString() })
      .eq("id", open.id);
    if (error) { toast({ title: "Couldn't save", variant: "destructive" }); return; }
    toast({ title: outcome.kind === "booked" ? "Marked as booked" : "Marked as declined" });
    setOutcome(null); setOpen(null); load();
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast({ title: "Copied" }); };

  const List = ({ items, empty }: { items: Enquiry[]; empty: string }) => (
    items.length === 0 ? <p className="text-muted-foreground text-sm py-10 text-center">{empty}</p> : (
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((r) => (
          <Card key={r.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpen(r)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.customer_name}</p>
                <p className="text-sm text-muted-foreground">{[r.dog_name, r.breed].filter(Boolean).join(" · ")}</p>
              </div>
              <Badge variant={r.status === "new" ? "default" : "secondary"}>{STATUS_LABEL[r.status]}</Badge>
            </div>
            <p className="text-sm mt-2 line-clamp-2">{r.request_details}</p>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>{fmt(r.created_at)}</span>
              <span className="flex items-center gap-3">
                {r.attachments?.length > 0 && <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{r.attachments.length}</span>}
                {r.claimed_by_name && <span>Claimed by {r.claimed_by_name}</span>}
              </span>
            </div>
          </Card>
        ))}
      </div>
    )
  );

  const canAct = open && (!isGroomer || open.claimed_by_staff_id === staff?.id);

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-1"><Scissors className="h-6 w-6 text-primary" /><h1 className="text-2xl font-heading">Specialty Grooming</h1></div>
        <p className="text-sm text-muted-foreground mb-5">Requests for show trims, hand stripping and special styles. Claim one you can do, contact the customer, then mark it booked or declined.</p>
        <Tabs defaultValue="new">
          <TabsList>
            <TabsTrigger value="new">New ({pool.length})</TabsTrigger>
            <TabsTrigger value="active">{isGroomer ? "My claimed" : "Claimed"} ({active.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="new" className="mt-4"><List items={pool} empty="No new requests." /></TabsContent>
          <TabsContent value="active" className="mt-4"><List items={active} empty="Nothing claimed right now." /></TabsContent>
          <TabsContent value="past" className="mt-4"><List items={past} empty="No past requests yet." /></TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => { if (!o) { setOpen(null); setOutcome(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {open && (<>
            <DialogHeader><DialogTitle>{open.customer_name} — {STATUS_LABEL[open.status]}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                <p className="text-lg font-semibold">{open.customer_name}</p>
                <div className="flex items-center gap-2 text-lg"><span className="font-mono">{open.phone}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(open.phone)}><Copy className="h-4 w-4" /></Button></div>
                {open.email && <div className="flex items-center gap-2"><span>{open.email}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(open.email!)}><Copy className="h-4 w-4" /></Button></div>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Dog:</span> {open.dog_name || "—"}</div>
                <div><span className="text-muted-foreground">Breed:</span> {open.breed || "—"}</div>
                <div><span className="text-muted-foreground">Received:</span> {fmt(open.created_at)}</div>
                {open.claimed_by_name && <div><span className="text-muted-foreground">Claimed by:</span> {open.claimed_by_name}{open.claimed_at ? ` (${fmt(open.claimed_at)})` : ""}</div>}
              </div>
              <div><p className="text-sm text-muted-foreground mb-1">What they want</p><p className="whitespace-pre-wrap">{open.request_details}</p></div>
              {open.attachments?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {open.attachments.map((a) => {
                    const u = urls[a.path];
                    const isImg = a.type?.startsWith("image/") && !/heic|heif/i.test(a.type);
                    return isImg && u ? (
                      <button key={a.path} onClick={() => setPreview(u)}><img src={u} alt={a.name} className="w-full h-28 object-cover rounded-lg" /></button>
                    ) : (
                      <a key={a.path} href={u} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center h-28 rounded-lg bg-muted text-xs p-2 text-center">
                        <FileText className="h-6 w-6 mb-1" /><span className="truncate w-full">{a.name}</span>
                      </a>
                    );
                  })}
                </div>
              )}
              {open.outcome_note && <div><p className="text-sm text-muted-foreground mb-1">Outcome note</p><p className="whitespace-pre-wrap">{open.outcome_note}</p></div>}
              {outcome && (
                <Textarea rows={3} maxLength={2000} value={outcome.note} onChange={(e) => setOutcome({ ...outcome, note: e.target.value })}
                  placeholder={outcome.kind === "booked" ? "Date, time and agreed price" : "Reason (e.g. not something we offer)"} />
              )}
            </div>
            <DialogFooter className="gap-2">
              {open.status === "new" && <Button onClick={() => claim(open)}>Claim this groom</Button>}
              {open.status === "claimed" && canAct && !outcome && (<>
                <Button variant="outline" onClick={() => setOutcome({ kind: "declined", note: "" })}>Declined / not suitable</Button>
                <Button onClick={() => setOutcome({ kind: "booked", note: "" })}>Booked</Button>
              </>)}
              {outcome && (<>
                <Button variant="ghost" onClick={() => setOutcome(null)}>Cancel</Button>
                <Button onClick={resolve}>Save as {outcome.kind}</Button>
              </>)}
            </DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl p-2">{preview && <img src={preview} alt="Attachment" className="w-full h-auto rounded" />}</DialogContent>
      </Dialog>
    </Layout>
  );
}
