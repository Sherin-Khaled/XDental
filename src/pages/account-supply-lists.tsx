import { useEffect, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ClipboardList, MoreVertical, Package, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { DentalSelect, type DentalSelectOption } from "@/components/dental/Select";
import { useStore } from "@/context/StoreContext";
import { useLanguage } from "@/context/LanguageContext";
import { fetchPublicProductsByIds } from "@/services/catalog";
import type { SupplyList } from "@/data/supplyLists";
import {
  createSupplyList,
  deleteSupplyList,
  duplicateSupplyList,
  fetchSupplyLists,
} from "@/services/supplyLists";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/use-click-outside";

type SupplyListForm = {
  name: string;
  branch: string;
  description: string;
};

const inputClassName =
  "h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";

const emptyListForm: SupplyListForm = {
  name: "",
  branch: "Main Clinic",
  description: "",
};

function useModalCloseBehavior(onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);
}

function closeOnOverlayPointerDown(event: PointerEvent<HTMLDivElement>, onClose: () => void) {
  if (event.target === event.currentTarget) {
    onClose();
  }
}

function formatCurrency(value: number) {
  return `EGP ${value.toLocaleString("en-US")}`;
}

function updatedLabel(days: number, t: ReturnType<typeof useLanguage>["t"]) {
  if (days <= 0) return accountT(t, "supplyLists.updatedToday", "Updated today");
  if (days === 1) return accountT(t, "supplyLists.updatedOneDay", "Updated 1d ago");
  return accountT(t, "supplyLists.updatedDays", "Updated {days}d ago", { days });
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[26px] border border-[var(--xd-gold-active)]/[0.20] bg-white/70 shadow-[0_12px_32px_rgba(5,5,5,0.05)] transition-colors hover:border-[var(--xd-gold-active)]/[0.45] backdrop-blur",
        className
      )}
    >
      {children}
    </section>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DentalSelectOption[];
}) {
  const { t } = useLanguage();

  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#050505]">{label}</span>
      <DentalSelect
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        triggerClassName="rounded-[12px]"
      />
    </label>
  );
}

function BranchPill({ branch }: { branch: string }) {
  const { t } = useLanguage();

  return (
    <span className="inline-flex rounded-[8px] bg-[#2196F3]/10 px-2.5 py-1 text-[11px] font-bold text-[#2196F3]">
      {accountValue(t, branch)}
    </span>
  );
}

function ProductPreviewTile({ image, label }: { image?: string; label: string }) {
  const [hasImageError, setHasImageError] = useState(false);

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold)]/[0.06]">
      {image && !hasImageError ? (
        <img
          src={image}
          alt={label}
          width={2525}
          height={2582}
          loading="lazy"
          decoding="async"
          onError={() => setHasImageError(true)}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <Package size={18} strokeWidth={1.8} className="text-[var(--xd-gold-hover)]" />
      )}
    </span>
  );
}

function ProductPreview({ list }: { list: SupplyList }) {
  const visibleSlotCount = Math.min(2, list.productCount || list.detailItems.length);
  const hasOverflow = list.productCount > visibleSlotCount;

  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: visibleSlotCount }).map((_, index) => {
        const detailItem = list.detailItems[index];

        return (
          <ProductPreviewTile
            key={detailItem?.id ?? `preview-${index}`}
            image={detailItem?.image}
            label={detailItem?.name ?? "Supply list product"}
          />
        );
      })}
      {hasOverflow && (
        <span className="flex h-11 min-w-11 items-center justify-center rounded-[11px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-2 text-[12px] font-bold text-[var(--xd-gold-text)]">
          +1
        </span>
      )}
    </div>
  );
}

function SupplyListCard({
  list,
  isMenuOpen,
  onToggleMenu,
  onView,
  onAddAll,
  onDuplicate,
  onDelete,
}: {
  list: SupplyList;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onView: () => void;
  onAddAll: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, onToggleMenu, {
    enabled: isMenuOpen,
    onEscapeKey: onToggleMenu,
  });

  return (
    <Card className={cn("relative p-5 sm:p-6", isMenuOpen && "z-40")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
            <ClipboardList size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-bold text-[#050505]">{accountValue(t, list.name)}</h2>
            <div className="mt-1">
              <BranchPill branch={list.branch} />
            </div>
          </div>
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={onToggleMenu}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
            aria-label={accountT(t, "supplyLists.openActionsFor", "Open actions for {name}", { name: list.name })}
            aria-expanded={isMenuOpen}
          >
            <MoreVertical size={17} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-white shadow-[0_18px_44px_rgba(5,5,5,0.12)]">
              {[
                [accountT(t, "supplyLists.menu.viewDetails", "View details"), onView],
                [accountT(t, "supplyLists.menu.duplicateList", "Duplicate list"), onDuplicate],
              ].map(([label, action]) => (
                <button
                  key={label as string}
                  type="button"
                  onClick={action as () => void}
                  className="block w-full px-4 py-3 text-left text-[13px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--xd-gold-border)]"
                >
                  {label as string}
                </button>
              ))}
              <button
                type="button"
                onClick={onDelete}
                className="block w-full px-4 py-3 text-left text-[13px] font-bold text-[#F44336] transition-colors hover:text-[#B42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F44336]/30"
              >
                {accountT(t, "supplyLists.menu.deleteList", "Delete list")}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 min-h-[42px] text-[14px] leading-6 text-[#8A8D9A]">
        {accountValue(t, list.description)}
      </p>

      <div className="mt-4">
        <ProductPreview list={list} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] font-bold">
        <span className="text-[#050505]">
          {list.productCount} <span className="text-[#8A8D9A]">{accountT(t, "common.products", "products")}</span>
        </span>
        <span className="text-[var(--xd-gold-active)]">{formatCurrency(list.estimatedTotal)}</span>
        <span className="text-[#8A8D9A]">{updatedLabel(list.updatedDaysAgo, t)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onView}
          variant="primary"
          size="sm"
          className="h-10 px-5 text-[13px]"
        >
          {accountT(t, "supplyLists.viewList", "View List")}
        </Button>
        <Button
          type="button"
          onClick={onAddAll}
          variant="secondary"
          size="sm"
          className="h-10 gap-1 px-5 text-[13px] text-[var(--xd-gold-active)]"
        >
          <ShoppingCart size={15} />
          {accountT(t, "wishlist.addAllToCart", "Add All to Cart")}
        </Button>
      </div>
    </Card>
  );
}

function CreateSupplyListCard({ onCreate }: { onCreate: () => void }) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={onCreate}
      className="flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-[var(--xd-gold-border-soft)] bg-white/30 p-8 text-center text-[#717182] transition-all hover:-translate-y-0.5 hover:border-[var(--xd-gold-active)]/60 hover:bg-[var(--xd-gold)]/[0.06] hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-hover)]">
        <Plus size={34} strokeWidth={1.8} />
      </span>
      <span className="text-[18px] font-bold text-[#050505]">{accountT(t, "supplyLists.createNewSupplyList", "Create New Supply List")}</span>
      <span className="mt-3 max-w-[360px] text-[14px] leading-6 text-[#8A8D9A]">
        {accountT(t, "supplyLists.createNewSupplyListDescription", "Build a reusable list for monthly orders, repeat items, or branch needs.")}
      </span>
      <span className="xd-gradient-gold mt-6 inline-flex h-11 items-center justify-center rounded-full px-[22px] text-[13px] font-bold text-[#050505]">
        {accountT(t, "supplyLists.createList", "Create List")}
      </span>
    </button>
  );
}

function CreateListModal({
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  form: SupplyListForm;
  onChange: (form: SupplyListForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLanguage();
  useModalCloseBehavior(onClose);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#050505]/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-supply-list-title"
      onPointerDown={(event) => closeOnOverlayPointerDown(event, onClose)}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[600px] rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">
              {accountT(t, "supplyLists.eyebrow", "Supply Lists")}
            </p>
            <h2 id="create-supply-list-title" className="font-display text-[28px] font-bold text-[#050505]">
              {accountT(t, "supplyLists.createNewList", "Create New List")}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
              {accountT(t, "supplyLists.createNewListDescription", "Set up a reusable list for repeat clinic purchasing.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
            aria-label={accountT(t, "supplyLists.closeCreateListForm", "Close create list form")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "supplyLists.listName", "List Name")}</span>
            <input
              required
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              placeholder={accountValue(t, "Monthly Clinic Essentials")}
              className={inputClassName}
            />
          </label>
          <FieldSelect
            label={accountT(t, "common.branch", "Branch")}
            value={form.branch}
            onChange={(value) => onChange({ ...form, branch: value })}
            options={[
              { value: "Main Clinic", label: accountValue(t, "Main Clinic") },
              { value: "General", label: accountValue(t, "General") },
              { value: "Nasr City Branch", label: accountValue(t, "Nasr City Branch") },
              { value: "Dokki Branch", label: accountValue(t, "Dokki Branch") },
            ]}
          />
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "common.description", "Description")}</span>
            <textarea
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              placeholder={accountValue(t, "Reusable supplies for everyday clinic operations.")}
              className="min-h-[112px] w-full resize-none rounded-[14px] border border-[#050505]/10 bg-white px-4 py-3 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
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
          <Button type="submit" variant="primary" size="sm" className="h-11 gap-1 px-6 text-[14px]">
            <Plus size={16} />
            {accountT(t, "supplyLists.createList", "Create List")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function DeleteListModal({
  list,
  onCancel,
  onConfirm,
}: {
  list: SupplyList;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  useModalCloseBehavior(onCancel);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#050505]/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-supply-list-title"
      onPointerDown={(event) => closeOnOverlayPointerDown(event, onCancel)}
    >
      <div className="w-full max-w-[460px] rounded-[28px] border border-[#F44336]/20 bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F44336]/10 text-[#F44336]">
          <Trash2 size={20} />
        </span>
        <h2 id="delete-supply-list-title" className="mt-5 font-display text-[26px] font-bold text-[#050505]">
          {accountT(t, "supplyLists.deleteTitle", "Delete Supply List?")}
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
          {accountT(t, "supplyLists.deleteDescription", "This removes {name} from saved lists. Products in your cart will not be affected.", { name: list.name })}
        </p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
          >
            {accountT(t, "supplyLists.keepList", "Keep List")}
          </button>
          <Button type="button" onClick={onConfirm} variant="destructive" size="sm" className="h-11 px-6 text-[14px]">
            {accountT(t, "supplyLists.deleteList", "Delete List")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AccountSupplyLists() {
  const { addToCart } = useStore();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [lists, setLists] = useState<SupplyList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [listForm, setListForm] = useState<SupplyListForm>(emptyListForm);
  const [listToDelete, setListToDelete] = useState<SupplyList | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [createdListAction, setCreatedListAction] = useState<SupplyList | null>(null);
  const displayedLists = lists.filter((list) => list.status !== "Archived");

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    void fetchSupplyLists(controller.signal)
      .then((records) => {
        setLists(records);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatusMessage(
            accountT(
              t,
              "supplyLists.messages.unableToLoad",
              "Unable to load your supply lists."
            )
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [t]);

  const openCreateModal = () => {
    setStatusMessage(null);
    setCreatedListAction(null);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setListForm(emptyListForm);
  };

  const handleCreateList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isMutating) return;
    setIsMutating(true);
    setStatusMessage(null);
    try {
      const createdList = await createSupplyList({
        name: listForm.name,
        branch: listForm.branch,
        description:
          listForm.description.trim() ||
          accountT(
            t,
            "supplyLists.emptyListDescription",
            "Empty list ready for products."
          ),
      });
      setLists((current) => [createdList, ...current]);
      closeCreateModal();
      setCreatedListAction(createdList);
      setStatusMessage(
        accountT(t, "supplyLists.messages.created", "{name} created.", {
          name: createdList.name,
        })
      );
    } catch {
      setStatusMessage(
        accountT(
          t,
          "supplyLists.detail.messages.unableToSave",
          "Unable to save this list."
        )
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleAddAllToCart = async (list: SupplyList) => {
    const products = await fetchPublicProductsByIds(list.items.map((item) => item.productId));
    const productsById = new Map(products.map((product) => [product.id, product]));
    let addedCount = 0;

    list.items.forEach((item) => {
      const product = productsById.get(item.productId);
      if (!product || product.stockStatus === "Out of Stock") return;
      const result = addToCart(
        product,
        item.quantity,
        item.selectedOption ?? product.options?.[0]
      );
      if (result.ok) addedCount += item.quantity;
    });

    setOpenMenuId(null);
    setCreatedListAction(null);
    setStatusMessage(accountT(t, "supplyLists.messages.addedToCart", "{count} products from {name} added to cart.", { count: addedCount, name: list.name }));
  };

  const handleDuplicateList = async (list: SupplyList) => {
    if (isMutating) return;
    setIsMutating(true);
    setOpenMenuId(null);
    try {
      const duplicate = await duplicateSupplyList(
        list.id,
        accountT(t, "supplyLists.copyName", "{name} Copy", {
          name: list.name,
        })
      );
      setLists((current) => [duplicate, ...current]);
      setCreatedListAction(null);
      setStatusMessage(
        accountT(t, "supplyLists.messages.created", "{name} created.", {
          name: duplicate.name,
        })
      );
    } catch {
      setStatusMessage(
        accountT(
          t,
          "supplyLists.detail.messages.unableToSave",
          "Unable to save this list."
        )
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteList = async () => {
    if (!listToDelete || isMutating) return;
    const deleting = listToDelete;
    setIsMutating(true);
    try {
      await deleteSupplyList(deleting.id);
      setLists((current) =>
        current.filter((list) => list.id !== deleting.id)
      );
      setStatusMessage(
        accountT(t, "supplyLists.messages.deleted", "{name} deleted.", {
          name: deleting.name,
        })
      );
      setCreatedListAction(null);
      setOpenMenuId(null);
      setListToDelete(null);
    } catch {
      setStatusMessage(
        accountT(
          t,
          "supplyLists.detail.messages.unableToSave",
          "Unable to save this list."
        )
      );
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="min-w-0 space-y-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="font-display text-[38px] font-bold leading-none text-[#050505] sm:text-[48px]">
                  {accountT(t, "supplyLists.title", "My Supply Lists")}
                </h1>
                <p className="mt-4 max-w-[760px] text-[15px] leading-6 text-[#6A6A6A]">
                  {accountT(t, "supplyLists.description", "Create reusable lists for clinic essentials, repeat orders, and frequently purchased dental supplies.")}
                </p>
              </div>

              <Button
                type="button"
                onClick={openCreateModal}
                variant="primary"
                className="h-12 w-full gap-1 px-6 text-[14px] sm:w-auto"
              >
                <Plus size={17} />
                {accountT(t, "supplyLists.createNewList", "Create New List")}
              </Button>
            </div>

            {statusMessage && (
              <div
                role="status"
                className="flex flex-col gap-3 rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F] sm:flex-row sm:items-center sm:justify-between"
              >
                <span>{statusMessage}</span>
                {createdListAction && (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="primary" size="sm" className="h-9 px-4 text-[12px]">
                      <Link href={`/account/supply-lists/${createdListAction.id}`}>
                        {accountT(t, "supplyLists.addProductsNow", "Add products now")}
                      </Link>
                    </Button>
                    <Button asChild variant="secondary" size="sm" className="h-9 px-4 text-[12px] text-[#050505]">
                      <Link href={`/account/supply-lists/${createdListAction.id}`}>
                        {accountT(t, "supplyLists.viewList", "View List")}
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {isLoading ? (
                <Card className="p-10 text-center md:col-span-2">
                  <p className="text-[14px] font-semibold text-[#8A8D9A]">
                    {accountT(t, "common.loading", "Loading...")}
                  </p>
                </Card>
              ) : displayedLists.length > 0 ? (
                <>
                  {displayedLists.map((list) => (
                    <SupplyListCard
                      key={list.id}
                      list={list}
                      isMenuOpen={openMenuId === list.id}
                      onToggleMenu={() =>
                        setOpenMenuId((current) => (current === list.id ? null : list.id))
                      }
                      onView={() => {
                        navigate(`/account/supply-lists/${list.id}`);
                        setOpenMenuId(null);
                      }}
                      onAddAll={() => void handleAddAllToCart(list)}
                      onDuplicate={() => void handleDuplicateList(list)}
                      onDelete={() => {
                        setListToDelete(list);
                        setOpenMenuId(null);
                      }}
                    />
                  ))}
                  <CreateSupplyListCard onCreate={openCreateModal} />
                </>
              ) : (
                <Card className="p-10 text-center md:col-span-2">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                    <ClipboardList size={24} />
                  </span>
                  <h2 className="mt-4 text-[18px] font-bold text-[#050505]">{accountT(t, "supplyLists.emptyTitle", "No supply lists found")}</h2>
                  <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-6 text-[#8A8D9A]">
                    {accountT(t, "supplyLists.emptyDescription", "Create a reusable list for clinic ordering.")}
                  </p>
                </Card>
              )}
            </div>
          </main>
        </div>
      </Container>

      {isCreateModalOpen && (
        <CreateListModal
          form={listForm}
          onChange={setListForm}
          onClose={closeCreateModal}
          onSubmit={handleCreateList}
        />
      )}

      {listToDelete && (
        <DeleteListModal
          list={listToDelete}
          onCancel={() => setListToDelete(null)}
          onConfirm={() => void handleDeleteList()}
        />
      )}
    </div>
  );
}
