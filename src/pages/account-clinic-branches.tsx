import { useState, type FormEvent, type ReactNode } from "react";
import { Building2, Edit2, Plus, Trash2, X } from "lucide-react";
import { Container } from "@/components/dental/Container";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { useLanguage } from "@/context/LanguageContext";
import { useStore, type AuthUser } from "@/context/StoreContext";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";

type Branch = {
  id: string;
  name: string;
  contactName: string;
  address: string;
  phone: string;
  supplyLists: number;
  orders: number;
  isDefault: boolean;
};

function getContactName(user: AuthUser | null) {
  return user?.name ?? "Dental Professional";
}

function getInitialBranches(user: AuthUser | null): Branch[] {
  if (!user?.isDemo) return [];

  return [
    {
      id: "br-1",
      name: "Main Clinic",
      contactName: getContactName(user),
      address: "Nasr City, Cairo",
      phone: user.phone ?? "",
      supplyLists: 3,
      orders: 8,
      isDefault: true,
    },
    {
      id: "br-2",
      name: "Dokki Branch",
      contactName: "Dr. Sarah Khaled",
      address: "Dokki, Giza",
      phone: "+20 111 222 3333",
      supplyLists: 1,
      orders: 2,
      isDefault: false,
    },
  ];
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/85 p-6 shadow-[0_12px_34px_rgba(5,5,5,0.04)] backdrop-blur",
        className
      )}
    >
      {children}
    </section>
  );
}

const inputClassName =
  "h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]";

function BranchFormModal({
  mode,
  form,
  contactPlaceholder,
  addressPlaceholder,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit";
  form: Partial<Branch>;
  contactPlaceholder: string;
  addressPlaceholder: string;
  onChange: (form: Partial<Branch>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLanguage();
  const title = mode === "add" ? accountT(t, "branches.addNewBranch", "Add New Branch") : accountT(t, "branches.editBranch", "Edit Branch");

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#050505]/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-form-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[700px] rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">
              {accountT(t, "branches.eyebrow", "Clinic Management")}
            </p>
            <h2 id="branch-form-title" className="font-display text-[28px] font-bold text-[#050505]">
              {title}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
              {accountT(t, "branches.formDescription", "Add or edit clinic branch details used for deliveries and supply lists.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
            aria-label={accountT(t, "branches.closeForm", "Close branch form")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "branches.branchName", "Branch Name")}</span>
            <input
              required
              value={form.name ?? ""}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder={accountValue(t, "Main Clinic")}
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "branches.contactName", "Contact Name")}</span>
            <input
              required
              value={form.contactName ?? ""}
              onChange={(e) => onChange({ ...form, contactName: e.target.value })}
              placeholder={contactPlaceholder}
              className={inputClassName}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "address.address", "Address")}</span>
            <input
              required
              value={form.address ?? ""}
              onChange={(e) => onChange({ ...form, address: e.target.value })}
              placeholder={addressPlaceholder}
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "profile.phoneNumber", "Phone Number")}</span>
            <input
              required
              value={form.phone ?? ""}
              onChange={(e) => onChange({ ...form, phone: e.target.value })}
              placeholder="+20 100 123 4567"
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "branches.defaultBranch", "Default Branch")}</span>
            <input
              type="checkbox"
              checked={!!form.isDefault}
              onChange={(e) => onChange({ ...form, isDefault: e.target.checked })}
              className="h-4 w-4 accent-[var(--xd-gold)]"
            />
          </label>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
          >
            {accountT(t, "common.cancel", "Cancel")}
          </button>
          <Button type="submit" variant="primary" size="sm" className="h-11 gap-2 px-6 text-[14px]">
            <Plus size={16} />
            {mode === "add" ? accountT(t, "branches.addBranch", "Add Branch") : accountT(t, "common.saveChanges", "Save Changes")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function DeleteBranchModal({
  branch,
  onCancel,
  onConfirm,
}: {
  branch: Branch;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#050505]/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-branch-title"
    >
      <div className="w-full max-w-[460px] rounded-[28px] border border-[#F44336]/20 bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F44336]/10 text-[#F44336]">
          <Trash2 size={20} />
        </span>
        <h2 id="delete-branch-title" className="mt-5 font-display text-[26px] font-bold text-[#050505]">
          {accountT(t, "branches.deleteTitle", "Delete Branch?")}
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
          {accountT(t, "branches.deleteDescription", "This will remove {name} from clinic branch management. Existing orders will not be changed.", { name: branch.name })}
        </p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
          >
            {accountT(t, "branches.keepBranch", "Keep Branch")}
          </button>
          <Button
            type="button"
            onClick={onConfirm}
            variant="destructive"
            size="sm"
            className="h-11 px-6 text-[14px]"
          >
            {accountT(t, "branches.deleteBranch", "Delete Branch")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AccountClinicBranches() {
  const { t } = useLanguage();
  const { currentUser } = useStore();
  const contactPlaceholder = currentUser?.name ?? accountValue(t, "Dental Professional");
  const addressPlaceholder = currentUser?.isDemo
    ? "45 El-Batal Ahmed Abdel Aziz St."
    : accountValue(t, "Clinic branch address");
  const [branches, setBranches] = useState<Branch[]>(() => getInitialBranches(currentUser));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState<Partial<Branch>>({});
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const openAddForm = () => {
    setEditingBranchId(null);
    setBranchForm({
      contactName: getContactName(currentUser),
      phone: currentUser?.phone ?? "",
      isDefault: branches.length === 0,
    });
    setStatusMessage(null);
    setIsFormOpen(true);
  };

  const openEditForm = (branch: Branch) => {
    setEditingBranchId(branch.id);
    const { id: _id, ...rest } = branch;
    setBranchForm(rest);
    setStatusMessage(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingBranchId(null);
    setBranchForm({});
  };

  const handleSaveBranch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized: Partial<Branch> = {
      name: (branchForm.name ?? "").trim(),
      contactName: (branchForm.contactName ?? "").trim(),
      address: (branchForm.address ?? "").trim(),
      phone: (branchForm.phone ?? "").trim(),
      isDefault: !!branchForm.isDefault,
    };

    if (editingBranchId) {
      setBranches((current) =>
        current.map((b) => (b.id === editingBranchId ? { ...b, ...normalized } as Branch : b))
      );
      setStatusMessage(accountT(t, "branches.messages.updated", "{name} updated.", { name: normalized.name || accountT(t, "branches.branch", "Branch") }));
    } else {
      const created: Branch = {
        id: `br-${Date.now()}`,
        name: normalized.name || accountT(t, "branches.branch", "Branch"),
        contactName: normalized.contactName || getContactName(currentUser),
        address: normalized.address || "",
        phone: normalized.phone || "",
        supplyLists: 0,
        orders: 0,
        isDefault: normalized.isDefault || branches.length === 0,
      };

      setBranches((current) =>
        created.isDefault ? [created, ...current.map((c) => ({ ...c, isDefault: false }))] : [created, ...current]
      );
      setStatusMessage(accountT(t, "branches.messages.added", "{name} added.", { name: created.name }));
    }

    closeForm();
  };

  const handleSetDefault = (branchId: string) => {
    const selectedBranch = branches.find((branch) => branch.id === branchId);
    setBranches((current) => current.map((b) => ({ ...b, isDefault: b.id === branchId })));
    setStatusMessage(accountT(t, "branches.messages.setDefault", "{name} set as default.", { name: selectedBranch?.name ?? accountT(t, "branches.branch", "Branch") }));
  };

  const handleDelete = () => {
    if (!branchToDelete) return;

    setBranches((current) => current.filter((b) => b.id !== branchToDelete.id));
    setStatusMessage(accountT(t, "branches.messages.deleted", "{name} deleted.", { name: branchToDelete.name }));
    setBranchToDelete(null);
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="min-w-0 space-y-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-active)]">
                  {accountT(t, "branches.eyebrow", "Clinic Management")}
                </p>
                <h1 className="font-display text-[36px] font-bold leading-none text-[#050505] sm:text-[44px]">
                  {accountT(t, "branches.title", "Clinic Branches")}
                </h1>
                <p className="mt-4 max-w-[720px] text-[15px] leading-6 text-[#8A8D9A]">
                  {accountT(t, "branches.description", "Manage clinic locations, delivery contacts, and branch-specific supply lists.")}
                </p>
              </div>

              <Button type="button" onClick={openAddForm} variant="primary" className="h-12 w-full gap-2 px-6 text-[14px] sm:w-auto">
                <Plus size={18} />
                {accountT(t, "branches.addNewBranch", "Add New Branch")}
              </Button>
            </div>

            {statusMessage && (
              <div
                role="status"
                className="rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]"
              >
                {statusMessage}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {branches.map((branch) => (
                <Card key={branch.id} className="flex min-h-[220px] flex-col p-7 sm:p-8">
                  <div className="mb-4 flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]">
                      <Building2 size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[20px] font-bold text-[#050505]">{accountValue(t, branch.name)}</h2>
                        {branch.isDefault && (
                          <span className="inline-flex h-7 items-center rounded-full bg-[var(--xd-gold-bg-soft)] px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--xd-gold-text)]">
                            {accountT(t, "branches.defaultBranch", "Default Branch")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-1 text-[15px] leading-6 text-[#6A6A6A]">
                    <p className="font-semibold text-[#050505]">{branch.contactName}</p>
                    <p>{branch.address}</p>
                    <p>{branch.phone}</p>
                  </div>

                  <div className="mt-6 flex flex-col gap-4 border-t border-[#050505]/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 items-center rounded-full bg-[#050505]/[0.04] px-3 text-[13px] font-semibold text-[#717182]">
                        {accountT(t, "branches.supplyListsCount", "{count} Supply Lists", { count: branch.supplyLists })}
                      </span>
                      <span className="inline-flex h-7 items-center rounded-full bg-[#050505]/[0.04] px-3 text-[13px] font-semibold text-[#717182]">
                        {accountT(t, "branches.ordersCount", "{count} Orders", { count: branch.orders })}
                      </span>
                    </div>

                    <div className="ms-auto flex items-center gap-1.5">
                      {!branch.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(branch.id)}
                          className="me-1 inline-flex h-9 items-center rounded-full px-2 text-start text-[13px] font-semibold text-[var(--xd-gold-text)] transition-colors hover:text-[var(--xd-gold-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                        >
                          {accountT(t, "branches.setAsDefault", "Set as Default")}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditForm(branch)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#717182] transition-colors hover:bg-[var(--xd-gold-bg-soft)] hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                        aria-label={accountT(t, "branches.editBranchNamed", "Edit {name}", { name: branch.name })}
                      >
                        <Edit2 size={17} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setBranchToDelete(branch)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#EF4444] transition-colors hover:bg-[#EF4444]/[0.08] hover:text-[#B42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F44336]/30"
                        aria-label={accountT(t, "branches.deleteBranchNamed", "Delete {name}", { name: branch.name })}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </main>
        </div>
      </Container>

      {isFormOpen && (
        <BranchFormModal
          mode={editingBranchId ? "edit" : "add"}
          form={branchForm}
          contactPlaceholder={contactPlaceholder}
          addressPlaceholder={addressPlaceholder}
          onChange={setBranchForm}
          onClose={closeForm}
          onSubmit={handleSaveBranch}
        />
      )}

      {branchToDelete && (
        <DeleteBranchModal
          branch={branchToDelete}
          onCancel={() => setBranchToDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
