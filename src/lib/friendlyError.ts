/**
 * Turns raw Postgres / Supabase errors into plain English staff can act on.
 */
export function friendlyError(e: any, fallback = "Something went wrong — please try again."): string {
  const msg = String(e?.message || e || "");
  const lower = msg.toLowerCase();

  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "You don't have permission to make this change. Ask a manager to do it for you.";
  }
  if (lower.includes("is not approved to perform service")) {
    return "That groomer isn't set up for this service. Pick a different service or groomer.";
  }
  if (lower.includes("online bookings require a specific service")) {
    return "Please choose a specific service before saving.";
  }
  if (lower.includes("package online bookings must have a staff_id")) {
    return "Please choose a groomer for this package session.";
  }
  if (lower.includes("customer_pets_user_id_fkey") || lower.includes("customer_pets_owner_exactly_one")) {
    return "This customer doesn't have an account yet, so the dog couldn't be linked. Refresh the page and try again — if it keeps failing, tell a manager.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Connection problem — check your internet and try again.";
  }

  return msg || fallback;
}
