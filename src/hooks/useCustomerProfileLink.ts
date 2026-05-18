import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve the link target for a booking customer name click.
 *
 * The /admin/customers/:email route keys off email. For online and staff
 * bookings the booking row already carries customer_email, so we just use
 * that. For phone_ai bookings the email is often missing — in that case we
 * try to find the customer in migrated_customers by phone (trying 07xxx,
 * +447xxx and 447xxx formats) and use the email from there.
 *
 * Returns the email to navigate to, or null if no profile can be resolved.
 */
export function useCustomerProfileLink(opts: {
  email?: string | null;
  phone?: string | null;
  bookingSource?: string | null;
}) {
  const { email, phone, bookingSource } = opts;

  const phoneVariants = (() => {
    if (!phone) return [] as string[];
    const raw = String(phone).trim().replace(/[\s\-\(\)]/g, "");
    const set = new Set<string>([raw]);
    if (raw.startsWith("+44")) {
      set.add("0" + raw.slice(3));
      set.add(raw.slice(1)); // 44xxx
      set.add(raw.slice(3)); // xxx
    } else if (raw.startsWith("44")) {
      set.add("+" + raw);
      set.add("0" + raw.slice(2));
      set.add(raw.slice(2));
    } else if (raw.startsWith("0")) {
      set.add("+44" + raw.slice(1));
      set.add("44" + raw.slice(1));
      set.add(raw.slice(1));
    }
    return Array.from(set).filter(Boolean);
  })();

  const shouldLookup =
    !email && bookingSource === "phone_ai" && phoneVariants.length > 0;

  const { data: lookupEmail } = useQuery({
    queryKey: ["customer-profile-link", phoneVariants.join("|")],
    enabled: shouldLookup,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("migrated_customers")
        .select("email, phone, secondary_phone")
        .or(
          phoneVariants
            .flatMap((p) => [`phone.eq.${p}`, `secondary_phone.eq.${p}`])
            .join(","),
        )
        .limit(1);
      if (error) return null;
      const row = data?.[0];
      return row?.email || null;
    },
  });

  const resolvedEmail = email || lookupEmail || null;
  return {
    profileEmail: resolvedEmail,
    canNavigate: !!resolvedEmail,
  };
}