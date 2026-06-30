import { useState, type FormEvent, type ReactNode } from "react";
import { Edit2, MapPin, Plus, Trash2, X } from "lucide-react";
import { Container } from "@/components/dental/Container";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { useLanguage } from "@/context/LanguageContext";
import { useStore, type AuthUser } from "@/context/StoreContext";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";

type Address = {
  id: string;
  name: string;
  contactName: string;
  line1: string;
  city: string;
  governorate: string;
  country: string;
  phone: string;
  isDefault: boolean;
};

type AddressForm = Omit<Address, "id">;

const inputClassName =
  "h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]";

function getContactName(user: AuthUser | null) {
  return user?.name ?? "Dental Professional";
}

function getInitialAddresses(user: AuthUser | null): Address[] {
  if (!user?.isDemo || !user.addresses?.length) return [];

  return user.addresses.map((address) => ({
    ...address,
    contactName: getContactName(user),
  }));
}

function getEmptyAddressForm(user: AuthUser | null): AddressForm {
  return {
    name: "",
    contactName: getContactName(user),
    line1: "",
    city: "",
    governorate: "",
    country: "Egypt",
    phone: user?.phone ?? "",
    isDefault: false,
  };
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

function AddressFormModal({
  mode,
  form,
  contactPlaceholder,
  addressPlaceholder,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit";
  form: AddressForm;
  contactPlaceholder: string;
  addressPlaceholder: string;
  onChange: (form: AddressForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLanguage();
  const title = mode === "add" ? accountT(t, "address.addNewAddress", "Add New Address") : accountT(t, "address.editAddress", "Edit Address");

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#050505]/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="address-form-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[620px] rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">
              {accountT(t, "address.title", "Address Book")}
            </p>
            <h2 id="address-form-title" className="font-display text-[28px] font-bold text-[#050505]">
              {title}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
              {accountT(t, "address.formDescription", "Keep delivery details accurate for clinic orders and supply requests.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
            aria-label={accountT(t, "address.closeForm", "Close address form")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "address.addressLabel", "Address Label")}</span>
            <input
              required
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              placeholder={accountValue(t, "Clinic")}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "branches.contactName", "Contact Name")}</span>
            <input
              required
              value={form.contactName}
              onChange={(event) => onChange({ ...form, contactName: event.target.value })}
              placeholder={contactPlaceholder}
              className={inputClassName}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "address.streetAddress", "Street Address")}</span>
            <input
              required
              value={form.line1}
              onChange={(event) => onChange({ ...form, line1: event.target.value })}
              placeholder={addressPlaceholder}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "address.city", "City")}</span>
            <input
              required
              value={form.city}
              onChange={(event) => onChange({ ...form, city: event.target.value })}
              placeholder={accountValue(t, "Mohandeseen")}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "address.governorate", "Governorate")}</span>
            <input
              required
              value={form.governorate}
              onChange={(event) => onChange({ ...form, governorate: event.target.value })}
              placeholder={accountValue(t, "Giza")}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "address.country", "Country")}</span>
            <input
              required
              value={form.country}
              onChange={(event) => onChange({ ...form, country: event.target.value })}
              placeholder={accountValue(t, "Egypt")}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "profile.phoneNumber", "Phone Number")}</span>
            <input
              required
              value={form.phone}
              onChange={(event) => onChange({ ...form, phone: event.target.value })}
              placeholder="+20 100 123 4567"
              className={inputClassName}
            />
          </label>
        </div>

        <label className="mt-5 flex items-center gap-3 rounded-[14px] border border-[var(--xd-gold-active)]/15 bg-[var(--xd-gold)]/[0.06] px-4 py-3">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) => onChange({ ...form, isDefault: event.target.checked })}
            className="h-4 w-4 accent-[var(--xd-gold)]"
          />
          <span className="text-[13px] font-bold text-[#050505]">{accountT(t, "address.makeDefault", "Make this the default delivery address")}</span>
        </label>

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
            {mode === "add" ? accountT(t, "address.addAddress", "Add Address") : accountT(t, "common.saveChanges", "Save Changes")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function DeleteAddressModal({
  address,
  onCancel,
  onConfirm,
}: {
  address: Address;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#050505]/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-address-title"
    >
      <div className="w-full max-w-[460px] rounded-[28px] border border-[#F44336]/20 bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F44336]/10 text-[#F44336]">
          <Trash2 size={20} />
        </span>
        <h2 id="delete-address-title" className="mt-5 font-display text-[26px] font-bold text-[#050505]">
          {accountT(t, "address.deleteTitle", "Delete Address?")}
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
          {accountT(t, "address.deleteDescription", "This will remove {name} from your address book. Existing orders will not be changed.", { name: address.name })}
        </p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
          >
            {accountT(t, "address.keepAddress", "Keep Address")}
          </button>
          <Button
            type="button"
            onClick={onConfirm}
            variant="destructive"
            size="sm"
            className="h-11 px-6 text-[14px]"
          >
            {accountT(t, "address.deleteAddress", "Delete Address")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AccountAddress() {
  const { t } = useLanguage();
  const { currentUser } = useStore();
  const contactPlaceholder = currentUser?.name ?? accountValue(t, "Dental Professional");
  const addressPlaceholder = currentUser?.isDemo
    ? "45 El-Batal Ahmed Abdel Aziz St."
    : accountValue(t, "Clinic street address");
  const [addresses, setAddresses] = useState<Address[]>(() => getInitialAddresses(currentUser));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<AddressForm>(() => getEmptyAddressForm(currentUser));
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const openAddForm = () => {
    setEditingAddressId(null);
    setAddressForm({
      ...getEmptyAddressForm(currentUser),
      isDefault: addresses.length === 0,
    });
    setStatusMessage(null);
    setIsFormOpen(true);
  };

  const openEditForm = (address: Address) => {
    const { id: _id, ...form } = address;
    setEditingAddressId(address.id);
    setAddressForm(form);
    setStatusMessage(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingAddressId(null);
    setAddressForm(getEmptyAddressForm(currentUser));
  };

  const handleSaveAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedForm: AddressForm = {
      ...addressForm,
      name: addressForm.name.trim(),
      contactName: addressForm.contactName.trim(),
      line1: addressForm.line1.trim(),
      city: addressForm.city.trim(),
      governorate: addressForm.governorate.trim(),
      country: addressForm.country.trim(),
      phone: addressForm.phone.trim(),
    };

    if (editingAddressId) {
      setAddresses((current) =>
        current.map((address) => {
          if (address.id === editingAddressId) {
            return { id: address.id, ...normalizedForm };
          }

          return normalizedForm.isDefault ? { ...address, isDefault: false } : address;
        })
      );
      setStatusMessage(accountT(t, "address.messages.updated", "{name} address updated.", { name: normalizedForm.name }));
    } else {
      const createdAddress: Address = {
        id: `addr-${Date.now()}`,
        ...normalizedForm,
        isDefault: normalizedForm.isDefault || addresses.length === 0,
      };

      setAddresses((current) => [
        createdAddress,
        ...current.map((address) =>
          createdAddress.isDefault ? { ...address, isDefault: false } : address
        ),
      ]);
      setStatusMessage(accountT(t, "address.messages.added", "{name} address added.", { name: createdAddress.name }));
    }

    closeForm();
  };

  const handleSetDefault = (addressId: string) => {
    const selectedAddress = addresses.find((address) => address.id === addressId);

    setAddresses((current) =>
      current.map((address) => ({
        ...address,
        isDefault: address.id === addressId,
      }))
    );
    setStatusMessage(accountT(t, "address.messages.setDefault", "{name} set as default.", { name: selectedAddress?.name ?? accountT(t, "address.address", "Address") }));
  };

  const handleDeleteAddress = () => {
    if (!addressToDelete) return;

    setAddresses((current) => {
      const remaining = current.filter((address) => address.id !== addressToDelete.id);

      if (addressToDelete.isDefault && remaining.length > 0) {
        return remaining.map((address, index) => ({
          ...address,
          isDefault: index === 0,
        }));
      }

      return remaining;
    });
    setStatusMessage(accountT(t, "address.messages.deleted", "{name} address deleted.", { name: addressToDelete.name }));
    setAddressToDelete(null);
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
                  {accountT(t, "address.eyebrow", "Delivery Details")}
                </p>
                <h1 className="font-display text-[36px] font-bold leading-none text-[#050505] sm:text-[44px]">
                  {accountT(t, "address.title", "Address Book")}
                </h1>
                <p className="mt-4 max-w-[720px] text-[15px] leading-6 text-[#8A8D9A]">
                  {accountT(t, "address.description", "Manage delivery locations for clinic orders, quotes, and product requests.")}
                </p>
              </div>

              <Button
                type="button"
                onClick={openAddForm}
                variant="primary"
                className="h-12 w-full gap-2 px-6 text-[14px] sm:w-auto"
              >
                <Plus size={18} />
                {accountT(t, "address.addNew", "Add New")}
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
              {addresses.map((address) => (
                <Card key={address.id} className="min-h-[260px]">
                  {address.isDefault && (
                    <div className="absolute right-0 top-0 rounded-bl-[16px] bg-[var(--xd-gold)] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#3A2600]">
                      {accountT(t, "address.default", "Default")}
                    </div>
                  )}

                    <div className="mb-5 flex items-center gap-4 pr-20">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]">
                      <MapPin size={20} />
                    </span>
                    <h2 className="text-[22px] font-bold text-[#050505]">{accountValue(t, address.name)}</h2>
                  </div>

                  <div className="min-h-[104px] space-y-1 text-[15px] leading-6 text-[#6A6A6A]">
                    <p className="font-semibold text-[#050505]">{address.contactName}</p>
                    <p>{address.line1}</p>
                    <p>
                      {address.city}, {address.governorate}
                    </p>
                    <p>{address.phone}</p>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#050505]/[0.07] pt-5">
                    {address.isDefault ? (
                      <span className="text-[13px] font-bold text-[#8A8D9A]">{accountT(t, "address.primaryDeliveryAddress", "Primary delivery address")}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(address.id)}
                        className="text-left text-[14px] font-bold text-[var(--xd-gold-text)] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                      >
                        {accountT(t, "branches.setAsDefault", "Set as Default")}
                      </button>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(address)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                        aria-label={accountT(t, "address.editNamed", "Edit {name} address", { name: address.name })}
                      >
                        <Edit2 size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddressToDelete(address)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#F44336] transition-colors hover:text-[#B42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F44336]/30"
                        aria-label={accountT(t, "address.deleteNamed", "Delete {name} address", { name: address.name })}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}

              <button
                type="button"
                onClick={openAddForm}
                className="flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-[var(--xd-gold-border-soft)] bg-white/30 p-6 text-[#717182] transition-colors hover:border-[var(--xd-gold-active)]/60 hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
              >
                <Plus size={34} className="mb-4" />
                <span className="text-[18px] font-bold">{accountT(t, "address.addNewAddress", "Add New Address")}</span>
              </button>
            </div>
          </main>
        </div>
      </Container>

      {isFormOpen && (
        <AddressFormModal
          mode={editingAddressId ? "edit" : "add"}
          form={addressForm}
          contactPlaceholder={contactPlaceholder}
          addressPlaceholder={addressPlaceholder}
          onChange={setAddressForm}
          onClose={closeForm}
          onSubmit={handleSaveAddress}
        />
      )}

      {addressToDelete && (
        <DeleteAddressModal
          address={addressToDelete}
          onCancel={() => setAddressToDelete(null)}
          onConfirm={handleDeleteAddress}
        />
      )}
    </div>
  );
}
