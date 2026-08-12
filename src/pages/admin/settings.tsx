import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader } from "./_components/admin-ui";
import { OwnerSystemSyncPanel } from "./_components/OwnerSystemSyncPanel";
import { EmailOperationsPanel } from "./_components/EmailOperationsPanel";

export default function AdminSettings() {
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const isAdmin = currentUser?.role?.trim().toLowerCase() === "admin";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title={t("admin.ownerSync.settingsTitle")}
          description={t("admin.ownerSync.settingsDescription")}
        />
        <OwnerSystemSyncPanel isAdmin={isAdmin} />
        {isAdmin && <EmailOperationsPanel />}
      </div>
    </AdminLayout>
  );
}
