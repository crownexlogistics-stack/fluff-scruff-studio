import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo-transparent.png";

const TermsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 bg-white/75 backdrop-blur-2xl border-b border-border/20 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <a href="/" className="cursor-pointer">
            <img src={logo} alt="Fluff & Scruff" className="h-12 sm:h-14 w-auto" />
          </a>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-heading text-foreground mb-8">
          Terms &amp; Conditions for Dog Grooming
        </h1>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-semibold text-foreground">1. Health and Vaccinations</h2>
            <p>1.1. Clients are responsible for ensuring that their dog's vaccinations are up-to-date and in accordance with local regulations. Proof of vaccinations may be requested by Fluff and Scruff Studio.</p>
            <p>1.2. If a dog is unwell or has any contagious condition (e.g., kennel cough, fleas, or skin infections), clients are required to reschedule their grooming appointment until the dog is healthy and no longer contagious.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-semibold text-foreground">2. Behaviour and Aggression</h2>
            <p>2.1. Clients must disclose any behavioural issues or aggression their dog may have. This includes any history of biting, extreme anxiety, or discomfort during specific grooming tasks.</p>
            <p>2.2. Fluff and Scruff Studio reserves the right to refuse or terminate grooming services if a dog displays aggressive behaviour that poses a risk to the safety of our staff or other pets. In such cases, the full grooming fee may still apply.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-semibold text-foreground">3. Pre-existing Health Conditions</h2>
            <p>3.1. Clients must inform Fluff and Scruff Studio of any pre-existing health conditions, injuries, allergies, or sensitivities their dog may have before the appointment begins.</p>
            <p>3.2. While we take every reasonable care, clients acknowledge that grooming procedures can occasionally exacerbate existing health conditions. Fluff and Scruff Studio is not liable for issues arising from undisclosed or pre-existing conditions.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-semibold text-foreground">4. Matted Coat and De-Matting Fees</h2>
            <p>4.1. <strong className="text-foreground">Disclosure:</strong> Clients are required to disclose if a dog's coat is matted prior to the appointment.</p>
            <p>4.2. <strong className="text-foreground">Additional Charges:</strong> If a dog is found to have a matted condition that was not disclosed at the time of booking, an additional de-matting charge of £10 will be added to the final grooming price to cover extra time and equipment wear.</p>
            <p>4.3. <strong className="text-foreground">Welfare:</strong> If matting is severe and cannot be brushed out humanely, Fluff and Scruff Studio reserves the right to clip the coat short (a "shave down") in the interest of the dog's welfare.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-semibold text-foreground">5. Sedation and Special Needs</h2>
            <p>5.1. If a dog requires sedation or has special needs (such as elderly pets or those with significant medical conditions), clients must inform Fluff and Scruff Studio in advance.</p>
            <p>5.2. Any sedation must be administered by a veterinarian. Fluff and Scruff Studio staff will not administer sedatives or medications to dogs.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-semibold text-foreground">6. Deposits and Cancellation Policy</h2>
            <p>6.1. <strong className="text-foreground">Deposits:</strong> A deposit is required to secure all bookings.</p>
            <p>6.2. <strong className="text-foreground">The 48-Hour Rule:</strong> To receive a refund of your deposit or to transfer it to a new date, you must provide at least 48 hours' notice for any cancellations or rescheduling.</p>
            <p>6.3. <strong className="text-foreground">Non-Refundable Deposits:</strong> If an appointment is cancelled, missed (no-show), or a request to reschedule is made less than 48 hours before the scheduled start time, the deposit is strictly non-refundable.</p>
            <p>6.4. <strong className="text-foreground">Final Payment:</strong> The remaining balance for grooming services is due at the time of service. We accept card or other approved electronic payments. We do not accept cash.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-semibold text-foreground">7. Agreement</h2>
            <p>By booking an appointment and bringing their dog(s) to Fluff and Scruff Studio, clients agree to adhere to these Terms and Conditions. Fluff and Scruff Studio reserves the right to update these terms periodically. These terms are designed to protect the interests of the studio and, most importantly, the well-being of the dogs in our care.</p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default TermsPage;
