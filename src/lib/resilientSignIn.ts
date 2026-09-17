import { supabase } from "@/integrations/supabase/client";

export type SignInFailureKind =
  | "invalid_credentials"
  | "rate_limited"
  | "network"
  | "unknown";

export interface SignInOutcome {
  ok: boolean;
  kind?: SignInFailureKind;
  /** Raw message from the auth service, when there is a meaningful one. */
  rawMessage?: string;
  /** Message safe to show to a person. */
  friendlyMessage?: string;
}

const CONNECTION_MESSAGE =
  "Couldn't reach the studio system — check your connection and try again.";

function isBlankMessage(message?: string | null): boolean {
  if (!message) return true;
  const trimmed = message.trim();
  return trimmed === "" || trimmed === "{}" || trimmed === "[object Object]";
}

export function classifySignInError(error: any): SignInFailureKind {
  const message: string = typeof error?.message === "string" ? error.message : "";
  const lower = message.toLowerCase();
  const status: number | undefined =
    typeof error?.status === "number" ? error.status : undefined;

  if (lower.includes("invalid login credentials")) return "invalid_credentials";
  if (lower.includes("too many requests") || lower.includes("rate limit")) {
    return "rate_limited";
  }
  if (
    isBlankMessage(message) ||
    (status !== undefined && status >= 500) ||
    status === 0 ||
    status === 408 ||
    status === 504 ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("deadline") ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("upstream") ||
    lower.includes("unexpected_failure") ||
    lower.includes("gateway")
  ) {
    return "network";
  }
  return "unknown";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sign in, retrying quietly when the auth service stalls or returns an empty
 * error. Only genuine credential / rate-limit failures are surfaced as such.
 */
export async function signInWithRetry(
  email: string,
  password: string,
  attempts = 3,
): Promise<SignInOutcome> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let error: any = null;
    try {
      const res = await supabase.auth.signInWithPassword({ email, password });
      error = res.error;
    } catch (thrown) {
      error = thrown;
    }

    if (!error) return { ok: true };

    const kind = classifySignInError(error);
    lastError = error;

    if (kind !== "network") {
      return {
        ok: false,
        kind,
        rawMessage: isBlankMessage(error?.message) ? undefined : error.message,
        friendlyMessage:
          kind === "invalid_credentials"
            ? "Incorrect email or password. Please try again."
            : kind === "rate_limited"
              ? "Too many attempts — please wait a moment and try again."
              : error?.message || "Something went wrong signing in.",
      };
    }

    if (attempt < attempts) await sleep(800 * attempt);
  }

  return {
    ok: false,
    kind: "network",
    rawMessage: isBlankMessage(lastError?.message) ? undefined : lastError?.message,
    friendlyMessage: CONNECTION_MESSAGE,
  };
}
