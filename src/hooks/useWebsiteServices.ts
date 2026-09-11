import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import serviceFullGroom from "@/assets/service-full-groom.jpg";
import servicePuppy from "@/assets/service-puppy.jpg";
import serviceTeeth from "@/assets/service-teeth.jpg";
import serviceNails from "@/assets/service-nails.jpg";

export interface WebsiteService {
  title: string;
  subtitle: string;
  image: string;
  imagePosition?: string;
}

/**
 * "Grooming" is the parent tile for the breed-priced Full Groom / Bath & Brush
 * services. It is not a single row in the services table, so it is always shown
 * first and is not managed from the Services admin page.
 */
export const GROOMING_TILE: WebsiteService = {
  title: "Grooming",
  subtitle:
    "The ultimate pamper session — wash, dry, cut & style. Your pup leaves looking like a supermodel.",
  image: serviceFullGroom,
  imagePosition: "50% 43%",
};

/** Bundled photos used for the original services when no photo has been uploaded. */
export const FALLBACK_SERVICE_IMAGES: Record<string, { image: string; imagePosition?: string }> = {
  "Puppy Special": { image: servicePuppy, imagePosition: "50% 52%" },
  "Nail Trim & Filing": { image: serviceNails, imagePosition: "48% 63%" },
  "Ultrasonic Teeth Cleaning": { image: serviceTeeth },
  "Full Groom": { image: serviceFullGroom, imagePosition: "50% 43%" },
  "Bath & Brush": { image: serviceFullGroom, imagePosition: "50% 43%" },
};

export const DEFAULT_SERVICE_IMAGE = serviceFullGroom;

export interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  tagline: string | null;
  image_url: string | null;
  fixed_price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  show_on_website: boolean;
  sort_order: number;
  /** When set, this service is one of the options inside another service. */
  parent_service_id: string | null;
  /** A group is a website tile that holds other services (e.g. Grooming). */
  is_group: boolean;
}

export function serviceToTile(s: {
  name: string;
  tagline?: string | null;
  description?: string | null;
  image_url?: string | null;
}): WebsiteService {
  const fallback = FALLBACK_SERVICE_IMAGES[s.name];
  return {
    title: s.name,
    subtitle: s.tagline || s.description || "",
    image: s.image_url || fallback?.image || DEFAULT_SERVICE_IMAGE,
    imagePosition: s.image_url ? undefined : fallback?.imagePosition,
  };
}

/**
 * Services shown on the public website / booking entry point.
 * A tile is shown when it is set to appear on the website and it is not one of
 * the options inside another service (those are chosen inside the parent tile).
 * Group tiles (e.g. Grooming) show as long as one of their options is bookable.
 */
export function useWebsiteServices() {
  const { data, isLoading } = useQuery({
    queryKey: ["website-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select(
          "id, name, description, tagline, image_url, sort_order, show_on_website, is_active, parent_service_id, is_group"
        )
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as ServiceRow[];
    },
    staleTime: 60_000,
  });

  const rows = data || [];
  const hasActiveChild = (id: string) =>
    rows.some((r) => r.parent_service_id === id && r.is_active);

  const services: WebsiteService[] = rows
    .filter(
      (s) =>
        s.show_on_website &&
        !s.parent_service_id &&
        (s.is_group ? hasActiveChild(s.id) : s.is_active)
    )
    .map(serviceToTile);

  return { services, isLoading };
}

