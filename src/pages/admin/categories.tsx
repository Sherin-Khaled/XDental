import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useSearch } from "wouter";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminButton, AdminGhostButton, AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import { adminCategories } from "./admin-data";

export default function AdminCategories() {
  const search = useSearch();
  const categorySearchQuery = useMemo(() => {
    return new URLSearchParams(search).get("search")?.trim() ?? "";
  }, [search]);
  const filteredCategories = useMemo(() => {
    const normalizedQuery = categorySearchQuery.toLowerCase();
    if (!normalizedQuery) return adminCategories;

    return adminCategories.filter((category) => {
      return [category.name, category.status, category.slug].some((field) =>
        field.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [categorySearchQuery]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Categories"
          description="Mock category list for future catalog administration."
          action={
            <AdminButton>
              <Plus size={16} />
              <span className="ml-2">Add Category</span>
            </AdminButton>
          }
        />

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-left text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 font-bold">Name</th>
                <th className="px-5 py-3 font-bold">Slug</th>
                <th className="px-5 py-3 font-bold">Products</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {filteredCategories.map((category) => (
                <tr key={category.id} className="hover:bg-[#FBFAF7]">
                  <td className="px-5 py-4 font-semibold text-[#050505]">{category.name}</td>
                  <td className="px-5 py-4 font-mono text-xs text-[#717182]">{category.slug}</td>
                  <td className="px-5 py-4 text-[#717182]">{category.products}</td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge tone={category.tone}>{category.status}</AdminStatusBadge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <AdminGhostButton>Edit</AdminGhostButton>
                      <AdminGhostButton>Delete</AdminGhostButton>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">
                    No categories found for this search.
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
