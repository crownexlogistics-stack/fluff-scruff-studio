import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "director" | "manager" | "groomer" | "customer" | "volunteer" | "work_placement";

export function useUserRole(userId: string | undefined) {
  // Route guards and page children must read the same verified role, not start
  // independent null-role lookups whenever a shared page mounts.
  const query = useQuery({
    queryKey: ["authenticated-user-role", userId],
    enabled: !!userId,
    gcTime: 0,
    queryFn: async (): Promise<AppRole> => {
      if (!userId) throw new Error("A signed-in user is required");
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as AppRole) ?? "customer";
    },
    retry: 2,
    retryDelay: (attempt) => 800 * (attempt + 1),
  });

  return {
    role: userId && !query.isError ? query.data ?? null : null,
    loading: !!userId && query.isPending,
    connectionError: !!userId && query.isError,
    retry: () => { void query.refetch(); },
  };
}
