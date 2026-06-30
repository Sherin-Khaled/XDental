import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useSearch } from "wouter";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminButton, AdminGhostButton, AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import { adminBrands } from "./admin-data";

export default function AdminBrands() {
  const search = useSearch();
  const brandSearchQuery = useMemo(() => {
    return new URLSearchParams(search).get("search")?.trim() ?? "";
  }, [search]);
  const filteredBrands = useMemo(() => {
    const normalizedQuery = brandSearchQuery.toLowerCase();
    if (!normalizedQuery) return adminBrands;

    return adminBrands.filter((brand) => {
      return [brand.name, brand.status, brand.country, brand.featured].some((field) =>
        field.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [brandSearchQuery]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Brands"
          description="Mock brand administration table with placeholder controls."
          action={
            <AdminButton>
              <Plus size={16} />
              <span className="ml-2">Add Brand</span>
            </AdminButton>
          }
        />

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-left text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 font-bold">Brand</th>
                <th className="px-5 py-3 font-bold">Country</th>
                <th className="px-5 py-3 font-bold">Products</th>
                <th className="px-5 py-3 font-bold">Featured</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {filteredBrands.map((brand) => (
                <tr key={brand.id} className="hover:bg-[#FBFAF7]">
                  <td className="px-5 py-4 font-semibold text-[#050505]">{brand.name}</td>
                  <td className="px-5 py-4 text-[#717182]">{brand.country}</td>
                  <td className="px-5 py-4 text-[#717182]">{brand.products}</td>
                  <td className="px-5 py-4 text-[#717182]">{brand.featured}</td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge tone={brand.tone}>{brand.status}</AdminStatusBadge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <AdminGhostButton>Edit</AdminGhostButton>
                      <AdminGhostButton>Delete</AdminGhostButton>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBrands.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">
                    No brands found for this search.
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
