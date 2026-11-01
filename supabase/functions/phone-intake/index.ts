import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const detailsSchema = z.object({ first_name: z.string().trim().min(1).max(100), surname: z.string().trim().min(1).max(100), email: z.string().trim().email().max(255), dog_name: z.string().trim().min(1).max(100), breed: z.string().trim().min(1).max(120), notes: z.string().trim().max(4000), alternatives: z.string().trim().max(2000) });
const photoSchema = z.object({ path: z.string().max(250), name: z.string().max(150), type: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]), size: z.number().int().min(1).max(20 * 1024 * 1024) });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const token = z.string().regex(/^[a-f0-9]{48}$/).parse(body.token);
    const { data: row, error } = await sb.from("phone_intakes").select("*").eq("token", token).maybeSingle();
    if (error) throw error;
    if (!row || row.status === "closed") return json({ error: "This link is unavailable. Please contact the salon." }, 404);
    if (body.action === "view") {
      // Only the phone and agreed slot are returned, never previously submitted personal details.
      return json({ phone: row.phone, status: row.status, slot_date: row.slot_date, slot_time: row.slot_time, hold_expires_at: row.hold_expires_at, hold_released_at: row.hold_released_at, server_now: new Date().toISOString() });
    }
    if (row.status !== "awaiting") return json({ error: "We've already received the details for this link." }, 409);
    if (body.action === "upload") {
      const photo = photoSchema.omit({ path: true }).parse(body.photo);
      // Reserve upload slots atomically so the capability cannot be used for unlimited uploads.
      const paths: string[] = row.upload_paths ?? [];
      if (paths.length >= 6) return json({ error: "A maximum of six photos can be attached." }, 400);
      const ext = photo.type.split("/")[1];
      const path = `${row.id}/${crypto.randomUUID()}.${ext}`;
      const { data: updated, error: updateErr } = await sb.from("phone_intakes").update({ upload_paths: [...paths, path] }).eq("id", row.id).eq("status", "awaiting").eq("upload_paths", paths).select("id").maybeSingle();
      if (updateErr || !updated) return json({ error: "Please try attaching the photo again." }, 409);
      const { data: signed, error: signErr } = await sb.storage.from("phone-intakes").createSignedUploadUrl(path);
      if (signErr) throw signErr;
      return json({ path, upload_token: signed.token });
    }
    if (body.action === "submit") {
      const details = detailsSchema.parse(body.details);
      const attachments = z.array(photoSchema).max(6).parse(body.attachments ?? []);
      for (const photo of attachments) {
        if (!(row.upload_paths ?? []).includes(photo.path)) return json({ error: "Invalid photo attachment." }, 400);
        const name = photo.path.split("/")[1];
        const { data: files } = await sb.storage.from("phone-intakes").list(row.id, { search: name });
        if (!files?.some(f => f.name === name && Number(f.metadata?.size) <= 20 * 1024 * 1024 && ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(f.metadata?.mimetype))) return json({ error: "A photo has not finished uploading. Please try again." }, 400);
      }
      const { error: submitErr } = await sb.rpc("submit_phone_intake", { _token: token, _details: details, _attachments: attachments });
      if (submitErr) throw submitErr;
      return json({ success: true });
    }
    return json({ error: "Unknown request" }, 400);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "Please check the form fields and photo sizes." }, 400);
    return json({ error: "Couldn't save your request. Please try again." }, 400);
  }
});