import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const TIMING_OPTIONS = [
  "As soon as possible",
  "Within the next month",
  "Within the next 3 months",
  "Within the next 6 months",
  "Just exploring for now",
];

const COURSE_VALUES: Record<string, string> = {
  "Groom Your Own Dog": "Pet Owner Session — £300",
  "Full Day Grooming Masterclass": "Full Day Masterclass — £250",
  "Pro Skills Workshop": "Pro Skills Workshop — £180",
};

interface InterestFormData {
  first_name: string;
  last_name: string;
  email: string;
  contact_number: string;
  timing_preference: string;
  about_me: string;
  course_interest: string;
}

const emptyForm = (course?: string): InterestFormData => ({
  first_name: "",
  last_name: "",
  email: "",
  contact_number: "",
  timing_preference: "",
  about_me: "",
  course_interest: course || "",
});

function ThankYouMessage({ firstName, courseName, email, onClose }: { firstName: string; courseName: string; email: string; onClose?: () => void }) {
  return (
    <div className="text-center py-4 space-y-4">
      <p className="text-5xl" style={{ color: "hsl(18, 100%, 60%)" }}>✅</p>
      <h3 className="font-heading text-2xl" style={{ color: "hsl(20, 60%, 12%)" }}>
        Thank You, {firstName}! 🐾
      </h3>
      <div className="text-muted-foreground text-sm leading-relaxed space-y-3 text-left">
        <p>
          We've received your interest in our <strong>{courseName}</strong> and we're really excited to hear from you!
        </p>
        <p>
          We'll be in touch as soon as we have an opening. We might not always be able to offer exactly the timing you had in mind, but we will always do our best to find something that works for you.
        </p>
        <p>
          Keep an eye on your inbox — we'll reach out to <strong>{email}</strong> soon.
        </p>
      </div>
      {onClose && (
        <Button variant="outline" className="rounded-xl font-bold border-2 mt-4" style={{ borderColor: "hsl(18, 100%, 60%)", color: "hsl(18, 100%, 60%)" }} onClick={onClose}>
          Close
        </Button>
      )}
    </div>
  );
}

function InterestForm({ formData, setFormData, onSubmit, submitting, showCourseDropdown }: {
  formData: InterestFormData;
  setFormData: React.Dispatch<React.SetStateAction<InterestFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  showCourseDropdown?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="first_name">First Name *</Label>
          <Input id="first_name" required maxLength={50} value={formData.first_name} onChange={(e) => setFormData((d) => ({ ...d, first_name: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="last_name">Last Name *</Label>
          <Input id="last_name" required maxLength={50} value={formData.last_name} onChange={(e) => setFormData((d) => ({ ...d, last_name: e.target.value }))} />
        </div>
      </div>
      <div>
        <Label htmlFor="email">Email Address *</Label>
        <Input id="email" type="email" required maxLength={255} value={formData.email} onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))} />
      </div>
      <div>
        <Label htmlFor="contact_number">Contact Number *</Label>
        <Input id="contact_number" type="tel" required maxLength={20} value={formData.contact_number} onChange={(e) => setFormData((d) => ({ ...d, contact_number: e.target.value }))} />
      </div>
      {showCourseDropdown && (
        <div>
          <Label>Which course are you interested in?</Label>
          <Select value={formData.course_interest} onValueChange={(v) => setFormData((d) => ({ ...d, course_interest: v }))}>
            <SelectTrigger><SelectValue placeholder="Select a course..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Pet Owner Session — £300">Groom Your Own Dog — £300</SelectItem>
              <SelectItem value="Full Day Masterclass — £250">Full Day Masterclass — £250</SelectItem>
              <SelectItem value="Pro Skills Workshop — £180">Pro Skills Workshop — £180</SelectItem>
              <SelectItem value="Not sure yet">Not sure yet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Label>When are you interested in attending? *</Label>
        <Select value={formData.timing_preference} onValueChange={(v) => setFormData((d) => ({ ...d, timing_preference: v }))}>
          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {TIMING_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="about_me">Tell us why you're interested and anything else we should know</Label>
        <Textarea id="about_me" rows={4} maxLength={1000} value={formData.about_me} onChange={(e) => setFormData((d) => ({ ...d, about_me: e.target.value }))} />
      </div>
      <Button type="submit" disabled={submitting} className="w-full py-6 text-base rounded-xl font-bold" style={{ background: "hsl(18, 100%, 60%)" }}>
        {submitting ? "Sending..." : "Send My Interest 🐾"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        No commitment needed — this is just to register your interest so we can get in touch when a spot opens up.
      </p>
    </form>
  );
}

export default function AcademyPage() {
  const { user } = useAuth();
  const { role } = useUserRole(user?.id);
  const isAdmin = role === "director" || role === "manager";
  const coursesRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCourse, setModalCourse] = useState("");
  const [modalForm, setModalForm] = useState<InterestFormData>(emptyForm());
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalSubmitted, setModalSubmitted] = useState(false);

  // Bottom form state
  const [bottomForm, setBottomForm] = useState<InterestFormData>(emptyForm());
  const [bottomSubmitting, setBottomSubmitting] = useState(false);
  const [bottomSubmitted, setBottomSubmitted] = useState(false);

  useEffect(() => {
    document.title = "Grooming Academy — Fluff & Scruff Studio";
  }, []);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  const openModal = (courseTitle: string) => {
    const courseValue = COURSE_VALUES[courseTitle] || courseTitle;
    setModalCourse(courseValue);
    setModalForm(emptyForm(courseValue));
    setModalSubmitted(false);
    setModalOpen(true);
  };

  const submitForm = async (data: InterestFormData): Promise<boolean> => {
    if (!data.first_name.trim() || !data.last_name.trim() || !data.email.trim() || !data.contact_number.trim()) {
      toast.error("Please fill in all required fields.");
      return false;
    }
    if (!data.timing_preference) {
      toast.error("Please select when you're interested in attending.");
      return false;
    }
    const { error } = await supabase.from("academy_applications" as any).insert({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      full_name: `${data.first_name.trim()} ${data.last_name.trim()}`,
      email: data.email.trim(),
      phone: data.contact_number.trim(),
      contact_number: data.contact_number.trim(),
      course_interest: data.course_interest || null,
      timing_preference: data.timing_preference || null,
      about_me: data.about_me.trim() || null,
    } as any);
    if (error) {
      toast.error("Something went wrong. Please try again.");
      console.error(error);
      return false;
    }
    return true;
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitting(true);
    const ok = await submitForm(modalForm);
    setModalSubmitting(false);
    if (ok) setModalSubmitted(true);
  };

  const handleBottomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBottomSubmitting(true);
    const ok = await submitForm(bottomForm);
    setBottomSubmitting(false);
    if (ok) setBottomSubmitted(true);
  };

  const courses = [
    {
      emoji: "🛁",
      title: "Groom Your Own Dog",
      duration: "Half Day • 3 Hours",
      price: "£300",
      priceSub: "per session",
      description:
        "Perfect for pet owners who want to keep their dog well-groomed at home. Bring your dog and leave knowing exactly how to bath, dry, brush and trim them safely.",
      includes: [
        "Hands-on with your own dog",
        "Bath, dry & brush techniques",
        "Safe scissoring basics",
        "Products & tools guidance",
        "Take-home care guide",
      ],
      popular: false,
    },
    {
      emoji: "✂️",
      title: "Full Day Grooming Masterclass",
      duration: "Full Day • 10am–5pm",
      price: "£250",
      priceSub: "per person",
      description:
        "A complete day immersed in professional grooming. You'll work on multiple dogs, learn different coat types, and finish the day with real confidence and real skills.",
      includes: [
        "Multiple dogs, multiple breeds",
        "Bath, dry, scissor & clip techniques",
        "Coat type masterclass",
        "Tools & product kit guidance",
        "Lunch included",
        "Certificate of attendance",
      ],
      popular: true,
    },
    {
      emoji: "🏅",
      title: "Pro Skills Workshop",
      duration: "Full Day • Qualified Groomers Only",
      price: "£180",
      priceSub: "per groomer",
      description:
        "Already grooming professionally? Join a specialist workshop focused on scissoring, hand stripping, or specific breed styling. Sharpen your technique with expert guidance.",
      specialisms: ["Scissoring", "Hand Stripping", "Breed Styling", "Asian Fusion"],
      popular: false,
    },
  ];

  const steps = [
    { emoji: "📝", title: "Apply Online", desc: "Fill in the short form below telling us which course interests you and a little about yourself." },
    { emoji: "📞", title: "We'll Be In Touch", desc: "We'll contact you within 48 hours to discuss your goals and confirm your spot." },
    { emoji: "📅", title: "Pick Your Date", desc: "Choose a date that works for you. Small groups mean flexible scheduling." },
    { emoji: "✂️", title: "Come & Groom", desc: "Arrive at our Hornchurch studio. Everything is set up and waiting for you." },
  ];

  const faqs = [
    { q: "Do I need any experience?", a: "Not at all for the Pet Owner and Full Day Masterclass sessions. The Pro Skills Workshop is designed for qualified or working groomers who want to refine specific skills." },
    { q: "Do I get a certificate?", a: "The Full Day Masterclass includes a certificate of attendance. Our courses are about real skills, not qualifications — you leave knowing how to groom, not just holding a piece of paper." },
    { q: "Can I bring my own dog?", a: "For the Pet Owner session — absolutely, that's the whole point! For the other courses we provide the dogs from our regular client bookings." },
    { q: "How many people are in each session?", a: "Maximum 3 students per session. We keep it small on purpose so you get real hands-on time, not just watching." },
    { q: "Where is the studio?", a: "138 Hillview Avenue, Hornchurch RM11 2DL. There's parking on site and we're about 5 minutes from Hornchurch Station." },
    { q: "What should I wear?", a: "Comfortable clothes you don't mind getting a little wet or hairy! We provide aprons but dogs will be dogs." },
  ];

  return (
    <div className="min-h-screen font-body" style={{ background: "hsl(30, 100%, 98%)" }}>
      {/* Admin back link */}
      {isAdmin && (
        <div className="fixed top-4 left-4 z-50">
          <Link to="/admin" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur rounded-full px-3 py-1.5 shadow-sm">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>
      )}

      {/* ── MODAL ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          {modalSubmitted ? (
            <ThankYouMessage
              firstName={modalForm.first_name}
              courseName={modalCourse}
              email={modalForm.email}
              onClose={() => setModalOpen(false)}
            />
          ) : (
            <>
              <div className="mb-4">
                <h2 className="font-heading text-xl" style={{ color: "hsl(20, 60%, 12%)" }}>Register Your Interest</h2>
                <p className="text-sm text-muted-foreground">{modalCourse}</p>
              </div>
              <InterestForm
                formData={modalForm}
                setFormData={setModalForm}
                onSubmit={handleModalSubmit}
                submitting={modalSubmitting}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Ctext x='20' y='50' font-size='40'%3E🐾%3C/text%3E%3C/svg%3E")`, backgroundSize: "80px 80px" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(30, 100%, 98%) 0%, hsl(30, 80%, 92%) 100%)" }} />
        <motion.div className="relative max-w-3xl mx-auto px-4 text-center" initial="hidden" animate="visible" variants={staggerContainer}>
          <motion.div variants={fadeUp}>
            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-bold text-primary-foreground mb-6" style={{ background: "hsl(18, 100%, 60%)" }}>
              🐾 Now Accepting Applications
            </span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="font-heading text-4xl md:text-6xl leading-tight mb-6" style={{ color: "hsl(20, 60%, 12%)" }}>
            Learn to Groom.{"\n"}Love What You Do.
          </motion.h1>
          <motion.p variants={fadeUp} className="text-lg md:text-xl mb-8 max-w-2xl mx-auto" style={{ color: "hsla(20, 60%, 12%, 0.7)" }}>
            Hands-on grooming masterclasses at Fluff &amp; Scruff Studio — real dogs, real skills, real results. No exams. No theory. Just grooming.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Button size="lg" className="text-base px-8 py-6 rounded-2xl font-bold" style={{ background: "hsl(18, 100%, 60%)" }} onClick={() => scrollTo(formRef)}>
              Apply Now
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 py-6 rounded-2xl font-bold border-2" style={{ borderColor: "hsl(18, 100%, 60%)", color: "hsl(18, 100%, 60%)" }} onClick={() => scrollTo(coursesRef)}>
              See All Courses ↓
            </Button>
          </motion.div>
          <motion.p variants={fadeUp} className="text-sm" style={{ color: "hsla(20, 60%, 12%, 0.55)" }}>
            📍 138 Hillview Avenue, Hornchurch RM11 2DL &nbsp;•&nbsp; Small groups &nbsp;•&nbsp; Hands-on from day one
          </motion.p>
        </motion.div>
      </section>

      {/* ── WHY US ── */}
      <section className="py-16 md:py-24 px-4">
        <motion.div className="max-w-5xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
          <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl text-center mb-12" style={{ color: "hsl(20, 60%, 12%)" }}>
            Why Learn With Us?
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { emoji: "🐶", title: "Real Dogs, Real Grooms", desc: "You'll work on actual client dogs from day one — not mannequins, not fake fur. Real experience from your very first session." },
              { emoji: "👥", title: "Tiny Groups", desc: "Maximum 3 students per session. You get personal attention, not a classroom experience. Our instructor knows your name and your goals." },
              { emoji: "✂️", title: "All Skill Levels Welcome", desc: "Never groomed before? Perfect. Already grooming but want to level up? Also perfect. We tailor every session to where you are right now." },
              { emoji: "🏆", title: "No Fluff (Just Scruff)", desc: "No exams. No certificates to chase. Just pure hands-on grooming skill taught by professionals who do this every single day." },
            ].map((card) => (
              <motion.div key={card.title} variants={fadeUp} className="bg-card rounded-2xl p-6 shadow-sm border border-border">
                <span className="text-3xl mb-3 block">{card.emoji}</span>
                <h3 className="font-heading text-xl mb-2" style={{ color: "hsl(20, 60%, 12%)" }}>{card.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── COURSES ── */}
      <section ref={coursesRef} className="py-16 md:py-24 px-4" style={{ background: "hsl(30, 60%, 97%)" }}>
        <motion.div className="max-w-6xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={staggerContainer}>
          <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl text-center mb-3" style={{ color: "hsl(20, 60%, 12%)" }}>
            Choose Your Path
          </motion.h2>
          <motion.p variants={fadeUp} className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Every course is hands-on. Every session is in our working salon. Every student leaves having groomed real dogs.
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {courses.map((c) => (
              <motion.div
                key={c.title}
                variants={fadeUp}
                className={`relative bg-card rounded-2xl p-6 shadow-sm border border-border flex flex-col ${c.popular ? "md:-my-4 md:py-8 md:shadow-lg ring-2 ring-[hsl(43,100%,50%)]" : ""}`}
              >
                {c.popular && (
                  <span className="absolute -top-3 right-4 px-3 py-1 rounded-full text-xs font-bold text-foreground" style={{ background: "hsl(43, 100%, 50%)" }}>
                    Most Popular
                  </span>
                )}
                <span className="text-3xl mb-2">{c.emoji}</span>
                <h3 className="font-heading text-xl mb-1" style={{ color: "hsl(20, 60%, 12%)" }}>{c.title}</h3>
                <p className="text-xs text-muted-foreground mb-3">{c.duration}</p>
                <p className="font-heading text-3xl mb-0" style={{ color: "hsl(18, 100%, 60%)" }}>{c.price}</p>
                <p className="text-xs text-muted-foreground mb-4">{c.priceSub}</p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{c.description}</p>
                {c.includes && (
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {c.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(145, 60%, 40%)" }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {c.specialisms && (
                  <div className="flex flex-wrap gap-2 mb-5 flex-1">
                    {c.specialisms.map((s) => (
                      <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium border border-border bg-muted">{s}</span>
                    ))}
                  </div>
                )}
                <Button className={`w-full rounded-xl font-bold ${c.popular ? "py-6 text-base" : ""}`} style={{ background: "hsl(18, 100%, 60%)" }} onClick={() => openModal(c.title)}>
                  Register Your Interest 🐾
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 md:py-24 px-4" style={{ background: "hsl(30, 70%, 96%)" }}>
        <motion.div className="max-w-5xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
          <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl text-center mb-12" style={{ color: "hsl(20, 60%, 12%)" }}>
            How It Works
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <motion.div key={s.title} variants={fadeUp} className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl mb-3 text-primary-foreground font-bold" style={{ background: "hsl(18, 100%, 60%)" }}>
                  {i + 1}
                </div>
                <span className="text-2xl block mb-1">{s.emoji}</span>
                <h3 className="font-heading text-lg mb-2" style={{ color: "hsl(20, 60%, 12%)" }}>{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── MEET THE STUDIO ── */}
      <section className="py-16 md:py-24 px-4">
        <motion.div className="max-w-5xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
          <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl text-center mb-12" style={{ color: "hsl(20, 60%, 12%)" }}>
            A Real Working Salon
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <motion.div variants={fadeUp} className="rounded-2xl p-8 md:p-10 relative overflow-hidden min-h-[280px] flex items-center justify-center" style={{ background: "hsl(18, 100%, 60%)" }}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Ctext x='25' y='65' font-size='55'%3E🐾%3C/text%3E%3C/svg%3E")`, backgroundSize: "100px 100px" }} />
              <p className="relative font-heading text-2xl md:text-3xl text-center leading-snug" style={{ color: "white" }}>
                Est. 2024<br />Hornchurch<br />Professional Studio
              </p>
            </motion.div>
            <motion.div variants={fadeUp}>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You won't be learning in a classroom or a training centre. Fluff &amp; Scruff Studio is a fully equipped, busy working salon in Hornchurch, Essex — where real dogs come for professional grooms every single day.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Our studio has everything you need: professional baths, high-velocity dryers, top-of-the-range scissors and clippers, and an instructor who grooms for a living.
              </p>
              <p className="text-sm text-muted-foreground">
                📍 138 Hillview Avenue, Hornchurch RM11 2DL<br />
                Easy parking &nbsp;•&nbsp; 5 min from Hornchurch Station
              </p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── APPLICATION FORM ── */}
      <section ref={formRef} className="py-16 md:py-24 px-4" style={{ background: "hsl(30, 60%, 97%)" }}>
        <motion.div className="max-w-xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
          <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl text-center mb-3" style={{ color: "hsl(20, 60%, 12%)" }}>
            Ready to Start?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-center text-muted-foreground mb-10">
            Tell us a little about yourself and which course you're interested in. We'll be in touch within 48 hours.
          </motion.p>

          {bottomSubmitted ? (
            <motion.div variants={fadeUp} className="bg-card rounded-2xl p-8 shadow-sm border border-border">
              <ThankYouMessage
                firstName={bottomForm.first_name}
                courseName={bottomForm.course_interest || "grooming courses"}
                email={bottomForm.email}
              />
            </motion.div>
          ) : (
            <motion.div variants={fadeUp} className="bg-card rounded-2xl p-6 md:p-8 shadow-sm border border-border">
              <InterestForm
                formData={bottomForm}
                setFormData={setBottomForm}
                onSubmit={handleBottomSubmit}
                submitting={bottomSubmitting}
                showCourseDropdown
              />
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 md:py-24 px-4">
        <motion.div className="max-w-2xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
          <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl text-center mb-10" style={{ color: "hsl(20, 60%, 12%)" }}>
            Questions We Get Asked
          </motion.h2>
          <motion.div variants={fadeUp}>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="bg-card rounded-xl border border-border px-4">
                  <AccordionTrigger className="font-bold text-left">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FOOTER CTA ── */}
      <section className="py-16 md:py-20 px-4" style={{ background: "hsl(18, 100%, 60%)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-heading text-3xl md:text-4xl mb-4" style={{ color: "white" }}>
            Your grooming journey starts here.
          </h2>
          <p className="text-lg mb-8" style={{ color: "rgba(255,255,255,0.85)" }}>
            Small groups. Real dogs. Real skills. Hornchurch, Essex.
          </p>
          <Button size="lg" className="text-base px-10 py-6 rounded-2xl font-bold" style={{ background: "white", color: "hsl(18, 100%, 60%)" }} onClick={() => scrollTo(formRef)}>
            Apply Now
          </Button>
        </div>
      </section>
    </div>
  );
}
