import { useState, useCallback } from "react";
import { toast } from "sonner";
import { handleApiError } from "@/components/error-reporting/ErrorReportButton";

export function useApiErrorHandler() {
  const [tellUsMoreOpen, setTellUsMoreOpen] = useState(false);
  const [errorReportId, setErrorReportId] = useState<string | null>(null);

  const handleError = useCallback(async (error: Error | string) => {
    const reportId = await handleApiError(error);
    setErrorReportId(reportId);

    toast.error("Something went wrong — we've logged this automatically 🐾", {
      action: reportId
        ? {
            label: "Tell us more",
            onClick: () => {
              setTellUsMoreOpen(true);
            },
          }
        : undefined,
      duration: 6000,
    });
  }, []);

  return {
    handleError,
    tellUsMoreOpen,
    setTellUsMoreOpen,
    errorReportId,
  };
}
