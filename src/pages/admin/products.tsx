import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useSearch } from "wouter";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminButton, AdminGhostButton, AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import { adminProducts } from "./admin-data";

export default function AdminProducts() {
  const search = useSearch();
  const productSearchQuery = useMemo(() => {
    return new URLSearchParams(search).get("search")?.trim() ?? "";
  }, [search]);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = productSearchQuery.toLowerCase();
    if (!normalizedQuery) return adminProducts;

    return adminProducts.filter((product) => {
      const searchableFields = [
        product.name,
        product.sku,
        product.category,
        product.brand,
        product.status,
      ];

      return searchableFields.some((field) => field.toLowerCase().includes(normalizedQuery));
    });
  }, [productSearchQuery]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Products"
          description="Mock product management table. Add, edit, and delete controls are placeholders only."
          action={
            <AdminButton>
              <Plus size={16} />
              <span className="ml-2">Add Product</span>
            </AdminButton>
          }
        />

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-left text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 font-bold">SKU</th>
                <th className="px-5 py-3 font-bold">Product</th>
                <th className="px-5 py-3 font-bold">Brand</th>
                <th className="px-5 py-3 font-bold">Category</th>
                <th className="px-5 py-3 font-bold">Price</th>
                <th className="px-5 py-3 font-bold">Stock</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-[#FBFAF7]">
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-[#717182]">{product.sku}</td>
                  <td className="min-w-48 px-5 py-4 font-semibold text-[#050505]">{product.name}</td>
                  <td className="px-5 py-4 text-[#717182]">{product.brand}</td>
                  <td className="px-5 py-4 text-[#717182]">{product.category}</td>
                  <td className="whitespace-nowrap px-5 py-4 font-semibold text-[#050505]">{product.price}</td>
                  <td className="px-5 py-4 text-[#717182]">{product.stock}</td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge tone={product.tone}>{product.status}</AdminStatusBadge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <AdminGhostButton>Edit</AdminGhostButton>
                      <AdminGhostButton>Delete</AdminGhostButton>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">
                    No products found for this search.
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
