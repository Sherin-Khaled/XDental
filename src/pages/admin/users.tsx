import { useMemo } from "react";
import { useSearch } from "wouter";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import { adminUsers } from "./admin-data";

export default function AdminUsers() {
  const search = useSearch();
  const userSearchQuery = useMemo(() => {
    return new URLSearchParams(search).get("search")?.trim() ?? "";
  }, [search]);
  const filteredUsers = useMemo(() => {
    const normalizedQuery = userSearchQuery.toLowerCase();
    if (!normalizedQuery) return adminUsers;

    return adminUsers.filter((user) => {
      return [user.name, user.email, user.status, user.role, user.id].some((field) =>
        field.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [userSearchQuery]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Users"
          description="Mock user administration view. Authentication, roles, and real permissions are intentionally not connected."
        />

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-left text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 font-bold">User</th>
                <th className="px-5 py-3 font-bold">Role</th>
                <th className="px-5 py-3 font-bold">Email</th>
                <th className="px-5 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-[#FBFAF7]">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-[#050505]">{user.name}</p>
                    <p className="mt-1 font-mono text-xs text-[#717182]">{user.id}</p>
                  </td>
                  <td className="px-5 py-4 text-[#717182]">{user.role}</td>
                  <td className="px-5 py-4 text-[#717182]">{user.email}</td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge tone={user.tone}>{user.status}</AdminStatusBadge>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">
                    No users found for this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </div>
    </AdminLayout>
  );
}
