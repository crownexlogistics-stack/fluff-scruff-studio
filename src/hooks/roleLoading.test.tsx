import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./useAuth";
import { useUserRole, type AppRole } from "./useUserRole";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const backend = vi.hoisted(() => ({
  getSession: vi.fn(),
  roleLookup: vi.fn(),
  authListener: null as null | ((event: string, session: unknown) => void),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: backend.getSession,
      onAuthStateChange: (listener: typeof backend.authListener) => {
        backend.authListener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: vi.fn(),
    },
    from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: backend.roleLookup }) }) }) }),
  },
}));
vi.mock("./useStaffBlockCheck", () => ({ useStaffBlockCheck: () => false }));
vi.mock("./useFullCalendarAccess", () => ({ useFullCalendarAccess: () => ({ hasFullCalendarAccess: false, loading: false }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); backend.authListener = null; });

function setup() {
  backend.getSession.mockResolvedValue({ data: { session: { user: { id: "groomer-user" } } }, error: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const observed: Array<AppRole | null> = [];
  function Page() {
    const { user } = useAuth();
    const { role } = useUserRole(user?.id);
    observed.push(role);
    return null;
  }
  const tree = (pageKey: string) => (
    <QueryClientProvider client={client}><AuthProvider><MemoryRouter>
      <ProtectedRoute allowedRoles={["groomer", "director", "manager"]}><Page key={pageKey} /></ProtectedRoute>
    </MemoryRouter></AuthProvider></QueryClientProvider>
  );
  return { client, observed, tree };
}

describe("shared groomer page role loading", () => {
  it("never mounts a shared page before the groomer role is verified", async () => {
    let resolveRole: ((value: unknown) => void) | undefined;
    backend.roleLookup.mockImplementation(() => new Promise(resolve => { resolveRole = resolve; }));
    const { observed, tree } = setup();
    render(tree("needs-me"));
    await waitFor(() => expect(backend.roleLookup).toHaveBeenCalled());
    expect(observed).toEqual([]);
    await act(async () => { resolveRole?.({ data: { role: "groomer" }, error: null }); });
    await waitFor(() => expect(observed.length).toBeGreaterThan(0));
    expect(observed.every(role => role === "groomer")).toBe(true);
  });

  it("newly mounted shared pages immediately reuse the guard's groomer role", async () => {
    backend.roleLookup.mockResolvedValue({ data: { role: "groomer" }, error: null });
    const { observed, tree } = setup();
    const view = render(tree("needs-me"));
    await waitFor(() => expect(observed.length).toBeGreaterThan(0));
    backend.roleLookup.mockImplementation(() => new Promise(() => {}));
    for (const page of ["specialty-grooming", "blacklist", "packages", "customer-profile", "placements", "placement-profile"]) {
      observed.length = 0;
      view.rerender(tree(page));
      await waitFor(() => expect(observed.length).toBeGreaterThan(0));
      expect(observed.every(role => role === "groomer")).toBe(true);
    }
    expect(backend.getSession).toHaveBeenCalledTimes(1);
  });

  it("does not reuse a director role when the signed-in account changes", async () => {
    backend.roleLookup.mockResolvedValue({ data: { role: "director" }, error: null });
    const { observed, tree } = setup();
    render(tree("packages"));
    await waitFor(() => expect(observed).toContain("director"));
    backend.roleLookup.mockImplementation(() => new Promise(() => {}));
    observed.length = 0;
    await act(async () => backend.authListener?.("SIGNED_IN", { user: { id: "another-groomer" } }));
    expect(observed).toEqual([]);
  });

  it("denies page children when role verification fails", async () => {
    backend.roleLookup.mockImplementation(() => new Promise(() => {}));
    const { client, observed, tree } = setup();
    render(tree("packages"));
    await waitFor(() => expect(backend.roleLookup).toHaveBeenCalled());
    await act(async () => {
      const query = client.getQueryCache().find({ queryKey: ["authenticated-user-role", "groomer-user"] });
      query?.setState({ status: "error", error: new Error("Unavailable"), fetchStatus: "idle" });
    });
    expect(observed).toEqual([]);
  });
});