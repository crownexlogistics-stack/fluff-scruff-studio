import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConnectionStateProps {
  onRetry: () => void;
  message?: string;
  compact?: boolean;
}

export function ConnectionState({
  onRetry,
  message = "We couldn't reach the studio system just now. Your account is safe — please try again.",
  compact = false,
}: ConnectionStateProps) {
  return (
    <div className={compact ? "py-10 text-center space-y-4" : "min-h-screen flex items-center justify-center p-6 bg-background"}>
      <div className="mx-auto max-w-md text-center space-y-4">
        <WifiOff className="h-12 w-12 text-muted-foreground/50 mx-auto" />
        <div className="space-y-1">
          <h2 className="font-heading text-xl text-foreground">Connection problem</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}