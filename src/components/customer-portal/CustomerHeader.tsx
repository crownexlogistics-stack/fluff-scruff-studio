import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Menu, X, LogOut, LogIn } from "lucide-react";

interface CustomerHeaderProps {
  user: any;
  signOut: () => Promise<void>;
}

export function CustomerHeader({ user, signOut }: CustomerHeaderProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-background border-b border-border/10">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left: F&S circle */}
        <Link to="/" className="shrink-0">
          <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center">
            <span className="text-background font-heading text-xs font-bold leading-none">F&S</span>
          </div>
        </Link>

        {/* Centre + Right */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/book")}
            className="font-bold font-body text-sm px-5 py-2 bg-accent text-accent-foreground hover:bg-accent/90 transition-all active:scale-[0.96]"
            style={{ borderRadius: '30px' }}
          >
            📅 Book Now
          </button>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-foreground hover:text-foreground/80 transition-colors p-2"
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border/30 bg-background px-4 py-3 space-y-1 animate-in slide-in-from-top-2 duration-200">
          <Link to="/" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-foreground/80 hover:bg-muted/50 transition-colors">Home</Link>
          <Link to="/book" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-foreground/80 hover:bg-muted/50 transition-colors">Book Appointment</Link>
          <Link to="/terms" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-foreground/80 hover:bg-muted/50 transition-colors">Terms & Conditions</Link>
          {user ? (
            <div className="pt-2 border-t border-border/30">
              <button
                onClick={async () => { setMenuOpen(false); await signOut(); navigate("/"); }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-muted-foreground hover:bg-muted/50 transition-colors w-full"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-border/30">
              <Link to="/auth" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-muted-foreground hover:bg-muted/50 transition-colors">
                <LogIn className="h-4 w-4" /> Login
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
