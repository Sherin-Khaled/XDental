import { useMemo } from "react";
import { useSearch } from "wouter";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import { adminQuotes } from "./admin-data";

export default function AdminQuotes() {
  const search = useSearch();
  const quoteSearchQuery = useMemo(() => {
    return new URLSearchParams(search).get("search")?.trim() ?? "";
  }, [search]);
  const filteredQuotes = useMemo(() => {
    const normalizedQuery = quoteSearchQuery.toLowerCase();
    if (!normalizedQuery) return adminQuotes;

    return adminQuotes.filter((quote) => {
      return [quote.id, quote.status, quote.clinic, quote.owner].some((field) =>
        field.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [quoteSearchQuery]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Quotes"
          description="Mock quote queue prepared for future supplier and sales workflows."
        />

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-left text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 font-bold">Quote</th>
                <th className="px-5 py-3 font-bold">Clinic</th>
                <th className="px-5 py-3 font-bold">Products</th>
                <th className="px-5 py-3 font-bold">Owner</th>
                <th className="px-5 py-3 font-bold">Date</th>
                <th className="px-5 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {filteredQuotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-[#FBFAF7]">
                  <td className="px-5 py-4 font-semibold text-[#050505]">{quote.id}</td>
                  <td className="px-5 py-4 text-[#717182]">{quote.clinic}</td>
                  <td className="px-5 py-4 text-[#717182]">{quote.products}</td>
                  <td className="px-5 py-4 text-[#717182]">{quote.owner}</td>
                  <td className="px-5 py-4 text-[#717182]">{quote.date}</td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge tone={quote.tone}>{quote.status}</AdminStatusBadge>
                  </td>
                </tr>
              ))}
              {filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">
                    No quotes found for this search.
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
