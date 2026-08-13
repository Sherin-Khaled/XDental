import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Edit2, MapPin, Plus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/dental/Button";
import { DentalSelect } from "@/components/dental/Select";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { accountT } from "@/lib/accountI18n";
import { ApiError } from "@/services/http";
import {
  createMyClinicLocation,
  deleteMyClinicLocation,
  getActiveDeliveryZones,
  getMyClinicLocations,
  updateMyClinicLocation,
  type ClinicLocation,
  type DeliveryZone,
  type SavedClinicLocationInput,
} from "@/services/delivery";

type FormState = SavedClinicLocationInput;

const emptyForm: FormState = {
  label: "",
  addressLine: "",
  governorate: "Cairo",
  cityArea: "",
  buildingNumber: "",
  apartmentFloor: "",
  postalCode: "",
  deliveryZoneId: "",
  customArea: "",
  isDefault: false,
};

const inputClassName =
  "h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]";

export function SavedClinicLocationsManager({ addressBook = false }: { addressBook?: boolean }) {
  const { t, language } = useLanguage();
  const { currentUser, updateCurrentUser } = useStore();
  const [locations, setLocations] = useState<ClinicLocation[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [locationToDelete, setLocationToDelete] = useState<ClinicLocation | null>(null);

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === form.deliveryZoneId),
    [form.deliveryZoneId, zones]
  );

  const refresh = async (signal?: AbortSignal) => {
    const [nextLocations, activeZones] = await Promise.all([
      getMyClinicLocations(signal),
      getActiveDeliveryZones(signal),
    ]);
    setLocations(nextLocations);
    setZones(activeZones);
    updateCurrentUser({ clinicLocations: nextLocations });
  };

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    refresh(controller.signal)
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setLoadError(accountT(t, "profile.clinicLocationsLoadError", "Saved locations could not be loaded. Please try again."));
        }
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [currentUser?.id]);

  const openAdd = () => {
    setEditingId("new");
    setForm({ ...emptyForm, isDefault: locations.length === 0 });
    setStatusMessage(null);
  };

  const openEdit = (location: ClinicLocation) => {
    setEditingId(location.id);
    setForm({
      label: location.label ?? "",
      addressLine: location.addressLine ?? "",
      governorate: location.governorate ?? "Cairo",
      cityArea: location.cityArea ?? "",
      buildingNumber: location.buildingNumber ?? "",
      apartmentFloor: location.apartmentFloor ?? "",
      postalCode: location.postalCode ?? "",
      deliveryZoneId: location.deliveryZoneId,
      customArea: location.customArea ?? "",
      isDefault: location.isDefault,
    });
    setStatusMessage(null);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    const input: SavedClinicLocationInput = {
      label: form.label.trim(),
      addressLine: form.addressLine.trim(),
      governorate: form.governorate?.trim(),
      cityArea: form.cityArea?.trim(),
      buildingNumber: form.buildingNumber?.trim(),
      apartmentFloor: form.apartmentFloor?.trim(),
      postalCode: form.postalCode?.trim(),
      deliveryZoneId: form.deliveryZoneId,
      customArea: selectedZone?.slug === "other" ? form.customArea?.trim() : null,
      isDefault: form.isDefault,
    };
    try {
      if (editingId === "new") await createMyClinicLocation(input);
      else if (editingId) await updateMyClinicLocation(editingId, input);
      await refresh();
      setStatusMessage(
        editingId === "new"
          ? accountT(t, "address.messages.added", "{name} address added.", { name: input.label })
          : accountT(t, "address.messages.updated", "{name} address updated.", { name: input.label })
      );
      closeForm();
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : accountT(t, "profile.messages.profileSaveFailed", "The location could not be saved. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!locationToDelete) return;
    setIsSaving(true);
    try {
      await deleteMyClinicLocation(locationToDelete.id);
      await refresh();
      setStatusMessage(accountT(t, "address.messages.deleted", "{name} address deleted.", { name: locationToDelete.label || locationToDelete.deliveryZone.nameEn }));
      setLocationToDelete(null);
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : accountT(t, "address.deleteFailed", "The location could not be deleted."));
    } finally {
      setIsSaving(false);
    }
  };

  const zoneName = (location: ClinicLocation) =>
    location.customArea || (language === "ar" ? location.deliveryZone.nameAr : location.deliveryZone.nameEn);

  return (
    <main className="min-w-0 space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-active)]">
            {accountT(t, addressBook ? "address.eyebrow" : "branches.eyebrow", addressBook ? "Delivery Details" : "Clinic Management")}
          </p>
          <h1 className="font-display text-[36px] font-bold leading-none text-[#050505] sm:text-[44px]">
            {accountT(t, addressBook ? "address.title" : "branches.title", addressBook ? "Address Book" : "Clinic Locations")}
          </h1>
          <p className="mt-4 max-w-[700px] text-[15px] leading-6 text-[#8A8D9A]">
            {accountT(t, addressBook ? "address.description" : "branches.description", "Manage saved clinic delivery locations and their verified delivery areas.")}
          </p>
        </div>
        <Button type="button" onClick={openAdd} className="h-11 shrink-0 gap-2 self-start px-5 text-[13px] sm:mt-7">
          <Plus size={15} />
          {accountT(t, addressBook ? "address.addNewAddress" : "branches.addNewBranch", addressBook ? "Add Address" : "Add Clinic Location")}
        </Button>
      </div>

      {statusMessage && <div role="status" className="rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]">{statusMessage}</div>}
      {loadError && <div role="alert" className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{loadError}</div>}

      {isLoading ? (
        <section className="rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/80 p-10 text-center text-[14px] text-[#717182]">{accountT(t, "common.loading", "Loading...")}</section>
      ) : locations.length === 0 ? (
        <section className="rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/80 p-10 text-center">
          <MapPin className="mx-auto text-[var(--xd-gold-active)]" />
          <h2 className="mt-4 text-[20px] font-bold text-[#050505]">{accountT(t, "address.emptyTitle", "No saved addresses yet")}</h2>
          <p className="mt-2 text-[14px] text-[#717182]">{accountT(t, "address.emptyBody", "Add a clinic delivery location to reuse it in Profile and checkout.")}</p>
        </section>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {locations.map((location) => (
            <section key={location.id} className="rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/85 p-6 shadow-[0_12px_34px_rgba(5,5,5,0.04)]">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]"><MapPin size={19} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[18px] font-bold text-[#050505]">{location.label || zoneName(location)}</h2>
                    {location.isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--xd-gold-bg-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--xd-gold-text)]"><Star size={11} />{accountT(t, "address.default", "Default")}</span>}
                  </div>
                  <p className="mt-2 text-[14px] leading-6 text-[#5F5F5F]">{location.addressLine || accountT(t, "address.addressDetailsMissing", "Add the full street address")}</p>
                  <p className="mt-1 text-[13px] text-[#8A8D9A]">{[location.cityArea, location.governorate, zoneName(location)].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2 border-t border-[#050505]/[0.07] pt-4">
                <button type="button" onClick={() => openEdit(location)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#717182] hover:bg-[var(--xd-gold-bg-soft)]" aria-label={`Edit ${location.label || zoneName(location)}`}><Edit2 size={16} /></button>
                <button type="button" onClick={() => setLocationToDelete(location)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50" aria-label={`Delete ${location.label || zoneName(location)}`}><Trash2 size={16} /></button>
              </div>
            </section>
          ))}
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#050505]/40 px-4 py-8" role="dialog" aria-modal="true" aria-labelledby="saved-location-form-title">
          <form onSubmit={save} className="w-full max-w-[650px] rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <h2 id="saved-location-form-title" className="font-display text-[28px] font-bold text-[#050505]">{accountT(t, editingId === "new" ? "address.addLocationTitle" : "address.editLocationTitle", editingId === "new" ? "Add Saved Location" : "Edit Saved Location")}</h2>
              <button type="button" onClick={closeForm} aria-label={accountT(t, "address.closeForm", "Close location form")} className="p-2 text-[#717182]"><X size={18} /></button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-2 block text-[13px] font-bold">{accountT(t, "address.addressLabel", "Location Label")}</span><input required minLength={2} maxLength={80} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder={accountT(t, "address.labelPlaceholder", "Main Clinic")} className={inputClassName} /></label>
              <label className="block"><span className="mb-2 block text-[13px] font-bold">{accountT(t, "address.deliveryArea", "Delivery Area")}</span><DentalSelect label={accountT(t, "address.deliveryArea", "Delivery Area")} value={form.deliveryZoneId} onChange={(deliveryZoneId) => setForm({ ...form, deliveryZoneId, customArea: "" })} placeholder={accountT(t, "address.selectDeliveryArea", "Select delivery area")} options={zones.map((zone) => ({ value: zone.id, label: language === "ar" ? zone.nameAr : zone.nameEn }))} /></label>
              {selectedZone?.slug === "other" && <label className="block sm:col-span-2"><span className="mb-2 block text-[13px] font-bold">{accountT(t, "profile.clinicLocationsOtherLabel", "Area")}</span><input required minLength={2} maxLength={100} value={form.customArea ?? ""} onChange={(event) => setForm({ ...form, customArea: event.target.value })} className={inputClassName} /></label>}
              <label className="block sm:col-span-2"><span className="mb-2 block text-[13px] font-bold">{accountT(t, "address.streetAddress", "Full Address")}</span><input required minLength={5} maxLength={300} value={form.addressLine} onChange={(event) => setForm({ ...form, addressLine: event.target.value })} placeholder={accountT(t, "address.streetPlaceholder", "Street, building, floor, clinic")} className={inputClassName} /></label>
              <label className="block"><span className="mb-2 block text-[13px] font-bold">{accountT(t, "address.governorate", "Governorate")}</span><input required maxLength={100} value={form.governorate ?? ""} onChange={(event) => setForm({ ...form, governorate: event.target.value })} className={inputClassName} /></label>
              <label className="block"><span className="mb-2 block text-[13px] font-bold">{accountT(t, "address.city", "City / Area")}</span><input required maxLength={100} value={form.cityArea ?? ""} onChange={(event) => setForm({ ...form, cityArea: event.target.value })} className={inputClassName} /></label>
              <label className="block"><span className="mb-2 block text-[13px] font-bold">{accountT(t, "address.building", "Building")}</span><input required maxLength={100} value={form.buildingNumber ?? ""} onChange={(event) => setForm({ ...form, buildingNumber: event.target.value })} className={inputClassName} /></label>
              <label className="block"><span className="mb-2 block text-[13px] font-bold">{accountT(t, "address.floorApartment", "Floor / Apartment")}</span><input required maxLength={100} value={form.apartmentFloor ?? ""} onChange={(event) => setForm({ ...form, apartmentFloor: event.target.value })} className={inputClassName} /></label>
              <label className="block sm:col-span-2"><span className="mb-2 block text-[13px] font-bold">{accountT(t, "address.postalCode", "Postal Code (optional)")}</span><input maxLength={100} value={form.postalCode ?? ""} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} className={inputClassName} /></label>
            </div>
            <label className="mt-5 flex items-center gap-3 rounded-[14px] bg-[var(--xd-gold-bg-soft)] px-4 py-3"><input type="checkbox" checked={Boolean(form.isDefault)} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} /><span className="text-[13px] font-bold">{accountT(t, "address.makeDefault", "Make this the default delivery address")}</span></label>
            <div className="mt-7 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={closeForm}>{accountT(t, "address.cancel", "Cancel")}</Button><Button type="submit" disabled={isSaving || !form.deliveryZoneId}>{isSaving ? accountT(t, "common.saving", "Saving...") : accountT(t, "common.saveChanges", "Save Changes")}</Button></div>
          </form>
        </div>
      )}

      {locationToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#050505]/40 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-[460px] rounded-[28px] bg-white p-7 shadow-2xl"><h2 className="text-[24px] font-bold">{accountT(t, "address.deleteTitle", "Delete Address?")}</h2><p className="mt-3 text-[14px] text-[#717182]">{accountT(t, "address.deletePersistedDescription", "Existing orders will not be changed. If this is the default, the oldest remaining location becomes default.")}</p><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setLocationToDelete(null)}>{accountT(t, "address.cancel", "Cancel")}</Button><Button variant="destructive" disabled={isSaving} onClick={remove}>{accountT(t, "address.deleteAddress", "Delete Address")}</Button></div></div>
        </div>
      )}
    </main>
  );
}
