import { useState } from "react";
import { ErrorReportModal } from "./ErrorReportModal";

export function ErrorReportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 px-4 py-2.5 text-white font-bold text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
        style={{
          background: '#FF6B35',
          borderRadius: '30px',
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        ⚠️ Report a Problem
      </button>
      <ErrorReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
