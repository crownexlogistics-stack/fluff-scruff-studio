import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo-transparent.png";

export default function WelcomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);

  // Check if URL contains a valid recovery/invite token
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes("access_token") || hash.includes("type=recovery") || hash.includes("type=invite"))) {
      setHasToken(true);
    } else if (user) {
      // User is already authenticated (came back to this page)
      setHasToken(true);
    } else {
      setHasToken(false);
    }
  }, [user]);

  // If no token and not authenticated, redirect to auth
  useEffect(() => {
    if (hasToken === false && !loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [hasToken, loading, user, navigate]);

  // After password is set and user is confirmed, activate migrated customer and redirect
  useEffect(() => {
    if (passwordSet && user?.email) {
      const activate = async () => {
        await supabase
          .from("migrated_customers")
          .update({
            status: "activated",
            activated_at: new Date().toISOString(),
            supabase_user_id: user.id,
          })
          .eq("email", user.email!.toLowerCase());
        navigate("/my-pets", { replace: true });
      };
      activate();
    }
  }, [passwordSet, user, navigate]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  }, []);

  const handleConfirmChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are the same.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      toast({ title: "Error setting password", description: error.message, variant: "destructive" });
    } else {
      window.gtag?.("event", "sign_up", { method: "invite" });
      toast({ title: "Password set! 🎉", description: "You're all set. Taking you to your account..." });
      setPasswordSet(true);
    }
  };

  // Show loading while checking token/auth state
  if (loading || hasToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // No token → will be redirected by the useEffect above
  if (!hasToken && !user) return null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#FFFAF4" }}
    >
      <div className="max-w-sm w-full text-center space-y-6">
        <img src={logo} alt="Fluff & Scruff" className="h-20 w-auto mx-auto" />

        <h1
          className="text-3xl font-bold"
          style={{ fontFamily: "'Fredoka One', 'Nunito', sans-serif", color: "#1a1a1a" }}
        >
          Almost there! 🐾
        </h1>

        <p
          className="text-base leading-relaxed"
          style={{ fontFamily: "'Nunito', sans-serif", color: "#555" }}
        >
          Choose a password to secure your account, then you're in!
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={handleConfirmChange}
              placeholder="Re-enter your password"
              required
              minLength={8}
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full text-base font-bold py-6"
            style={{
              backgroundColor: "#F97316",
              color: "#ffffff",
              borderRadius: "30px",
              fontFamily: "'Fredoka One', 'Nunito', sans-serif",
              fontSize: "16px",
            }}
          >
            {submitting ? "Setting password…" : "Set My Password & Enter →"}
          </Button>
        </form>
      </div>
    </div>
  );
}
