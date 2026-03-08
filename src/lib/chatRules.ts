import { supabase } from "@/integrations/supabase/client";

export interface ChatResponse {
  reply: string;
  show_booking_button?: boolean;
  show_call_button?: boolean;
  show_whatsapp_button?: boolean;
  is_default_fallback?: boolean;
  nav_links?: NavLink[];
}

export interface NavLink {
  label: string;
  url: string;
  external?: boolean;
}

const BREED_ADVICE: Record<string, string> = {
  cockapoo: "Doodles need grooming every 6-8 weeks to prevent matting. Their curly coats grow fast! Daily brushing at home helps a lot between visits 🐾",
  cavapoo: "Doodles need grooming every 6-8 weeks to prevent matting. Their curly coats grow fast! Daily brushing at home helps a lot between visits 🐾",
  labradoodle: "Doodles need grooming every 6-8 weeks to prevent matting. Their curly coats grow fast! Daily brushing at home helps a lot between visits 🐾",
  goldendoodle: "Doodles need grooming every 6-8 weeks to prevent matting. Their curly coats grow fast! Daily brushing at home helps a lot between visits 🐾",
  "golden retriever": "Labs and Goldies benefit from grooming every 8-12 weeks. They shed a lot so a good de-shed treatment works wonders! 🐾",
  labrador: "Labs and Goldies benefit from grooming every 8-12 weeks. They shed a lot so a good de-shed treatment works wonders! 🐾",
  "cocker spaniel": "Spaniels need grooming every 6-8 weeks — their silky ears especially need regular attention to avoid tangles. 🐾",
  cavalier: "Spaniels need grooming every 6-8 weeks — their silky ears especially need regular attention to avoid tangles. 🐾",
  "cavalier king charles": "Spaniels need grooming every 6-8 weeks — their silky ears especially need regular attention to avoid tangles. 🐾",
  "bichon frise": "These fluffy little ones need grooming every 4-6 weeks to keep their coats healthy and tangle-free! 🐾",
  bichon: "These fluffy little ones need grooming every 4-6 weeks to keep their coats healthy and tangle-free! 🐾",
  maltese: "These fluffy little ones need grooming every 4-6 weeks to keep their coats healthy and tangle-free! 🐾",
  "shih tzu": "These fluffy little ones need grooming every 4-6 weeks to keep their coats healthy and tangle-free! 🐾",
  "yorkshire terrier": "Yorkies and Poms need grooming every 4-6 weeks. Their fine coats can mat quickly so regular brushing between appointments is important! 🐾",
  yorkie: "Yorkies and Poms need grooming every 4-6 weeks. Their fine coats can mat quickly so regular brushing between appointments is important! 🐾",
  pomeranian: "Yorkies and Poms need grooming every 4-6 weeks. Their fine coats can mat quickly so regular brushing between appointments is important! 🐾",
  poodle: "Poodles need grooming every 4-6 weeks — their coats grow continuously and don't shed, which means they mat quickly without regular grooming! 🐾",
  "toy poodle": "Poodles need grooming every 4-6 weeks — their coats grow continuously and don't shed, which means they mat quickly without regular grooming! 🐾",
  "miniature poodle": "Poodles need grooming every 4-6 weeks — their coats grow continuously and don't shed, which means they mat quickly without regular grooming! 🐾",
  "standard poodle": "Poodles need grooming every 4-6 weeks — their coats grow continuously and don't shed, which means they mat quickly without regular grooming! 🐾",
  "border collie": "Collies need grooming every 8-12 weeks. Their double coats need extra attention during shedding season — a de-shed treatment is ideal! 🐾",
  "rough collie": "Collies need grooming every 8-12 weeks. Their double coats need extra attention during shedding season — a de-shed treatment is ideal! 🐾",
  collie: "Collies need grooming every 8-12 weeks. Their double coats need extra attention during shedding season — a de-shed treatment is ideal! 🐾",
  "german shepherd": "German Shepherds benefit from grooming every 8-12 weeks, especially during their twice-yearly heavy moult. A de-shed bath is brilliant for them! 🐾",
  husky: "Huskies and Malamutes have thick double coats that need professional grooming every 8-12 weeks. Never shave a double coat — we know exactly how to care for them! 🐾",
  malamute: "Huskies and Malamutes have thick double coats that need professional grooming every 8-12 weeks. Never shave a double coat — we know exactly how to care for them! 🐾",
  pug: "Short-coated breeds like Pugs and Frenchies only need grooming every 8-12 weeks, but their skin folds need regular cleaning. We take great care of them! 🐾",
  "french bulldog": "Short-coated breeds like Pugs and Frenchies only need grooming every 8-12 weeks, but their skin folds need regular cleaning. We take great care of them! 🐾",
  frenchie: "Short-coated breeds like Pugs and Frenchies only need grooming every 8-12 weeks, but their skin folds need regular cleaning. We take great care of them! 🐾",
  bulldog: "Short-coated breeds like Pugs and Frenchies only need grooming every 8-12 weeks, but their skin folds need regular cleaning. We take great care of them! 🐾",
};

// Export breed list for memory detection
export const KNOWN_BREEDS = Object.keys(BREED_ADVICE);

type Rule = {
  keywords: string[];
  handler: (msg: string) => Promise<ChatResponse> | ChatResponse;
};

async function handleAvailability(): Promise<ChatResponse> {
  try {
    const today = new Date();
    const thirtyDays = new Date(Date.now() + 30 * 86400000);
    const todayStr = today.toISOString().split("T")[0];
    const endStr = thirtyDays.toISOString().split("T")[0];

    const { data: bookings } = await supabase
      .from("bookings")
      .select("booking_date")
      .gte("booking_date", todayStr)
      .lte("booking_date", endStr)
      .not("status", "in", '("Cancelled","Refunded","No Show")');

    const dateCounts: Record<string, number> = {};
    (bookings || []).forEach((b) => {
      dateCounts[b.booking_date] = (dateCounts[b.booking_date] || 0) + 1;
    });

    const available: string[] = [];
    const cursor = new Date(today);
    while (available.length < 3 && cursor <= thirtyDays) {
      const dow = cursor.getDay();
      if (dow >= 2 && dow <= 6) {
        const dateStr = cursor.toISOString().split("T")[0];
        if ((dateCounts[dateStr] || 0) < 10) {
          const formatted = cursor.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
          available.push(formatted);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (available.length > 0) {
      return {
        reply: `We have availability on ${available.join(", ")}! Tap below to book 🐾`,
        show_booking_button: true,
        nav_links: [{ label: "Book now →", url: "/book" }],
      };
    }
    return {
      reply: "We're quite busy at the moment! Give us a call on 01708 606655 and we'll find a slot for you 🐾",
      show_call_button: true,
      show_whatsapp_button: true,
    };
  } catch {
    return {
      reply: "I couldn't check availability right now — please give us a call on 01708 606655 or WhatsApp us! 🐾",
      show_call_button: true,
      show_whatsapp_button: true,
    };
  }
}

const RULES: Rule[] = [
  {
    keywords: ["available", "availability", "book", "when", "next", "slot", "appointment", "free", "busy"],
    handler: handleAvailability,
  },
  {
    keywords: ["price", "cost", "how much", "charge", "fee", "expensive"],
    handler: () => ({
      reply: "Our pricing depends on your dog's breed and coat type — the easiest way to see exact prices is to start a booking and select your breed. It only takes a minute! 🐾",
      show_booking_button: true,
      nav_links: [{ label: "See Our Services →", url: "/book" }],
    }),
  },
  {
    keywords: ["open", "hours", "where", "address", "location", "find", "directions", "when do you", "close"],
    handler: () => ({
      reply: "We're open Tuesday to Saturday, 10am to 5pm, at 138 Hillview Avenue, Hornchurch RM11 2DL. You can find us on Google Maps! 🐾",
      show_whatsapp_button: true,
      nav_links: [{ label: "Get Directions 📍", url: "https://maps.google.com/?q=138+Hillview+Avenue+Hornchurch+RM11+2DL", external: true }],
    }),
  },
  {
    keywords: ["puppy", "first time", "first groom", "young", "baby"],
    handler: () => ({
      reply: "Our Puppy Special is perfect for first timers! We go at their pace with lots of treats and cuddles. We recommend starting between 4-6 months. Would you like to book a Puppy Special? 🐾",
      show_booking_button: true,
      nav_links: [{ label: "Book now →", url: "/book" }],
    }),
  },
  {
    keywords: ["teeth", "dental", "breath", "ultrasonic", "clean teeth"],
    handler: () => ({
      reply: "Our Ultrasonic Teeth Cleaning is a non-invasive treatment that removes tartar and freshens breath without anaesthetic — perfect for older dogs! Sessions take around 30 minutes. Would you like to book? 🐾",
      show_booking_button: true,
      nav_links: [{ label: "Book now →", url: "/book" }],
    }),
  },
  {
    keywords: ["nail", "nails", "claws", "trim"],
    handler: () => ({
      reply: "Our Nail Trim & Filing service is quick and painless — usually just 15-20 minutes. Perfect for keeping those tiny paws happy! Want to book one? 🐾",
      show_booking_button: true,
      nav_links: [{ label: "Book now →", url: "/book" }],
    }),
  },
  {
    keywords: ["cancel", "reschedule", "change", "move", "postpone"],
    handler: () => ({
      reply: "To change or cancel an appointment please give us a call on 01708 606655 or WhatsApp us — we'll get it sorted for you right away! Please note cancellations need 48 hours notice 🐾",
      show_call_button: true,
      show_whatsapp_button: true,
    }),
  },
  {
    keywords: ["complaint", "unhappy", "disappointed", "not happy", "bad", "awful", "terrible", "wrong", "mistake", "refund", "money back"],
    handler: () => ({
      reply: "I'm really sorry to hear that — this is not the experience we want for you and your pup at all. Please speak to our team directly so we can make it right. You can call us on 01708 606655 or email info@fluffandscruff.co.uk and we'll resolve this as a priority 🐾",
      show_call_button: true,
    }),
  },
  {
    keywords: ["package", "deal", "discount", "loyalty", "regular", "membership", "subscription", "save money", "cheaper"],
    handler: () => ({
      reply: "We have package deals for regular customers that save you money on every groom! Head to our booking page to see current offers, or give us a call to find out more 🐾",
      show_booking_button: true,
      show_call_button: true,
      nav_links: [{ label: "Book now →", url: "/book" }],
    }),
  },
  {
    keywords: ["matted", "matting", "tangled", "knots", "knotted", "dreadlock"],
    handler: () => ({
      reply: "Matting can be tricky and we always assess on the day. In severe cases we may need to do a shorter cut to keep your pup comfortable — their welfare always comes first. Best to give us a call before booking so we can advise properly 🐾",
      show_call_button: true,
      show_whatsapp_button: true,
    }),
  },
  {
    keywords: ["anxious", "nervous", "scared", "afraid", "fear", "aggressive", "difficult", "reactive", "bite", "hates grooming", "stressed"],
    handler: () => ({
      reply: "We have lots of experience with nervous dogs! We go at their pace, use positive reinforcement and never rush them. It's always worth calling us first so we can chat about the best approach for your pup 🐾",
      show_call_button: true,
      show_whatsapp_button: true,
    }),
  },
  {
    keywords: ["dry", "dryer", "blow dry", "hand dry", "cage dry", "kennel dry"],
    handler: () => ({
      reply: "We hand finish and blow dry all our dogs — we never use cage dryers. Your pup is always attended to throughout their appointment 🐾",
    }),
  },
  {
    keywords: ["bring", "prepare", "before", "what should", "ready", "drop off", "pick up", "how long", "duration"],
    handler: () => ({
      reply: "Just bring your dog! We recommend a short walk before the appointment to help them settle. Appointments typically take 2-4 hours depending on breed and service. We'll call you when they're ready for collection 🐾",
    }),
  },
  {
    keywords: ["new", "first time", "never been", "never used", "haven't been", "first visit", "new customer"],
    handler: () => ({
      reply: "Welcome! 🎉 We love meeting new dogs and their humans. Booking is really easy — just tap below, choose your service and breed, pick a date and you're all set. We require a deposit to secure the slot. If you have any questions before booking just ask! 🐾",
      show_booking_button: true,
      nav_links: [{ label: "Book now →", url: "/book" }],
    }),
  },
  {
    keywords: ["add on", "extra", "cologne", "bow", "bandana", "extras"],
    handler: () => ({
      reply: "We offer a range of add-ons including Ultrasonic Teeth Cleaning, Nail Trim & Filing, and finishing touches. You can add these when booking online or ask your groomer on the day! 🐾",
      show_booking_button: true,
      nav_links: [{ label: "Book now →", url: "/book" }],
    }),
  },
  {
    keywords: ["wait", "waiting", "collect", "ready"],
    handler: () => ({
      reply: "Appointments typically take 2-4 hours depending on breed, coat condition and service. We'll give you a call as soon as your pup is ready for collection — so make sure your number is correct when booking! 🐾",
    }),
  },
  {
    keywords: ["speak", "talk", "human", "person", "call", "phone", "contact", "email", "problem", "issue", "help"],
    handler: () => ({
      reply: "Of course! You can reach us on 01708 606655, WhatsApp us on +44 7476 452782, or email info@fluffandscruff.co.uk. We're here Tuesday to Saturday 10am-5pm 🐾",
      show_call_button: true,
      show_whatsapp_button: true,
    }),
  },
  {
    keywords: ["account", "my account", "past appointments", "history", "previous"],
    handler: () => ({
      reply: "You can view your past appointments and manage your account from the My Account page 🐾",
      nav_links: [{ label: "My Account →", url: "/my-account" }],
    }),
  },
];

function checkBreed(msg: string): ChatResponse | null {
  const lower = msg.toLowerCase();
  for (const [breed, advice] of Object.entries(BREED_ADVICE)) {
    if (lower.includes(breed)) {
      return {
        reply: advice,
        show_booking_button: true,
        nav_links: [{ label: "Book now →", url: "/book" }],
      };
    }
  }
  const breedIndicators = ["breed", "groom", "coat", "fur", "hair", "shed", "mat", "brush"];
  if (breedIndicators.some((kw) => lower.includes(kw))) {
    return {
      reply: "Every dog is unique! Give us a call on 01708 606655 or pop us a WhatsApp and we can advise on the best grooming schedule for your pup 🐾",
      show_call_button: true,
      show_whatsapp_button: true,
    };
  }
  return null;
}

export async function getLocalChatResponse(message: string): Promise<ChatResponse> {
  const lower = message.toLowerCase();

  for (const rule of RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.handler(lower);
    }
  }

  const breedResponse = checkBreed(lower);
  if (breedResponse) return breedResponse;

  // Default fallback
  return {
    reply: "I want to make sure you get the right help! Can you tell me a little more about what you need? Just type it below and I'll send it straight to the team — they'll get back to you as soon as possible 🐾",
    show_call_button: true,
    show_whatsapp_button: true,
    is_default_fallback: true,
  };
}

// Detect breed mentioned in a message
export function detectBreed(message: string): string | null {
  const lower = message.toLowerCase();
  // Check longer breed names first to avoid partial matches
  const sorted = [...KNOWN_BREEDS].sort((a, b) => b.length - a.length);
  for (const breed of sorted) {
    if (lower.includes(breed)) {
      // Return a nicely capitalized version
      return breed.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }
  return null;
}

// Detect customer name from common patterns
export function detectName(message: string): string | null {
  const patterns = [
    /(?:my name is|i'm|i am|this is|call me)\s+([A-Z][a-z]+)/i,
    /^([A-Z][a-z]+)\s+here$/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  return null;
}
