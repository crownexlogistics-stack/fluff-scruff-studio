import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

const conductItems = [
  {
    title: "Cleanliness & Shared Responsibility",
    description:
      "The salon is a shared workspace. All contractors are expected to clean up after each session and leave the area fully prepared for the next groomer. A clean and organised environment is essential for safety, professionalism, and the well-being of both contractors and animals.",
  },
  {
    title: "Client Retention & Rebooking",
    description:
      "It is each groomer's responsibility to rebook clients at the end of every appointment. Consistent rebooking maintains a full schedule, strengthens client relationships, and supports the long-term success of the salon.",
  },
  {
    title: "Escalation & Decision-Making",
    description:
      "Any matters relating to discounts, timekeeping, cleaning duties, time-off requests, or pay must be directed to the salon directors, Sevak and Andriy. As self-employed contractors, all contractors are expected to take personal responsibility for their own work, scheduling, and client management.",
  },
  {
    title: "Reporting Concerns & Incidents",
    description:
      "Any incidents, problems, or concerns — no matter how minor — must be reported to Sevak or Andriy immediately. Prompt communication ensures swift resolution and helps maintain a safe environment for everyone.",
  },
  {
    title: "Mutual Respect & Professionalism",
    description:
      "All contractors are expected to treat one another with courtesy, respect, and professionalism at all times. We are committed to maintaining a positive and supportive working environment where everyone feels valued and safe.",
  },
  {
    title: "Client Loyalty & Business Integrity",
    description:
      "Contractors must not, under any circumstances, encourage, suggest, or advise clients to take their business elsewhere, whether to another salon, a private arrangement, or any other grooming service. This includes direct verbal suggestions, indirect comments, sharing personal contact details for private bookings, or any communication that could reasonably result in the salon losing a client relationship. Fluff & Scruff Studio invests significantly in client acquisition and retention, and all client relationships developed through the salon's booking system, premises, equipment, and materials remain the property of the business.",
  },
  {
    title: "Termination of Contract",
    description:
      "Fluff & Scruff Studio reserves the right to terminate any contractor agreement immediately and without notice in the event of a breach of any section of this Code of Conduct. This includes but is not limited to: directing clients away from the business, misconduct, failure to maintain professional standards, or any action deemed damaging to the reputation or commercial interests of Fluff & Scruff Studio. No notice period is required where a serious breach has occurred.",
  },
];

interface CodeOfConductProps {
  compact?: boolean;
}

const CodeOfConduct = ({ compact = false }: CodeOfConductProps) => {
  return (
    <Card>
      <CardHeader className={compact ? "pb-3" : "pb-4"}>
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" /> Code of Conduct
        </CardTitle>
        {!compact && (
          <p className="text-sm text-muted-foreground mt-1">
            All contractors are required to read, understand, and adhere to the following professional standards.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {conductItems.map((item, idx) => (
          <div
            key={idx}
            className="flex gap-3 p-3 rounded-xl bg-muted/40 border border-border/40"
          >
            <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary font-semibold text-sm">
              {idx + 1}
            </span>
            <div>
              <p className="font-medium text-foreground text-sm">{item.title}</p>
              <p className="text-muted-foreground text-sm mt-0.5">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default CodeOfConduct;
