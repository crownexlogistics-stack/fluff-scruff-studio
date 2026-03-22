import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

const PROGRAMME_OPTIONS = [
  "Month-Long Grooming Programme — £2,800",
  "Groom Your Own Dog — £300",
  "Full Day Grooming Masterclass — £250",
  "Pro Skills Workshop — £180",
  "Not sure yet",
];

const REFERRAL_OPTIONS = ["Google", "Instagram", "Word of mouth", "Existing customer", "Other"];

interface EnquiryFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  programme_interest: string;
  message: string;
  referral_source: string;
}

const emptyForm = (programme?: string): EnquiryFormData => ({
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  programme_interest: programme || "",
  message: "",
  referral_source: "",
});

function RegistrationForm({ programme, onSuccess }: { programme: string; onSuccess: (firstName: string) => void }) {
  const [form, setForm] = useState<EnquiryFormData>(emptyForm(programme));
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);

    // Save to database
    const { error } = await supabase.from("academy_enquiries").insert({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      programme_interest: form.programme_interest || null,
      message: form.message.trim() || null,
      referral_source: form.referral_source || null,
    } as any);

    if (error) {
      toast.error("Something went wrong. Please try again.");
      console.error(error);
      setSubmitting(false);
      return;
    }

    // Send notification emails via edge function
    supabase.functions.invoke("academy-enquiry-notify", {
      body: {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        programme_interest: form.programme_interest,
        message: form.message.trim(),
        referral_source: form.referral_source,
      },
    }).catch(console.error);

    setSubmitting(false);
    onSuccess(form.first_name.trim());
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-4 bg-card rounded-2xl p-6 border border-border shadow-sm mt-4"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.3 }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fn">First Name *</Label>
          <Input id="fn" required maxLength={50} value={form.first_name} onChange={e => setForm(d => ({ ...d, first_name: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="ln">Last Name *</Label>
          <Input id="ln" required maxLength={50} value={form.last_name} onChange={e => setForm(d => ({ ...d, last_name: e.target.value }))} />
        </div>
      </div>
      <div>
        <Label htmlFor="em">Email Address *</Label>
        <Input id="em" type="email" required maxLength={255} value={form.email} onChange={e => setForm(d => ({ ...d, email: e.target.value }))} />
      </div>
      <div>
        <Label htmlFor="ph">Phone Number *</Label>
        <Input id="ph" type="tel" required maxLength={20} value={form.phone} onChange={e => setForm(d => ({ ...d, phone: e.target.value }))} />
      </div>
      <div>
        <Label>Which programme are you interested in?</Label>
        <Select value={form.programme_interest} onValueChange={v => setForm(d => ({ ...d, programme_interest: v }))}>
          <SelectTrigger><SelectValue placeholder="Select a programme..." /></SelectTrigger>
          <SelectContent>
            {PROGRAMME_OPTIONS.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="msg">Tell us a little about yourself and why you want to learn grooming</Label>
        <Textarea id="msg" rows={3} maxLength={1000} value={form.message} onChange={e => setForm(d => ({ ...d, message: e.target.value }))} />
      </div>
      <div>
        <Label>How did you hear about us?</Label>
        <Select value={form.referral_source} onValueChange={v => setForm(d => ({ ...d, referral_source: v }))}>
          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {REFERRAL_OPTIONS.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={submitting} className="w-full py-6 text-base rounded-xl font-bold" style={{ background: "hsl(18, 100%, 60%)" }}>
        {submitting ? "Sending..." : "Send My Registration 🐾"}
      </Button>
    </motion.form>
  );
}

export default function AcademyPage() {
  const { user } = useAuth();
  const { role } = useUserRole(user?.id);
  const isAdmin = role === "director" || role === "manager";
  const coursesRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [openForm, setOpenForm] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Grooming Academy — Fluff & Scruff Studio";
  }, []);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleRegisterClick = (programme: string) => {
    if (openForm === programme) {
      setOpenForm(null);
    } else {
      setOpenForm(programme);
      setSubmitted(null);
    }
  };

  const courses = [
    {
      emoji: "🛁",
      title: "Groom Your Own Dog",
      duration: "Half Day • 3 Hours",
      price: "£300",
      priceSub: "per session",
      description: "Perfect for pet owners who want to keep their dog well-groomed at home. Bring your dog and leave knowing exactly how to bath, dry, brush and trim them safely.",
      includes: [
        "Hands-on with your own dog",
        "Bath, dry & brush techniques",
        "Safe scissoring basics",
        "Products & tools guidance",
        "Take-home care guide",
      ],
    },
    {
      emoji: "✂️",
      title: "Full Day Grooming Masterclass",
      duration: "Full Day • 10am–5pm",
      price: "£250",
      priceSub: "per person",
      description: "A complete day immersed in professional grooming. You'll work on multiple dogs, learn different coat types, and finish the day with real confidence and real skills.",
      includes: [
        "Multiple dogs, multiple breeds",
        "Bath, dry, scissor & clip techniques",
        "Coat type masterclass",
        "Tools & product kit guidance",
        "Lunch included",
        "Certificate of attendance",
      ],
    },
    {
      emoji: "🏅",
      title: "Pro Skills Workshop",
      duration: "Full Day • Qualified Groomers Only",
      price: "£180",
      priceSub: "per groomer",
      description: "Already grooming professionally? Join a specialist workshop focused on scissoring, hand stripping, or specific breed styling. Sharpen your technique with expert guidance.",
      specialisms: ["Scissoring", "Hand Stripping", "Breed Styling", "Asian Fusion"],
    },
  ];

  const steps = [
    { emoji: "📝", title: "Apply Online", desc: "Fill in the short form below telling us which programme interests you and a little about yourself." },
    { emoji: "📞", title: "We'll Be In Touch", desc: "We'll contact you within 48 hours to discuss your goals and confirm your spot." },
    { emoji: "📅", title: "Pick Your Date", desc: "Choose a date that works for you. Small groups mean flexible scheduling." },
    { emoji: "✂️", title: "Come & Groom", desc: "Arrive at our Hornchurch studio. Everything is set up and waiting for you." },
  ];

  const faqs = [
    { q: "Do I need any experience?", a: "Not at all for the Pet Owner and Full Day Masterclass sessions. The Pro Skills Workshop is designed for qualified or working groomers who want to refine specific skills." },
    { q: "Do I get a certificate?", a: "The Full Day Masterclass and Month-Long Programme include a certificate of completion. Our courses are about real skills — you leave knowing how to groom, not just holding a piece of paper." },
    { q: "Can I bring my own dog?", a: "For the Pet Owner session — absolutely, that's the whole point! For the other courses we provide the dogs from our regular client bookings." },
    { q: "How many people are in each session?", a: "Maximum 3 students per session. We keep it small on purpose so you get real hands-on time, not just watching." },
    { q: "Where is the studio?", a: "138 Hillview Avenue, Hornchurch RM11 2DL. There's parking on site and we're about 5 minutes from Hornchurch Station." },
    { q: "What should I wear?", a: "Comfortable clothes you don't mind getting a little wet or hairy! We provide aprons but dogs will be dogs." },
  ];

  const monthLongProgrammeKey = "Month-Long Grooming Programme — £2,800";

  return (
    <div className="min-h-screen font-body" style={{ background: "hsl(30, 100%, 98%)" }}>
      {isAdmin && (
        <div className="fixed top-4 left-4 z-50">
          <Link to="/admin" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur rounded-full px-3 py-1.5 shadow-sm">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>
      )}

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
          <motion.h1 variants={fadeUp} className="font-heading text-4xl md:text-6xl leading-tight mb-4" style={{ color: "hsl(20, 60%, 12%)" }}>
            Welcome to Fluff &amp; Scruff Academy
          </motion.h1>
          <motion.p variants={fadeUp} className="font-heading text-xl md:text-2xl mb-6" style={{ color: "hsl(18, 100%, 60%)" }}>
            Learn to Groom. Love What You Do.
          </motion.p>
          <motion.p variants={fadeUp} className="text-lg md:text-xl mb-8 max-w-2xl mx-auto" style={{ color: "hsla(20, 60%, 12%, 0.7)" }}>
            Hands-on grooming masterclasses at Fluff &amp; Scruff Studio — real dogs, real skills, real results. No exams. No theory. Just grooming.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Button size="lg" className="text-base px-8 py-6 rounded-2xl font-bold" style={{ background: "hsl(18, 100%, 60%)" }} onClick={() => scrollTo(coursesRef)}>
              See Programmes ↓
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

          {/* ── MONTH-LONG PROGRAMME (FIRST — FLAGSHIP) ── */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={fadeUp} className="relative rounded-2xl p-8 md:p-10 mb-8 flex flex-col" style={{ background: "#2D1B0E" }}>
            <span className="absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-bold" style={{ background: "#FFB800", color: "#2D1B0E" }}>
              ⭐ Most Comprehensive
            </span>
            <span className="text-4xl mb-3">🎓</span>
            <h3 className="font-heading text-2xl md:text-3xl mb-1" style={{ color: "white" }}>Month-Long Grooming Programme</h3>
            <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>4 Weeks · 3 Days Per Week · Mostly Hands-On</p>
            <p className="font-heading text-4xl mb-0" style={{ color: "#FFB800" }}>£2,800</p>
            <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>per student · £500 deposit secures your place. Remaining £2,300 split across the month.</p>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>
              Our most comprehensive offering. Spend a full month working inside our professional salon, grooming real client dogs. Sessions are mostly hands-on with theory woven naturally into each day — no classrooms, no slideshows, just real grooming with real dogs.
            </p>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>
              You will work 3 days per week across 4 weeks (12 sessions total). Days are flexible and agreed when you register, fitted around your schedule where possible.
            </p>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.85)" }}>
              Groups are kept tiny — maximum 3 students at a time — so you get genuine one-to-one attention throughout.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 mb-6">
              {[
                "12 hands-on grooming sessions",
                "Real client dogs every session",
                "All coat types and breeds covered",
                "Bath, dry, clip and scissor techniques",
                "Asian Fusion styling introduction",
                "Hand stripping introduction",
                "Customer handling and communication",
                "Tools and equipment guidance",
                "Business basics (optional module)",
                "Certificate of completion",
                "WhatsApp support for 3 months after",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                  <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#FFB800" }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {["Career changers", "Pet owners wanting professional skills", "Groomers wanting a full reset", "Anyone serious about grooming"].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: "hsl(18, 100%, 60%)" }}>{tag}</span>
              ))}
            </div>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.45)" }}>
              Comparable programmes in London charge £4,350–£5,450. We keep our groups tiny — maximum 3 students — and our prices fair.
            </p>

            {submitted === monthLongProgrammeKey ? (
              <div className="bg-white/10 rounded-xl p-6 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-heading text-lg" style={{ color: "white" }}>Thank you {submitted.split("|||")[0]}! We have received your registration and will be in touch within 2 working days. 🐾</p>
              </div>
            ) : (
              <>
                <Button
                  className="w-full py-6 text-base rounded-xl font-bold"
                  style={{ background: "hsl(18, 100%, 60%)" }}
                  onClick={() => handleRegisterClick(monthLongProgrammeKey)}
                >
                  {openForm === monthLongProgrammeKey ? "Hide Form" : "Register Your Interest 🐾"}
                </Button>
                {openForm === monthLongProgrammeKey && (
                  <RegistrationForm
                    programme={monthLongProgrammeKey}
                    onSuccess={(name) => setSubmitted(monthLongProgrammeKey)}
                  />
                )}
              </>
            )}
          </motion.div>

          {/* ── OTHER COURSES ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {courses.map((c) => {
              const programmeKey = `${c.title} — ${c.price}`;
              return (
                <motion.div
                  key={c.title}
                  variants={fadeUp}
                  className="relative bg-card rounded-2xl p-6 shadow-sm border border-border flex flex-col"
                >
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

                  {submitted === programmeKey ? (
                    <div className="bg-muted rounded-xl p-4 text-center">
                      <p className="text-xl mb-1">✅</p>
                      <p className="text-sm font-medium" style={{ color: "hsl(20, 60%, 12%)" }}>Thank you! We'll be in touch within 2 working days. 🐾</p>
                    </div>
                  ) : (
                    <>
                      <Button
                        className="w-full rounded-xl font-bold"
                        style={{ background: "hsl(18, 100%, 60%)" }}
                        onClick={() => handleRegisterClick(programmeKey)}
                      >
                        {openForm === programmeKey ? "Hide Form" : "Register Your Interest 🐾"}
                      </Button>
                      {openForm === programmeKey && (
                        <RegistrationForm
                          programme={programmeKey}
                          onSuccess={() => setSubmitted(programmeKey)}
                        />
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
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
          <Button size="lg" className="text-base px-10 py-6 rounded-2xl font-bold" style={{ background: "white", color: "hsl(18, 100%, 60%)" }} onClick={() => scrollTo(coursesRef)}>
            View Programmes
          </Button>
        </div>
      </section>
    </div>
  );
}
