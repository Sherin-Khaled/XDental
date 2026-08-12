import { Building2, Plus } from "lucide-react";
import { Link } from "wouter";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { useLanguage } from "@/context/LanguageContext";
import { accountT } from "@/lib/accountI18n";

/**
 * Clinic Branches — future-ready shell.
 *
 * Branch management has no backend persistence yet, so this page shows an
 * honest coming-soon state with disabled actions instead of fake branch
 * records and fake save/delete success.
 *
 * TODO(clinic-branches): to activate, add a ClinicBranch model
 * (userId, branchName, contactPerson, phone, address, deliveryNotes,
 * isDefault, createdAt, updatedAt) with customer CRUD endpoints, then restore
 * the manager UI (see git history of this file for the previous
 * form/list implementation).
 */
export default function AccountClinicBranches() {
  const { t } = useLanguage();

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="space-y-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-active)]">
                  {accountT(t, "branches.eyebrow", "Clinic Network")}
                </p>
                <h1 className="font-display text-[36px] font-bold leading-none text-[#050505] sm:text-[44px]">
                  {accountT(t, "branches.title", "Clinic Branches")}
                </h1>
                <p className="mt-4 max-w-[680px] text-[15px] leading-6 text-[#8A8D9A]">
                  {accountT(
                    t,
                    "branches.comingSoonDescription",
                    "Clinic branches will be available soon for clinics with multiple delivery locations."
                  )}
                </p>
              </div>

              <Button
                type="button"
                disabled
                size="sm"
                className="h-11 shrink-0 gap-2 self-start px-5 text-[13px] sm:mt-7"
                title={accountT(t, "common.comingSoon", "Coming soon")}
              >
                <Plus size={15} />
                {accountT(t, "branches.addBranchComingSoon", "Add Branch (Coming soon)")}
              </Button>
            </div>

            <section className="rounded-[24px] border border-[var(--xd-gold-active)]/[0.12] bg-white/80 p-8 text-center shadow-[0_12px_34px_rgba(5,5,5,0.04)] backdrop-blur sm:p-12">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                <Building2 size={24} />
              </span>
              <h2 className="mt-5 text-[20px] font-bold text-[#050505]">
                {accountT(t, "branches.emptyTitle", "Branch management is coming soon")}
              </h2>
              <p className="mx-auto mt-3 max-w-[520px] text-[14px] leading-6 text-[#8A8D9A]">
                {accountT(
                  t,
                  "branches.emptyBody",
                  "You will be able to save multiple clinic locations and choose one during checkout. Until then, please add branch details in the delivery notes of your order, or contact support for multi-branch deliveries."
                )}
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="sm" className="h-11 px-6 text-[14px]">
                  <Link href="/account/support">
                    {accountT(t, "featureUnavailable.contactSupport", "Contact Support")}
                  </Link>
                </Button>
              </div>
            </section>
          </main>
        </div>
      </Container>
    </div>
  );
}
