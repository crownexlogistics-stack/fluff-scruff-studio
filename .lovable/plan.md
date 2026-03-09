

## Booking Flow UI Overhaul — Pet-Themed Animations

This plan adds playful, on-brand animations to the booking flow while preserving all existing logic (Stripe, puppy auto-switch, back navigation).

---

### 1. Walking Paw Progress Bar

- Add a **paw-print step indicator** at the top of the BookingFlow, below the header.
- Define the steps as an ordered array (e.g. `["sub-service", "breed", "calendar", "addons", "guest-details"]`), filtered based on whether the flow needs breed/addons.
- Render a row of `PawPrint` icons — completed steps use the brand accent color, current step is highlighted, future steps are greyed out (`text-muted-foreground/30`).
- Use `framer-motion`'s `layoutId` on a small underline/highlight element that animates smoothly between paw positions as the step changes, creating the "walking" effect.
- Each paw tilts slightly (`rotate: -15deg` → `15deg`) using a short spring animation on the active paw.

### 2. Tail Wag Loading Animation

- Create a small `TailWagSpinner` component using an inline SVG of a simplified dog tail.
- Animate with `framer-motion` using a repeating `rotate` keyframe (`[-20, 20, -20]` on loop) with `duration: 0.4s`.
- Replace the existing CSS spinner (line 825: `animate-spin h-8 w-8 border-4...`) and the "Processing..." text in submit buttons with this component.

### 3. Bouncy Page Transitions (Framer Motion)

- Wrap each step's content block in a `<motion.div>` with `AnimatePresence` and keyed by `step`.
- Entry: `initial={{ x: 80, opacity: 0 }}`, `animate={{ x: 0, opacity: 1 }}` with `type: "spring", stiffness: 300, damping: 25`.
- Exit: `exit={{ x: -80, opacity: 0 }}` with a fast tween.
- Track navigation direction (forward/back) to reverse the slide direction when going back (slide in from left instead of right).

### 4. Back Button & Puppy Logic

- The existing `goBack` function already resets state per step — no changes needed there.
- For the **Puppy Special "pop" effect**: when `showPuppyPopup` closes and the calendar step appears, add a `motion.div` around the "Puppy Special" service name in the calendar's summary card with `animate={{ scale: [1, 1.15, 1] }}` and a sparkle keyframe, triggered when `puppySwitched` is true.

### 5. Styling Constraints

- All animations use `duration: 0.3–0.5s` max.
- Spring transitions use high stiffness (300+) and moderate damping (25+) for snappy feel.
- No layout shifts — all animated elements have fixed dimensions or use `layout` prop.

---

### Files to Edit

| File | Change |
|------|--------|
| `src/components/BookingFlow.tsx` | Add `AnimatePresence`, `motion.div` wrappers per step, paw progress bar component, tail wag spinner, direction tracking for transitions, sparkle effect on puppy switch |

### Technical Notes

- `framer-motion` is already installed.
- The `TailWagSpinner` and `PawProgressBar` will be inline components within `BookingFlow.tsx` to keep changes contained.
- No database or edge function changes needed.

