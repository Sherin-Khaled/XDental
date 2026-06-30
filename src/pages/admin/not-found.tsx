import { Link } from "wouter";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader } from "./_components/admin-ui";

export default function AdminNotFound() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Admin Page Not Found"
          description="The admin route you opened does not exist in this scaffold."
        />
        <Link
          href="/admin"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] shadow-sm transition hover:bg-[#D4A72C]"
        >
          Back to Overview
        </Link>
      </div>
    </AdminLayout>
  );
}
