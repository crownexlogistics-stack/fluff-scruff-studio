import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import logo from "@/assets/logo-transparent.png";
import { ArrowLeft } from "lucide-react";

function getRoleRedirect(role: AppRole | null): string {
  if (role === "manager" || role === "director") return "/admin";
  if (role === "groomer") return "/portal";
  return "/my-pets";
}

type Mode = "login" | "signup" | "forgot";

const AuthPage = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user?.id);

  // State for migrated customer detection on failed login
  const [migratedPrompt, setMigratedPrompt] = useState<{ show: boolean; name?: string; emailSent?: boolean }>({ show: false });

  if (loading || (user && roleLoading)) return null;
  if (user) return <Navigate to={getRoleRedirect(role)} replace />;

  const maskEmail = (e: string) => {
    const [local, domain] = e.split("@");
    if (!domain) return "***";
    return `${local[0]}${"*".repeat(Math.max(local.length - 2, 1))}${local.length > 1 ? local[local.length - 1] : ""}@${domain}`;
  };

  const logLoginEvent = async (errorType: string, message: string, severity: string = "low") => {
    try {
      await supabase.from("error_reports" as any).insert({
        error_description: `[${errorType}] ${message}`,
        steps_to_reproduce: `Email: ${maskEmail(email)}`,
        page_url: window.location.href,
        browser_info: `${navigator.userAgent.includes("Chrome") ? "Chrome" : navigator.userAgent.includes("Safari") ? "Safari" : navigator.userAgent.includes("Firefox") ? "Firefox" : "Other"} — ${navigator.userAgent}`,
        device_info: `${window.innerWidth < 768 ? "Mobile" : window.innerWidth < 1024 ? "Tablet" : "Desktop"} — ${window.innerWidth}x${window.innerHeight}`,
        status: "new",
        severity,
        customer_email: maskEmail(email),
      } as any);
    } catch {}
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMigratedPrompt({ show: false });

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      if (error.message?.includes("Invalid login credentials")) {
        // Check if this is a migrated customer without an auth account
        try {
          const { data: migratedRecord } = await supabase
            .from("migrated_customers")
            .select("id, full_name")
            .eq("email", email.trim().toLowerCase())
            .maybeSingle();

          if (migratedRecord) {
            // Migrated customer found — show friendly prompt instead of error
            setMigratedPrompt({ show: true, name: migratedRecord.full_name || undefined });
            setSubmitting(false);
            return;
          }
        } catch {
          // If the migrated check fails, fall through to normal error
        }

        // Not a migrated customer — show normal error
        toast({ title: "Login failed", description: "Incorrect email or password. Please try again or register below.", variant: "destructive" });
        logLoginEvent("LOGIN_FAILED", "Customer entered incorrect password");
      } else if (error.message?.includes("too many requests") || error.message?.includes("rate limit")) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
        logLoginEvent("ACCOUNT_LOCKED", "Customer account locked after multiple failed attempts", "medium");
      } else {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      }
    } else {
      logAudit({ action: "LOGIN", details: `Logged in via email: ${email}` });
    }
    setSubmitting(false);
  };

  const handleSendSetupEmail = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMigratedPrompt((prev) => ({ ...prev, emailSent: true }));
      logLoginEvent("MIGRATED_SETUP_REQUESTED", "Migrated customer requested account setup email");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong sending the email.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords match.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We've sent you a confirmation link to verify your account." });
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      logLoginEvent("PASSWORD_RESET_REQUESTED", "Customer requested password reset");
      toast({ title: "Email sent", description: "Check your inbox for a password reset link." });
    }
  };

  const getFormHandler = () => {
    if (mode === "login") return handleLogin;
    if (mode === "signup") return handleSignup;
    return handleForgot;
  };

  const getHeading = () => {
    if (mode === "login") return "Welcome Back";
    if (mode === "signup") return "Create Account";
    return "Reset Password";
  };

  const getButtonText = () => {
    if (submitting) return "Please wait…";
    if (mode === "login") return "Sign In";
    if (mode === "signup") return "Create Account";
    return "Send Reset Link";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <img src={logo} alt="Fluff & Scruff" className="h-16 w-auto mx-auto" />
          <h1 className="text-2xl font-heading text-foreground">{getHeading()}</h1>
        </div>

        {/* Migrated customer prompt — shown after failed login */}
        {migratedPrompt.show && !migratedPrompt.emailSent && (
          <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "#FFF3E0" }}>
            <p className="text-sm font-medium text-foreground">
              👋 Welcome back{migratedPrompt.name ? `, ${migratedPrompt.name.split(" ")[0]}` : ""}!
            </p>
            <p className="text-sm text-muted-foreground">
              We have your details from your previous visits. Please set up your password to access your account.
            </p>
            <Button
              onClick={handleSendSetupEmail}
              disabled={submitting}
              className="w-full bg-charcoal text-primary-foreground"
            >
              {submitting ? "Sending…" : "Set Up My Account"}
            </Button>
          </div>
        )}

        {/* Confirmation after setup email sent */}
        {migratedPrompt.show && migratedPrompt.emailSent && (
          <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "#E8F5E9" }}>
            <p className="text-sm font-medium text-foreground">📧 Email sent!</p>
            <p className="text-sm text-muted-foreground">
              We've sent a link to <strong>{email.trim().toLowerCase()}</strong> — click it to set your password and you're in!
            </p>
          </div>
        )}

        {/* Hide form when migrated prompt is showing */}
        {!migratedPrompt.show && (
          <>
            <form onSubmit={getFormHandler()} className="space-y-4" data-form-type="login">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@example.com"
                  required
                />
              </div>

              {mode !== "forgot" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>

                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>
                  )}
                </>
              )}

              <Button type="submit" className="w-full bg-charcoal text-primary-foreground" disabled={submitting}>
                {getButtonText()}
              </Button>
            </form>

            <div className="text-center text-sm font-body space-y-2">
              {mode === "login" && (
                <>
                  <button onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-foreground transition-colors block mx-auto">Forgot password?</button>
                  <p className="text-muted-foreground">Don't have an account?{" "}<button onClick={() => setMode("signup")} className="text-foreground font-medium hover:underline">Sign up</button></p>
                </>
              )}
              {mode === "signup" && (
                <p className="text-muted-foreground">Already have an account?{" "}<button onClick={() => setMode("login")} className="text-foreground font-medium hover:underline">Sign in</button></p>
              )}
              {mode === "forgot" && (
                <button onClick={() => setMode("login")} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"><ArrowLeft className="h-3 w-3" /> Back to sign in</button>
              )}
            </div>
          </>
        )}

        {/* Back to sign in from migrated prompt */}
        {migratedPrompt.show && (
          <div className="text-center text-sm font-body">
            <button onClick={() => setMigratedPrompt({ show: false })} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto">
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </button>
          </div>
        )}

        <div className="text-center">
          <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back to homepage</button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
