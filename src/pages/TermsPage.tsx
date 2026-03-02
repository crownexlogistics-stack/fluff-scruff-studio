import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-transparent.png";

const TermsPage = () => {
  const navigate = useNavigate();

  const { data: content, isLoading } = useQuery({
    queryKey: ["site_config", "terms_and_conditions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("value")
        .eq("key", "terms_and_conditions")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as string) ?? "";
    },
  });

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

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div
            className="prose prose-sm max-w-none text-muted-foreground [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:mb-3 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
            dangerouslySetInnerHTML={{ __html: content ?? "" }}
          />
        )}
      </main>
    </div>
  );
};

export default TermsPage;
