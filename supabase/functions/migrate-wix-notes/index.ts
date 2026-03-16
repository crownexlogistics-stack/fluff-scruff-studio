import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface WixContact {
  id: string;
  info?: {
    name?: { first?: string; last?: string };
    emails?: { items?: { email?: string }[] };
  };
}

interface WixNote {
  content?: string;
  createdDate?: string;
}

async function fetchAllWixContacts(apiKey: string, siteId: string): Promise<WixContact[]> {
  const all: WixContact[] = [];
  let cursor: string | undefined;

  while (true) {
    const url = new URL("https://www.wixapis.com/contacts/v4/contacts");
    url.searchParams.set("paging.limit", "100");
    if (cursor) url.searchParams.set("paging.cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: apiKey,
        "wix-site-id": siteId,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Wix contacts API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const contacts: WixContact[] = data.contacts || [];
    all.push(...contacts);

    cursor = data.pagingMetadata?.cursors?.next;
    if (!cursor || contacts.length === 0) break;

    await sleep(100);
  }

  return all;
}

async function fetchContactNotes(contactId: string, apiKey: string, siteId: string): Promise<WixNote[]> {
  const res = await fetch(
    `https://www.wixapis.com/contacts/v4/contacts/${contactId}/notes`,
    {
      headers: {
        Authorization: apiKey,
        "wix-site-id": siteId,
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to fetch notes for ${contactId}: ${res.status} ${text}`);
    return [];
  }

  const data = await res.json();
  return data.notes || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("WIX_API_KEY")!;
    const siteId = Deno.env.get("WIX_SITE_ID")!;

    if (!apiKey || !siteId) {
      return new Response(
        JSON.stringify({ error: "WIX_API_KEY and WIX_SITE_ID secrets are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Step 1: Fetch all Wix contacts
    console.log("Fetching all Wix contacts...");
    const contacts = await fetchAllWixContacts(apiKey, siteId);
    console.log(`Fetched ${contacts.length} contacts`);

    let contactsWithNotes = 0;
    let matchedCount = 0;
    let notesImported = 0;
    let notesSkippedDuplicate = 0;
    const unmatchedContacts: { name: string; email: string; note_count: number }[] = [];

    for (const contact of contacts) {
      const email = contact.info?.emails?.items?.[0]?.email?.trim().toLowerCase();
      if (!email) continue;

      // Step 2: Fetch notes for this contact (with rate limiting)
      await sleep(100);
      const notes = await fetchContactNotes(contact.id, apiKey, siteId);

      if (notes.length === 0) continue;
      contactsWithNotes++;

      const contactName = [
        contact.info?.name?.first || "",
        contact.info?.name?.last || "",
      ].join(" ").trim() || email;

      // Step 3: Check if customer exists in our system
      // Check migrated_customers first, then bookings by email
      const { data: migratedCustomer } = await supabase
        .from("migrated_customers")
        .select("email")
        .ilike("email", email)
        .maybeSingle();

      // Also check if they have any bookings
      const { data: booking } = await supabase
        .from("bookings")
        .select("customer_email")
        .ilike("customer_email", email)
        .limit(1)
        .maybeSingle();

      const matchedEmail = migratedCustomer?.email || booking?.customer_email;

      if (!matchedEmail) {
        unmatchedContacts.push({
          name: contactName,
          email,
          note_count: notes.length,
        });
        continue;
      }

      matchedCount++;
      const normalizedEmail = matchedEmail.trim().toLowerCase();

      // Step 4: Import notes (with duplicate check)
      for (const note of notes) {
        const content = note.content?.trim();
        if (!content) continue;

        // Check for duplicate
        const { data: existing } = await supabase
          .from("customer_notes")
          .select("id")
          .eq("customer_email", normalizedEmail)
          .eq("note", content)
          .maybeSingle();

        if (existing) {
          notesSkippedDuplicate++;
          continue;
        }

        const { error: insertErr } = await supabase
          .from("customer_notes")
          .insert({
            customer_email: normalizedEmail,
            note: content,
            created_at: note.createdDate || new Date().toISOString(),
            created_by: "Wix Migration",
          });

        if (insertErr) {
          console.error(`Failed to insert note for ${normalizedEmail}: ${insertErr.message}`);
        } else {
          notesImported++;
        }
      }
    }

    const summary = {
      total_contacts_checked: contacts.length,
      contacts_with_notes: contactsWithNotes,
      matched_to_our_customers: matchedCount,
      notes_imported: notesImported,
      notes_skipped_duplicate: notesSkippedDuplicate,
      unmatched_contacts: unmatchedContacts,
    };

    console.log("Migration complete:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("migrate-wix-notes error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
