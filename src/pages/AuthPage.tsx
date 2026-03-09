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
import { ArrowLeft, Loader2 } from "lucide-react";

function getRoleRedirect(role: AppRole | null): string {
  if (role === "manager" || role === "director") return "/admin";
  if (role === "groomer") return "/portal";
  return "/";
}

type Mode = "login" | "signup" | "forgot";

type MigratedStatus = null | "checking" | "pending" | "already_active" | "not_found";

interface MigratedInfo {
  status: MigratedStatus;
  name?: string;
  migrated_id?: string;
}

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

  // Migrated customer detection
  const [migrated, setMigrated] = useState<MigratedInfo>({ status: null });

  if (loading || (user && roleLoading)) return null;
  if (user) return <Navigate to={getRoleRedirect(role)} replace />;

  const checkMigratedCustomer = async (emailToCheck: string) => {
    const trimmed = emailToCheck.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setMigrated({ status: null });
      return;
    }

    setMigrated({ status: "checking" });

    try {
      const { data, error } = await supabase.functions.invoke("check-migrated-customer", {
        body: { email: trimmed, action: "check" },
      });

      if (error) throw error;

      if (!data.found) {
        setMigrated({ status: "not_found" });
      } else if (data.status === "already_active") {
        setMigrated({ status: "already_active", name: data.name });
      } else {
        setMigrated({ status: "pending", name: data.name, migrated_id: data.migrated_id });
        if (data.name && mode === "signup") {
          setFullName(data.name);
        }
      }
    } catch {
      setMigrated({ status: null });
    }
  };

  const handleEmailBlur = useCallback(() => {
    if (email.trim()) {
      checkMigratedCustomer(email);
    }
  }, [email, mode]);

  // Handle migrated customer activation (create account + link)
  const handleMigratedActivation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords match.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("check-migrated-customer", {
        body: {
          email: email.trim().toLowerCase(),
          action: "activate",
          password,
          full_name: fullName || migrated.name,
        },
      });

      if (error) throw error;
      if (data?.error === "already_active") {
        toast({ title: "Account already exists", description: "Please sign in instead.", variant: "destructive" });
        setMigrated({ status: "already_active", name: migrated.name });
        setSubmitting(false);
        return;
      }
      if (data?.error) throw new Error(data.error);

      // Sign in with the newly created account
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInErr) throw signInErr;

      window.gtag?.("event", "sign_up", { method: "migrated_self_register" });
      logAudit({ action: "MIGRATED_SELF_REGISTER", details: `Migrated customer self-registered: ${email}` });

      toast({
        title: "Welcome back! 🐾",
        description: "We've connected your full booking history to your account.",
      });
      // Auth state change will trigger redirect
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      logAudit({ action: "LOGIN", details: `Logged in via email: ${email}` });
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
      toast({ title: "Email sent", description: "Check your inbox for a password reset link." });
    }
  };

  // Determine if we're in migrated-customer flow
  const isMigratedPending = migrated.status === "pending";
  const isMigratedAlreadyActive = migrated.status === "already_active";

  // For migrated pending customers, show the activation form
  const getFormHandler = () => {
    if (isMigratedPending) return handleMigratedActivation;
    if (mode === "login") return handleLogin;
    if (mode === "signup") return handleSignup;
    return handleForgot;
  };

  const getHeading = () => {
    if (isMigratedPending) return "Welcome back — set your password";
    if (mode === "login") return "Welcome Back";
    if (mode === "signup") return "Create Account";
    return "Reset Password";
  };

  const getButtonText = () => {
    if (submitting) return "Please wait…";
    if (isMigratedPending) return "Access My Account →";
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

        {/* Migrated customer recognition banner */}
        {isMigratedPending && (
          <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "#FFF3E0" }}>
            <p className="text-sm font-medium text-foreground">
              👋 Welcome back{migrated.name ? `, ${migrated.name.split(" ")[0]}` : ""}!
            </p>
            <p className="text-sm text-muted-foreground">
              We recognise you from our previous booking system. Your appointment history is here
              waiting for you — just create a password to access your account.
            </p>
          </div>
        )}

        {/* Already active migrated customer */}
        {isMigratedAlreadyActive && mode === "signup" && (
          <div className="rounded-xl p-4 space-y-3 border border-accent/30 bg-accent/5">
            <p className="text-sm font-medium text-foreground">
              You already have an account with us!
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setMode("login"); setMigrated({ status: null }); }}
              className="w-full"
            >
              Sign in instead →
            </Button>
          </div>
        )}

        <form onSubmit={getFormHandler()} className="space-y-4">
          {/* Full Name - only for normal signup, not migrated */}
          {mode === "signup" && !isMigratedPending && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required />
            </div>
          )}

          {/* Email field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // Reset migrated status when email changes
                  if (migrated.status !== null && migrated.status !== "checking") {
                    setMigrated({ status: null });
                  }
                }}
                onBlur={handleEmailBlur}
                placeholder="hello@example.com"
                required
              />
              {migrated.status === "checking" && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Password fields - show for login (non-migrated), signup (non-migrated), or migrated pending */}
          {mode !== "forgot" && !isMigratedAlreadyActive && (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {isMigratedPending ? "Choose a password" : "Password"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {/* Confirm password for signup and migrated activation */}
              {(mode === "signup" || isMigratedPending) && (
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

          {/* Don't show submit if already active on signup */}
          {!(isMigratedAlreadyActive && mode === "signup") && (
            <Button type="submit" className="w-full bg-charcoal text-primary-foreground" disabled={submitting}>
              {getButtonText()}
            </Button>
          )}
        </form>

        <div className="text-center text-sm font-body space-y-2">
          {mode === "login" && !isMigratedPending && (
            <>
              <button onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-foreground transition-colors block mx-auto">Forgot password?</button>
              <p className="text-muted-foreground">Don't have an account?{" "}<button onClick={() => { setMode("signup"); setMigrated({ status: null }); }} className="text-foreground font-medium hover:underline">Sign up</button></p>
            </>
          )}
          {mode === "signup" && !isMigratedPending && (
            <p className="text-muted-foreground">Already have an account?{" "}<button onClick={() => { setMode("login"); setMigrated({ status: null }); }} className="text-foreground font-medium hover:underline">Sign in</button></p>
          )}
          {mode === "forgot" && (
            <button onClick={() => setMode("login")} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"><ArrowLeft className="h-3 w-3" /> Back to sign in</button>
          )}
          {isMigratedPending && (
            <button onClick={() => { setMigrated({ status: null }); setMode("login"); }} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"><ArrowLeft className="h-3 w-3" /> Back to sign in</button>
          )}
        </div>

        <div className="text-center">
          <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back to homepage</button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
