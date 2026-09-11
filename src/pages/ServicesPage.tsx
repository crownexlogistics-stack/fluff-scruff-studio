import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ImagePlus,
  Loader2,
  Monitor,
  Smartphone,
  ChevronRight,
  Clock,
  PoundSterling,
  Globe,
  EyeOff,
} from "lucide-react";
import {
  DEFAULT_SERVICE_IMAGE,
  FALLBACK_SERVICE_IMAGES,
  type ServiceRow,
} from "@/hooks/useWebsiteServices";
import { friendlyError } from "@/lib/friendlyError";
import { safeUuid } from "@/lib/safeUuid";

/** Ten years — the website is public so image links must not expire in practice. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

interface Groomer {
  id: string;
  name: string;
  account_blocked: boolean | null;
}

interface FormState {
  id: string | null;
  name: string;
  tagline: string;
  description: string;
  price: string;
  duration: string;
  imageUrl: string | null;
  isActive: boolean;
  showOnWebsite: boolean;
  sortOrder: string;
  groomerIds: string[];
  /** "" = stands on its own, otherwise the id of the service it sits inside. */
  parentId: string;
  isGroup: boolean;
}

const emptyForm: FormState = {
  id: null,
  name: "",
  tagline: "",
  description: "",
  price: "",
  duration: "60",
  imageUrl: null,
  isActive: true,
  showOnWebsite: true,
  sortOrder: "100",
  groomerIds: [],
  parentId: "",
  isGroup: false,
};

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: services, isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select(
          "id, name, description, tagline, image_url, fixed_price, duration_minutes, is_active, show_on_website, sort_order, parent_service_id, is_group"
        )
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as ServiceRow[];
    },
  });

  const { data: groomers } = useQuery({
    queryKey: ["services-groomers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, name, account_blocked")
        .eq("role", "Groomer")
        .order("name");
      if (error) throw error;
      return (data || []).filter((g) => !g.account_blocked) as Groomer[];
    },
  });

  const { data: staffServices } = useQuery({
    queryKey: ["services-staff-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_services").select("staff_id, service_id");
      if (error) throw error;
      return (data || []) as { staff_id: string; service_id: string }[];
    },
  });

  /** Groomers with zero rows can perform every service (legacy safe default). */
  const groomerHasRestrictions = useMemo(() => {
    const set = new Set((staffServices || []).map((r) => r.staff_id));
    return (staffId: string) => set.has(staffId);
  }, [staffServices]);

  const canGroomerDo = (staffId: string, serviceId: string) =>
    !groomerHasRestrictions(staffId) ||
    (staffServices || []).some((r) => r.staff_id === staffId && r.service_id === serviceId);

  const groomersForService = (serviceId: string) =>
    (groomers || []).filter((g) => canGroomerDo(g.id, serviceId));

  const openAdd = () => {
    setForm({
      ...emptyForm,
      sortOrder: String(((services?.[services.length - 1]?.sort_order ?? 100) || 100) + 10),
      // A brand new service is offered by every groomer until switched off.
      groomerIds: (groomers || []).map((g) => g.id),
    });
    setDialogOpen(true);
  };

  const openEdit = (s: ServiceRow) => {
    setForm({
      id: s.id,
      name: s.name,
      tagline: s.tagline ?? "",
      description: s.description ?? "",
      price: s.fixed_price != null ? String(s.fixed_price) : "",
      duration: s.duration_minutes != null ? String(s.duration_minutes) : "",
      imageUrl: s.image_url,
      isActive: s.is_active,
      showOnWebsite: s.show_on_website,
      sortOrder: String(s.sort_order ?? 100),
      groomerIds: (groomers || []).filter((g) => canGroomerDo(g.id, s.id)).map((g) => g.id),
      parentId: s.parent_service_id ?? "",
      isGroup: !!s.is_group,
    });
    setDialogOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${safeUuid()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("service-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("service-images")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (signErr) throw signErr;
      setForm((f) => ({ ...f, imageUrl: signed.signedUrl }));
      toast.success("Photo uploaded");
    } catch (e: any) {
      toast.error(friendlyError(e) || "Could not upload that photo");
    } finally {
      setUploading(false);
    }
  };

  /**
   * Keeps staff_services correct for one service without accidentally
   * restricting a groomer who previously had no restrictions at all.
   */
  const syncGroomers = async (serviceId: string, enabledIds: string[]) => {
    const all = groomers || [];
    const activeServiceIds = (services || []).filter((s) => s.is_active).map((s) => s.id);
    if (!activeServiceIds.includes(serviceId)) activeServiceIds.push(serviceId);

    for (const g of all) {
      const shouldDo = enabledIds.includes(g.id);
      const restricted = groomerHasRestrictions(g.id);
      const currentlyDoes = canGroomerDo(g.id, serviceId);
      if (shouldDo === currentlyDoes) continue;

      if (!shouldDo && !restricted) {
        // Materialise the "everything except this one" list for this groomer.
        const rows = activeServiceIds
          .filter((id) => id !== serviceId)
          .map((service_id) => ({ staff_id: g.id, service_id }));
        if (rows.length > 0) {
          const { error } = await supabase.from("staff_services").insert(rows);
          if (error) throw error;
        }
      } else if (!shouldDo && restricted) {
        const { error } = await supabase
          .from("staff_services")
          .delete()
          .eq("staff_id", g.id)
          .eq("service_id", serviceId);
        if (error) throw error;
      } else if (shouldDo && restricted) {
        const { error } = await supabase
          .from("staff_services")
          .insert({ staff_id: g.id, service_id: serviceId });
        if (error) throw error;
      }
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (vals: FormState) => {
      const name = vals.name.trim();
      if (!name) throw new Error("Please give the service a name");
      const price = vals.price.trim() === "" ? null : Number(vals.price);
      const duration = vals.duration.trim() === "" ? null : Math.round(Number(vals.duration));
      // Options inside a group (and the group tile itself) may be priced by breed.
      const pricingOptional = !!vals.parentId || vals.isGroup;
      if (!pricingOptional) {
        if (price == null || Number.isNaN(price) || price < 0)
          throw new Error("Please enter a price for this service");
        if (!duration || Number.isNaN(duration) || duration < 5)
          throw new Error("Please enter how long the appointment takes (at least 5 minutes)");
      }

      const payload = {
        name,
        tagline: vals.tagline.trim() || null,
        description: vals.description.trim() || null,
        fixed_price: price,
        duration_minutes: duration,
        image_url: vals.imageUrl,
        is_active: vals.isGroup ? false : vals.isActive,
        // Something that sits inside another service never gets its own tile.
        show_on_website: vals.parentId ? false : vals.showOnWebsite,
        sort_order: Number(vals.sortOrder) || 100,
        parent_service_id: vals.parentId || null,
        is_group: vals.isGroup,
      };

      let serviceId = vals.id;
      if (serviceId) {
        const { error } = await supabase.from("services").update(payload as any).eq("id", serviceId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("services")
          .insert(payload as any)
          .select("id")
          .single();
        if (error) throw error;
        serviceId = data.id;
      }

      if (!serviceId) throw new Error("The service could not be saved");

      // Whatever we just put a service inside becomes a group tile.
      if (vals.parentId) {
        const { error } = await supabase
          .from("services")
          .update({ is_group: true, is_active: false } as any)
          .eq("id", vals.parentId);
        if (error) throw error;
      }

      await syncGroomers(serviceId, vals.groomerIds);
      return serviceId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.invalidateQueries({ queryKey: ["services-staff-services"] });
      queryClient.invalidateQueries({ queryKey: ["website-services"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["services_list"] });
      queryClient.invalidateQueries({ queryKey: ["services-list-full"] });
      queryClient.invalidateQueries({ queryKey: ["staff-services-all"] });
      queryClient.invalidateQueries({ queryKey: ["staff-services-newbooking"] });
      setDialogOpen(false);
      toast.success("Service saved — customers can book it straight away");
    },
    onError: (e: any) => toast.error(friendlyError(e) || e.message || "Could not save the service"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("services").update({ is_active: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.invalidateQueries({ queryKey: ["website-services"] });
    },
    onError: (e: any) => toast.error(friendlyError(e) || "Could not change that service"),
  });

  const toggleWebsite = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("services")
        .update({ show_on_website: value } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.invalidateQueries({ queryKey: ["website-services"] });
    },
    onError: (e: any) => toast.error(friendlyError(e) || "Could not change that service"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (s: ServiceRow) => {
      const { count, error: cErr } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("service_id", s.id);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(
          `${s.name} is used on ${count} appointment${count === 1 ? "" : "s"}, so it can't be deleted. Switch it off instead.`
        );
      }
      await supabase.from("staff_services").delete().eq("service_id", s.id);
      await supabase.from("add_on_services").delete().eq("service_id", s.id);
      await supabase.from("service_prices").delete().eq("service_id", s.id);
      const { error } = await supabase.from("services").delete().eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.invalidateQueries({ queryKey: ["website-services"] });
      queryClient.invalidateQueries({ queryKey: ["services-staff-services"] });
      setDeleteTarget(null);
      toast.success("Service deleted");
    },
    onError: (e: any) => toast.error(e.message || "Could not delete the service"),
  });

  const previewImage =
    form.imageUrl || FALLBACK_SERVICE_IMAGES[form.name]?.image || DEFAULT_SERVICE_IMAGE;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-heading text-foreground">Services</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Everything customers can book. Anything switched on here appears on the website,
              in the booking flow and on the groomers' calendars.
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> New service
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Full Groom</strong> and{" "}
          <strong className="text-foreground">Bath &amp; Brush</strong> are priced per breed on the
          Breeds page, so they don't have their own price here. All other services use the fixed
          price and length you set below.
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading services…
          </div>
        ) : (
          <div className="space-y-3">
            {(services || []).map((s) => {
              const assigned = groomersForService(s.id);
              const img =
                s.image_url || FALLBACK_SERVICE_IMAGES[s.name]?.image || DEFAULT_SERVICE_IMAGE;
              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-4"
                >
                  <div className="h-20 w-20 shrink-0 rounded-xl overflow-hidden bg-muted">
                    <img src={img} alt={s.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{s.name}</p>
                      {!s.is_active && <Badge variant="secondary">Switched off</Badge>}
                      {s.is_active && s.show_on_website ? (
                        <Badge variant="outline" className="gap-1">
                          <Globe className="h-3 w-3" /> On website
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <EyeOff className="h-3 w-3" /> Not on website
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {s.tagline || s.description || "No description yet"}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <PoundSterling className="h-3.5 w-3.5" />
                        {s.fixed_price != null ? Number(s.fixed_price).toFixed(2) : "Priced by breed"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {s.duration_minutes ? `${s.duration_minutes} min` : "Length from breed"}
                      </span>
                      <span>
                        {assigned.length === (groomers?.length ?? 0)
                          ? "All groomers"
                          : assigned.length === 0
                            ? "No groomers — customers can't book this"
                            : assigned.map((g) => g.name).join(", ")}
                      </span>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center gap-3 sm:gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={s.is_active}
                        onCheckedChange={(v) => toggleActive.mutate({ id: s.id, value: v })}
                      />
                      <span className="text-xs text-muted-foreground">Bookable</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={s.show_on_website}
                        onCheckedChange={(v) => toggleWebsite.mutate({ id: s.id, value: v })}
                      />
                      <span className="text-xs text-muted-foreground">Website</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(s)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add / edit dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit service" : "New service"}</DialogTitle>
            <DialogDescription>
              Once saved and switched on, customers can book this straight away.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: form */}
            <div className="space-y-4">
              <div>
                <Label>Service name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. De-Shedding Treatment"
                />
              </div>

              <div>
                <Label>Short line for the website</Label>
                <Textarea
                  rows={2}
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="One friendly sentence customers will read on the website"
                />
              </div>

              <div>
                <Label>Longer description (optional)</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price (£)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="25.00"
                  />
                </div>
                <div>
                  <Label>Appointment length (minutes)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    placeholder="30"
                  />
                </div>
              </div>

              <div>
                <Label>Photo</Label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted shrink-0">
                    <img src={previewImage} alt="" className="h-full w-full object-cover" />
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {form.imageUrl ? "Replace photo" : "Upload photo"}
                  </Button>
                  {form.imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setForm({ ...form, imageUrl: null })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label>Is this part of another service?</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                >
                  <option value="">No — it stands on its own</option>
                  {(services || [])
                    .filter((p) => p.id !== form.id && !p.parent_service_id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        Inside “{p.name}”
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {form.parentId
                    ? "Customers won't see this as its own tile — they pick it after choosing the service it sits inside."
                    : "It gets its own tile on the website (if switched on below)."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <span className="text-sm">Bookable</span>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <span className="text-sm">
                    {form.parentId ? "Shown inside its main service" : "Show on website"}
                  </span>
                  <Switch
                    checked={form.parentId ? true : form.showOnWebsite}
                    disabled={!!form.parentId}
                    onCheckedChange={(v) => setForm({ ...form, showOnWebsite: v })}
                  />
                </div>
              </div>


              <div>
                <Label>Position on the website (lower shows first)</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>

              <div>
                <Label>Which groomers offer this?</Label>
                <div className="mt-2 space-y-2">
                  {(groomers || []).map((g) => {
                    const checked = form.groomerIds.includes(g.id);
                    return (
                      <div
                        key={g.id}
                        className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                      >
                        <span className="text-sm">{g.name}</span>
                        <Switch
                          checked={checked}
                          onCheckedChange={(v) =>
                            setForm({
                              ...form,
                              groomerIds: v
                                ? [...form.groomerIds, g.id]
                                : form.groomerIds.filter((id) => id !== g.id),
                            })
                          }
                        />
                      </div>
                    );
                  })}
                  {(groomers || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No groomers set up yet.</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Switched off means the groomer never gets offered for this service — online or in
                  the salon.
                </p>
              </div>
            </div>

            {/* Right: live preview */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={previewDevice === "desktop" ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => setPreviewDevice("desktop")}
                >
                  <Monitor className="h-4 w-4" /> Website
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewDevice === "mobile" ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => setPreviewDevice("mobile")}
                >
                  <Smartphone className="h-4 w-4" /> Mobile
                </Button>
              </div>

              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 flex justify-center">
                <div
                  className={
                    previewDevice === "mobile"
                      ? "w-[320px] rounded-[28px] border-8 border-foreground/80 bg-background p-3"
                      : "w-full bg-background rounded-xl p-3"
                  }
                >
                  {/* Website tile preview (mirrors ServiceTile) */}
                  <div className="w-full rounded-2xl overflow-hidden bg-card border border-border flex">
                    <div className="w-1/2 relative overflow-hidden">
                      <img
                        src={previewImage}
                        alt={form.name || "Service"}
                        className="w-full h-full object-cover aspect-square"
                      />
                    </div>
                    <div className="w-1/2 p-4 flex flex-col justify-center">
                      <h3
                        className={`font-heading text-primary mb-1.5 ${previewDevice === "mobile" ? "text-base" : "text-lg"}`}
                      >
                        {form.name || "Service name"}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground font-body leading-relaxed line-clamp-3">
                        {form.tagline || form.description || "Your short website line goes here."}
                      </p>
                      <div className="mt-3 flex items-center gap-1 text-xs sm:text-sm font-semibold font-body text-accent">
                        Book now <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  {/* Booking flow row preview */}
                  <div className="mt-3 rounded-2xl border-2 border-border/60 bg-card p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden">
                        <img src={previewImage} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">
                          {form.name || "Service name"}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {form.tagline || form.description || "Short line"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                    Customers pay <strong className="text-foreground">£{form.price || "0.00"}</strong>{" "}
                    and the appointment blocks{" "}
                    <strong className="text-foreground">{form.duration || "0"} minutes</strong> in the
                    diary.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || uploading}
              className="gap-2"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save service
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the service completely. If it has ever been used on an appointment it
              can't be deleted — switch it off instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
