import { format } from "date-fns";

interface StaffMember {
  name: string;
  hs_status?: string;
  hs_signed_at?: string | null;
  hs_signed_ip?: string | null;
}

const sections = [
  {
    title: "1. General Duty of Care",
    content:
      "All staff members have a duty of care to ensure the health, safety, and welfare of themselves, their colleagues, clients, and the animals in our care. Every individual is expected to act responsibly and report any unsafe conditions immediately to the salon directors, Sevak or Andriy.",
  },
  {
    title: "2. Grooming Room Safety",
    items: [
      "Never leave a dog unattended on the grooming table at any time.",
      "Switch off and unplug all electrical appliances (clippers, dryers, etc.) immediately after use.",
      "Regularly check the temperature of clippers and dryers to prevent burns.",
      "Use proper restraints (grooming loops/harnesses) to secure dogs safely without causing discomfort.",
      "Brush out mats and tangles gently using appropriate tools to avoid causing pain or injury.",
      "Follow breed-specific grooming guidelines to ensure the health and well-being of each dog.",
    ],
  },
  {
    title: "3. Bathing Area Safety",
    items: [
      "Never leave a dog unattended in the bathing area — supervise at all times to prevent slipping, drowning, or injury.",
      "Always check water temperature before bathing to avoid scalding or chilling.",
      "Prevent water from entering the dog's ears and eyes; use cotton balls where necessary.",
      "Rinse thoroughly to remove all shampoo and conditioner residue, preventing skin irritation.",
      "Dry dogs properly using towels or a pet dryer at a safe temperature. Never leave a wet dog unattended.",
      "Keep the bathing area clean and dry at all times — wipe up spills immediately to prevent slips.",
    ],
  },
  {
    title: "4. Kitchen & Communal Area Hygiene",
    items: [
      "Follow manufacturer's guidelines for all kitchen equipment (washing machine, fridge, dryer).",
      "Keep surfaces clean and sanitised; wash dishes promptly to prevent bacteria buildup.",
      "Dispose of waste correctly — empty bins regularly and discard expired food.",
      "Avoid cross-contamination by using separate utensils for raw meat, dog food, and other items.",
      "Ensure proper ventilation to prevent odours and maintain air quality.",
      "Keep chemicals and cleaning supplies stored securely, away from food and animals.",
      "Wipe up spills immediately to prevent slips and falls.",
      "Switch off and unplug appliances when not in use to prevent fire hazards.",
    ],
  },
  {
    title: "5. Workspace Maintenance",
    content:
      "All staff members are responsible for keeping the entire salon clean, organised, and hazard-free at all times. This includes sweeping up hair after each session, organising tools, removing clutter, and checking for loose cords, spills, or sharp objects. A tidy workspace is essential for preventing accidents and maintaining professional standards.",
  },
  {
    title: "6. Animal Welfare & Stress Management",
    items: [
      "Monitor every dog's stress levels throughout the grooming or bathing process.",
      "Watch for signs of distress such as excessive panting, whining, trembling, or aggression.",
      "Take breaks as needed to allow the dog to calm down.",
      "Handle all animals gently and with patience — rough handling will not be tolerated.",
      "Use equipment according to manufacturer's guidelines to prevent injury.",
    ],
  },
  {
    title: "7. Personal Protective Equipment (PPE)",
    content:
      "Staff should wear appropriate PPE where necessary, including non-slip footwear at all times, and protective gloves when handling cleaning chemicals or treating skin conditions. Long hair must be tied back, and loose clothing or jewellery that could become caught in equipment must be avoided.",
  },
  {
    title: "8. Incident Reporting",
    content:
      "Any accident, injury, near-miss, or safety concern — no matter how minor — must be reported to the salon directors (Sevak or Andriy) immediately. A formal incident report must be completed as soon as reasonably practicable. Failure to report incidents may result in disciplinary action. RIDDOR-reportable incidents will be escalated in accordance with legal requirements.",
  },
  {
    title: "9. Fire Safety",
    items: [
      "Familiarise yourself with the location of fire exits, fire extinguishers, and assembly points.",
      "Never block fire exits or escape routes with equipment, furniture, or other items.",
      "Report any faulty electrical equipment immediately — do not continue to use it.",
      "Switch off all equipment at the end of each working day.",
    ],
  },
  {
    title: "10. First Aid",
    content:
      "A first-aid kit is available on the premises. All staff should be aware of its location. Any use of first-aid supplies must be reported so the kit can be restocked promptly. Staff are encouraged to undertake basic first-aid training.",
  },
  {
    title: "11. Risk Assessments",
    content:
      "Formal risk assessments are conducted and maintained by the salon management. All staff are expected to read and understand these assessments and follow the control measures outlined within them. If you identify a new hazard not covered by existing assessments, report it immediately.",
  },
  {
    title: "12. Compliance & Acknowledgement",
    content:
      "All staff members are required to read, understand, and comply with this Health & Safety Policy. Breaches of this policy may result in disciplinary action, up to and including termination of contract. This policy is reviewed annually and may be updated as necessary.",
  },
];

export function HealthAndSafetyContent({ staff }: { staff: StaffMember }) {
  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <div className="text-center space-y-1 pb-4 border-b">
        <h2 className="font-heading text-lg font-bold">
          Fluff & Scruff Studio
        </h2>
        <p className="text-xs text-muted-foreground">
          Health & Safety Policy
        </p>
        <p className="text-xs text-muted-foreground">
          138 Hillview Avenue, Hornchurch, RM11 2DL
        </p>
      </div>

      <p>
        This Health & Safety Policy applies to all staff, contractors, and
        volunteers working at <strong>Fluff and Scruff Studio</strong>. It is
        the responsibility of every team member to comply with the standards
        set out in this document to ensure a safe working environment for
        people and animals alike.
      </p>

      {sections.map((section, idx) => (
        <div key={idx} className="space-y-2">
          <h3 className="font-heading font-semibold">{section.title}</h3>
          {section.content && <p>{section.content}</p>}
          {section.items && (
            <ul className="list-disc pl-5 space-y-1">
              {section.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* Signature block */}
      <div className="pt-6 space-y-4 border-t">
        <p className="font-heading font-semibold">
          Acknowledgement & Signature
        </p>
        <p className="text-sm text-muted-foreground">
          I, the undersigned, confirm that I have read, understood, and agree
          to comply with the Health & Safety Policy of Fluff and Scruff Studio.
        </p>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Staff Member:</p>
            <p className="font-medium">{staff.name}</p>
          </div>
          <div className="space-y-2">
            {staff.hs_status === "signed" && staff.hs_signed_at ? (
              <>
                <p className="text-lg italic font-serif text-foreground">
                  {staff.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Date: {format(new Date(staff.hs_signed_at), "PPP")}
                </p>
                {staff.hs_signed_ip && (
                  <p className="text-xs text-muted-foreground">
                    IP: {staff.hs_signed_ip}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="border-b border-dashed h-8" />
                <p className="text-xs text-muted-foreground">
                  Date: _______________
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
