import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Menu, X, LogOut, LogIn, CalendarPlus } from "lucide-react";
import logo from "@/assets/logo-transparent.png";

interface CustomerHeaderProps {
  user: any;
  signOut: () => Promise<void>;
}

export function CustomerHeader({ user, signOut }: CustomerHeaderProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/75 backdrop-blur-2xl border-b border-border/20 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="shrink-0">
          <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto" />
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/book")}
            className="text-primary-foreground font-semibold font-body text-sm px-5 py-2 rounded-full transition-all duration-300 shadow-md hover:shadow-lg active:scale-[0.96]"
            style={{ background: 'linear-gradient(135deg, hsl(220 10% 22%), hsl(220 10% 30%))' }}
          >
            <span className="flex items-center gap-1.5">
              <CalendarPlus className="h-3.5 w-3.5" /> Book Now
            </span>
          </button>

          {user ? (
            <button
              onClick={async () => { await signOut(); navigate("/"); }}
              className="text-muted-foreground hover:text-foreground transition-colors p-2"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link to="/auth" className="text-muted-foreground hover:text-foreground transition-colors p-2">
              <LogIn className="h-4 w-4" />
            </Link>
          )}

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-foreground/70 hover:text-foreground transition-colors p-2"
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border/30 bg-white/95 backdrop-blur-xl px-4 py-3 space-y-1 animate-in slide-in-from-top-2 duration-200">
          <Link to="/" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium font-body text-foreground/80 hover:bg-muted/50 transition-colors">Home</Link>
          <Link to="/book" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium font-body text-foreground/80 hover:bg-muted/50 transition-colors">Book Appointment</Link>
          <Link to="/terms" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium font-body text-foreground/80 hover:bg-muted/50 transition-colors">Terms & Conditions</Link>
          {user && (
            <div className="pt-2 border-t border-border/30">
              <button
                onClick={async () => { setMenuOpen(false); await signOut(); navigate("/"); }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium font-body text-muted-foreground hover:bg-muted/50 transition-colors w-full"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
