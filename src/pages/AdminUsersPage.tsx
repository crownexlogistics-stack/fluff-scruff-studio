import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Shield, UserCheck, User } from "lucide-react";
import type { AppRole } from "@/hooks/useUserRole";

interface UserWithRole {
  user_id: string;
  email: string;
  full_name: string;
  role: AppRole;
}

const roleIcons: Record<AppRole, React.ReactNode> = {
  manager: <Shield className="h-3.5 w-3.5" />,
  groomer: <UserCheck className="h-3.5 w-3.5" />,
  customer: <User className="h-3.5 w-3.5" />,
};

const roleColors: Record<AppRole, string> = {
  manager: "bg-primary/10 text-primary border-primary/20",
  groomer: "bg-accent/10 text-accent-foreground border-accent/20",
  customer: "bg-muted text-muted-foreground border-border",
};

const AdminUsersPage = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    // Fetch roles joined with profiles
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name");

    if (rolesErr || profErr) {
      console.error(rolesErr || profErr);
      setLoading(false);
      return;
    }

    // We need emails — fetch from profiles or use a workaround
    // Since we can't query auth.users from client, we'll show what we have
    const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name || ""]));

    const merged: UserWithRole[] = (roles || []).map((r) => ({
      user_id: r.user_id,
      email: "", // will be filled if we add email to profiles
      full_name: profileMap.get(r.user_id) || "Unknown",
      role: r.role as AppRole,
    }));

    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Error updating role", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role updated" });
      fetchUsers();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading text-foreground">User Management</h1>
          <p className="text-muted-foreground font-body text-sm mt-1">Manage user roles and permissions</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Change Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}…</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${roleColors[u.role]} flex items-center gap-1 w-fit`}>
                        {roleIcons[u.role]}
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(val) => handleRoleChange(u.user_id, val as AppRole)}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="groomer">Groomer</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No users found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminUsersPage;
