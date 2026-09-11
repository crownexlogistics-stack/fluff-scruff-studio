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
 * Driven entirely by the services table so anything added in the admin
 * Services page appears for customers as soon as it is active.
 */
export function useWebsiteServices() {
  const { data, isLoading } = useQuery({
    queryKey: ["website-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, description, tagline, image_url, sort_order, show_on_website, is_active")
        .eq("is_active", true)
        .eq("show_on_website", true)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data || []) as Pick<
        ServiceRow,
        "id" | "name" | "description" | "tagline" | "image_url" | "sort_order" | "show_on_website" | "is_active"
      >[];
    },
    staleTime: 60_000,
  });

  const services: WebsiteService[] = [GROOMING_TILE, ...(data || []).map(serviceToTile)];

  return { services, isLoading };
}
