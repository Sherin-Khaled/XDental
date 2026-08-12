import { useLocation } from "wouter";
import { Camera, CheckCircle2, ChevronDown } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Container } from "@/components/dental/Container";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { DeliveryZoneMultiSelect } from "@/components/dental/DeliveryZoneMultiSelect";
import { useStore, type AuthUser } from "@/context/StoreContext";
import { useLanguage } from "@/context/LanguageContext";
import { accountT } from "@/lib/accountI18n";
import {
  AuthApiError,
  resolveAuthAssetUrl,
  updateProfile,
  uploadProfileImage,
} from "@/services/auth";
import {
  getActiveDeliveryZones,
  type ClinicLocationInput,
  type DeliveryZone,
} from "@/services/delivery";
import {
  CLINIC_SPECIALTIES,
  DEFAULT_CLINIC_SPECIALTY,
  normalizeClinicSpecialty,
} from "@/lib/clinicSpecialties";
import { cn } from "@/lib/utils";
import { formatUserDisplayName } from "@/lib/userDisplayName";

type ProfileForm = {
  firstName: string;
  lastName: string;
  professionalRole: string;
  clinicSpecialty: string;
  clinicName: string;
  email: string;
  phone: string;
  whatsapp: string;
  clinicLocations: ClinicLocationInput[];
};

const fieldClassName =
  "h-14 w-full rounded-[14px] border border-[#050505]/10 bg-white/[0.55] px-4 text-[14px] font-medium text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-active)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]";
const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function splitDisplayName(name?: string) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function buildProfileFromUser(user: AuthUser | null): ProfileForm {
  const { firstName, lastName } = splitDisplayName(user?.name);

  return {
    firstName,
    lastName,
    professionalRole: user?.professionalRole ?? "Dental Professional",
    clinicSpecialty: normalizeClinicSpecialty(user?.clinicSpecialty ?? DEFAULT_CLINIC_SPECIALTY),
    clinicName: user?.clinicName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    whatsapp: user?.phone ?? "",
    clinicLocations:
      user?.clinicLocations?.map((location) => ({
        deliveryZoneId: location.deliveryZoneId,
        customArea: location.customArea,
      })) ?? [],
  };
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-7 shadow-[0_12px_34px_rgba(5,5,5,0.04)] backdrop-blur sm:p-8">
      <div className="mb-6">
        <h2 className="font-display text-[22px] font-bold leading-tight text-[#050505]">
          {title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-5 text-[#717182]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  helper,
  placeholder,
  maxLength,
  type = "text",
  autoComplete,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  helper?: string;
  placeholder?: string;
  maxLength?: number;
  type?: "email" | "tel" | "text";
  autoComplete?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-semibold text-[#050505]">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldClassName, disabled && "cursor-not-allowed bg-[#F5F4EF] text-[#9A9A9A]")}
      />
      {helper && <span className="mt-2 block text-[13px] leading-5 text-[#717182]">{helper}</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-semibold text-[#050505]">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldClassName} appearance-none pr-10`}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#9A9A9A]" size={16} />
      </span>
    </label>
  );
}

export default function AccountDashboard() {
  const [, navigate] = useLocation();
  const { signOut, currentUser, updateCurrentUser } = useStore();
  const { t, language } = useLanguage();
  const [profile, setProfile] = useState<ProfileForm>(() => buildProfileFromUser(currentUser));
  const [draftProfile, setDraftProfile] = useState<ProfileForm>(() => buildProfileFromUser(currentUser));
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const clinicLocationsRef = useRef<HTMLDivElement | null>(null);

  const fullName = `${draftProfile.firstName} ${draftProfile.lastName}`.trim();
  const profileDisplayName = formatUserDisplayName(
    { name: fullName, role: currentUser?.role },
    language
  );
  const initials =
    fullName
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "XD";
  const displayedProfileImage =
    photoPreviewUrl ??
    resolveAuthAssetUrl(currentUser?.profileImageUrl) ??
    null;

  useEffect(() => {
    const nextProfile = buildProfileFromUser(currentUser);
    setProfile(nextProfile);
    setDraftProfile(nextProfile);
  }, [currentUser?.id]);

  useEffect(() => {
    const scrollToClinicLocations = () => {
      if (window.location.hash !== "#clinic-locations") return;
      window.requestAnimationFrame(() => {
        clinicLocationsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        clinicLocationsRef.current
          ?.querySelector<HTMLElement>("button, input")
          ?.focus({ preventScroll: true });
      });
    };

    scrollToClinicLocations();
    window.addEventListener("hashchange", scrollToClinicLocations);
    return () =>
      window.removeEventListener("hashchange", scrollToClinicLocations);
  }, []);

  useEffect(
    () => () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    },
    [photoPreviewUrl]
  );

  useEffect(() => {
    const controller = new AbortController();

    getActiveDeliveryZones(controller.signal)
      .then((activeZones) => {
        const currentZones =
          currentUser?.clinicLocations
            ?.map((location) => location.deliveryZone)
            .filter(Boolean) ?? [];
        const mergedZones = new Map(
          [...activeZones, ...currentZones].map((zone) => [zone.id, zone])
        );
        setDeliveryZones(
          Array.from(mergedZones.values()).sort(
            (left, right) =>
              left.displayOrder - right.displayOrder ||
              left.nameEn.localeCompare(right.nameEn)
          )
        );
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setLocationError(
            accountT(
              t,
              "profile.clinicLocationsLoadError",
              "Delivery areas could not be loaded. Please try again."
            )
          );
        }
      });

    return () => controller.abort();
  }, [currentUser?.id, t]);

  const handleSignOut = async () => {
    setStatusMessage(null);
    await signOut();
    navigate("/signin");
  };

  const updateDraftProfile = (
    key: Exclude<keyof ProfileForm, "clinicLocations">,
    value: string
  ) => {
    setDraftProfile((current) => ({
      ...current,
      [key]: value,
    }));
    setStatusMessage(null);
  };

  const cancelChanges = () => {
    setDraftProfile(profile);
    setLocationError(null);
    setStatusMessage(accountT(t, "profile.messages.changesDiscarded", "Changes discarded."));
  };

  const handlePhotoSelection = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isUploadingPhoto) return;

    if (!PROFILE_IMAGE_TYPES.has(file.type)) {
      setPhotoMessage({
        text: accountT(
          t,
          "profile.photoInvalidType",
          "Choose a JPEG, PNG, or WebP image."
        ),
        error: true,
      });
      return;
    }

    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      setPhotoMessage({
        text: accountT(
          t,
          "profile.photoTooLarge",
          "Profile images must be 5 MB or smaller."
        ),
        error: true,
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(previewUrl);
    setPhotoMessage(null);
    setIsUploadingPhoto(true);

    try {
      const savedUser = await uploadProfileImage(file);
      updateCurrentUser({
        profileImageUrl: savedUser.profileImageUrl ?? undefined,
      });
      setPhotoPreviewUrl(null);
      setPhotoMessage({
        text: accountT(
          t,
          "profile.photoUploadSuccess",
          "Profile photo updated successfully."
        ),
        error: false,
      });
    } catch (uploadError) {
      setPhotoPreviewUrl(null);
      const fallbackMessage = accountT(
        t,
        "profile.photoUploadFailed",
        "Profile photo could not be uploaded. Please try again."
      );
      let uploadMessage = fallbackMessage;
      if (uploadError instanceof AuthApiError) {
        if (uploadError.status === 413) {
          uploadMessage = accountT(
            t,
            "profile.photoTooLarge",
            "Profile images must be 5 MB or smaller."
          );
        } else if (uploadError.status === 415) {
          uploadMessage = accountT(
            t,
            "profile.photoInvalidType",
            "Choose a JPEG, PNG, or WebP image."
          );
        } else if (uploadError.status === 400) {
          uploadMessage = accountT(
            t,
            "profile.photoInvalidFile",
            "The selected file does not contain a valid image."
          );
        }
      }
      setPhotoMessage({
        text: uploadMessage,
        error: true,
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Persists the profile via PATCH /api/auth/me; the local user state is only
  // updated after the backend confirms the save. Email changes are not
  // supported from this page (the field is read-only for the first launch).
  const saveChanges = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const savedName = `${draftProfile.firstName.trim()} ${draftProfile.lastName.trim()}`.trim();
    if (savedName.length < 2) {
      setStatusMessage(accountT(t, "profile.messages.nameRequired", "Please enter your name."));
      return;
    }

    const clinicName = draftProfile.clinicName.trim();
    if (draftProfile.clinicName.length > 0 && clinicName.length === 0) {
      setStatusMessage(
        accountT(
          t,
          "profile.messages.clinicNameWhitespace",
          "Clinic name cannot contain only spaces."
        )
      );
      return;
    }
    if (clinicName.length > 120) {
      setStatusMessage(
        accountT(
          t,
          "profile.messages.clinicNameTooLong",
          "Clinic name must be 120 characters or fewer."
        )
      );
      return;
    }

    const otherZone = deliveryZones.find((zone) => zone.slug === "other");
    const otherLocation = otherZone
      ? draftProfile.clinicLocations.find(
          (location) => location.deliveryZoneId === otherZone.id
        )
      : undefined;
    if (
      otherLocation &&
      (otherLocation.customArea?.trim().length ?? 0) < 2
    ) {
      setLocationError(
        accountT(
          t,
          "profile.clinicLocationsOtherRequired",
          "Enter the clinic area for Other."
        )
      );
      return;
    }
    if (
      profile.clinicLocations.length > 0 &&
      draftProfile.clinicLocations.length === 0
    ) {
      setLocationError(
        accountT(
          t,
          "profile.clinicLocationsRequired",
          "Select at least one clinic location."
        )
      );
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setLocationError(null);
    try {
      const savedUser = await updateProfile({
        name: savedName,
        phone: draftProfile.phone.trim(),
        professionalRole: draftProfile.professionalRole.trim(),
        clinicSpecialty: normalizeClinicSpecialty(draftProfile.clinicSpecialty),
        clinicName,
        ...(draftProfile.clinicLocations.length > 0
          ? {
              clinicLocations: draftProfile.clinicLocations.map((location) => ({
                deliveryZoneId: location.deliveryZoneId,
                customArea: location.customArea?.trim() || undefined,
              })),
            }
          : {}),
      });

      updateCurrentUser({
        name: savedUser.name,
        professionalRole: savedUser.professionalRole ?? undefined,
        clinicSpecialty: savedUser.clinicSpecialty,
        clinicName: savedUser.clinicName ?? undefined,
        phone: savedUser.phone ?? undefined,
        clinicLocations: savedUser.clinicLocations,
      });
      const savedProfile: ProfileForm = {
        ...draftProfile,
        ...splitDisplayName(savedUser.name),
        professionalRole: savedUser.professionalRole ?? "",
        clinicSpecialty: normalizeClinicSpecialty(savedUser.clinicSpecialty),
        clinicName: savedUser.clinicName ?? "",
        phone: savedUser.phone ?? "",
        clinicLocations: savedUser.clinicLocations.map((location) => ({
          deliveryZoneId: location.deliveryZoneId,
          customArea: location.customArea,
        })),
      };
      setProfile(savedProfile);
      setDraftProfile(savedProfile);
      setStatusMessage(accountT(t, "profile.messages.profileSaved", "Profile changes saved."));
    } catch (saveError) {
      setStatusMessage(
        saveError instanceof AuthApiError && saveError.status !== 0
          ? saveError.message
          : accountT(t, "profile.messages.profileSaveFailed", "Profile changes could not be saved. Please try again.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar onLogout={handleSignOut} />

          <main className="min-w-0 space-y-8">
            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-active)]">
                {accountT(t, "profile.eyebrow", "ACCOUNT DETAILS")}
              </p>
              <h1 className="font-display text-[36px] font-bold leading-none text-[#050505] sm:text-[44px]">
                {accountT(t, "profile.title", "Profile Settings")}
              </h1>
              <p className="mt-4 max-w-[720px] text-[15px] leading-6 text-[#717182]">
                {accountT(t, "profile.description", "Update your personal details and contact information.")}
              </p>
            </div>

            {statusMessage && (
              <div
                role="status"
                className="rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]"
              >
                {statusMessage}
              </div>
            )}

            <section className="rounded-[26px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-7 shadow-[0_12px_34px_rgba(5,5,5,0.04)] backdrop-blur sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-soft)] text-[22px] font-bold text-[var(--xd-gold-active)]">
                    {displayedProfileImage ? (
                      <img
                        src={displayedProfileImage}
                        alt={accountT(
                          t,
                          "profile.photoAlt",
                          "Profile photo"
                        )}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials || "XD"
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-[19px] font-bold text-[#050505]">{profileDisplayName}</h2>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#16803C]/10 px-2.5 py-1 text-[11px] font-bold text-[#16803C]">
                        <CheckCircle2 size={12} />
                        {accountT(t, "profile.verifiedAccount", "Verified Account")}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] font-medium text-[#717182]">
                      {draftProfile.professionalRole}
                    </p>
                    <p className="mt-1 break-words text-[13px] text-[#717182]">{draftProfile.email}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handlePhotoSelection}
                    data-testid="profile-photo-input"
                  />
                  <Button
                    type="button"
                    disabled={isUploadingPhoto}
                    variant="secondary"
                    size="sm"
                    onClick={() => photoInputRef.current?.click()}
                    className="h-12 gap-2 rounded-full px-5 text-[13px] text-[var(--xd-gold-text)]"
                    data-testid="profile-photo-button"
                  >
                    <Camera size={15} />
                    {isUploadingPhoto
                      ? accountT(
                          t,
                          "profile.uploadingPhoto",
                          "Uploading..."
                        )
                      : accountT(t, "profile.changePhoto", "Change Photo")}
                  </Button>
                  {photoMessage && (
                    <p
                      role={photoMessage.error ? "alert" : "status"}
                      className={cn(
                        "mt-2 max-w-[240px] text-[12px] font-medium",
                        photoMessage.error
                          ? "text-[#9B6B18]"
                          : "text-[#16803C]"
                      )}
                    >
                      {photoMessage.text}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <form onSubmit={saveChanges} className="space-y-8">
              <SectionCard
                title={accountT(t, "profile.personalInformation", "Personal Information")}
                subtitle={accountT(t, "profile.personalInformationDescription", "Keep your name, role, and clinic details up to date.")}
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <TextField
                    label={accountT(t, "profile.firstName", "First Name")}
                    value={draftProfile.firstName}
                    autoComplete="given-name"
                    onChange={(value) => updateDraftProfile("firstName", value)}
                  />
                  <TextField
                    label={accountT(t, "profile.lastName", "Last Name")}
                    value={draftProfile.lastName}
                    autoComplete="family-name"
                    onChange={(value) => updateDraftProfile("lastName", value)}
                  />
                  <TextField
                    label={accountT(t, "profile.professionalRole", "Professional Role")}
                    value={draftProfile.professionalRole}
                    onChange={(value) => updateDraftProfile("professionalRole", value)}
                  />
                  <SelectField
                    label={accountT(t, "profile.clinicSpecialty", "Clinic Specialty")}
                    value={draftProfile.clinicSpecialty}
                    options={CLINIC_SPECIALTIES}
                    onChange={(value) => updateDraftProfile("clinicSpecialty", value)}
                  />
                  <TextField
                    label={accountT(t, "profile.clinicName", "Clinic Name")}
                    value={draftProfile.clinicName}
                    autoComplete="organization"
                    placeholder={accountT(
                      t,
                      "profile.clinicNamePlaceholder",
                      "Enter your clinic name"
                    )}
                    maxLength={120}
                    onChange={(value) => updateDraftProfile("clinicName", value)}
                  />
                  <div
                    id="clinic-locations"
                    ref={clinicLocationsRef}
                    className="scroll-mt-28 space-y-2 md:col-span-2"
                  >
                    <DeliveryZoneMultiSelect
                      zones={deliveryZones}
                      value={draftProfile.clinicLocations}
                      onChange={(clinicLocations) => {
                        setDraftProfile((current) => ({
                          ...current,
                          clinicLocations,
                        }));
                        setLocationError(null);
                        setStatusMessage(null);
                      }}
                      label={accountT(
                        t,
                        "profile.clinicLocations",
                        "Clinic locations"
                      )}
                      placeholder={accountT(
                        t,
                        "profile.clinicLocationsPlaceholder",
                        "Select your clinic locations"
                      )}
                      addAnotherPlaceholder={accountT(
                        t,
                        "profile.clinicLocationsAddAnother",
                        "Add another location"
                      )}
                      searchPlaceholder={accountT(
                        t,
                        "profile.clinicLocationsSearch",
                        "Search delivery areas"
                      )}
                      emptyText={accountT(
                        t,
                        "profile.clinicLocationsEmpty",
                        "No delivery areas found."
                      )}
                      otherPlaceholder={accountT(
                        t,
                        "profile.clinicLocationsOtherPlaceholder",
                        "Enter your clinic area"
                      )}
                      otherLabel={accountT(
                        t,
                        "profile.clinicLocationsOtherLabel",
                        "Other location name"
                      )}
                      error={locationError ?? undefined}
                      disabled={isSaving}
                      inputClassName="min-h-14 rounded-[14px] bg-white/[0.55] px-3"
                      testId="profile-clinic-locations"
                    />
                    <p className="text-[13px] leading-5 text-[#717182]">
                      {accountT(
                        t,
                        "profile.clinicLocationsDescription",
                        "We use these locations only to show delivery offers that apply to your clinic."
                      )}
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title={accountT(t, "profile.contactInformation", "Contact Information")}
                subtitle={accountT(t, "profile.contactInformationDescription", "Use reachable contact details for order confirmation, quotes, and delivery support.")}
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <TextField
                    label={accountT(t, "profile.emailAddress", "Email Address")}
                    type="email"
                    value={draftProfile.email}
                    autoComplete="email"
                    disabled
                    helper={accountT(t, "profile.emailReadOnly", "To change your account email, please contact support.")}
                    onChange={(value) => updateDraftProfile("email", value)}
                  />
                  <TextField
                    label={accountT(t, "profile.phoneNumber", "Phone Number")}
                    type="tel"
                    value={draftProfile.phone}
                    autoComplete="tel"
                    onChange={(value) => updateDraftProfile("phone", value)}
                  />
                  <TextField
                    label={accountT(t, "profile.whatsappNumber", "WhatsApp Number")}
                    type="tel"
                    value={draftProfile.whatsapp}
                    autoComplete="tel"
                    disabled
                    helper={accountT(t, "profile.fieldComingSoon", "Saving this field will be available soon.")}
                    onChange={(value) => updateDraftProfile("whatsapp", value)}
                  />
                </div>
              </SectionCard>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  onClick={cancelChanges}
                  variant="secondary"
                  size="sm"
                  className={cn(
                    "h-12 rounded-full border border-[#050505]/10 bg-white/[0.55] px-6 text-[14px] font-semibold text-[#050505]",
                    "hover:bg-white/80"
                  )}
                >
                  {accountT(t, "common.cancel", "Cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSaving}
                  className="h-12 rounded-full px-6 text-[14px] font-semibold"
                >
                  {isSaving
                    ? accountT(t, "common.saving", "Saving...")
                    : accountT(t, "common.saveChanges", "Save Changes")}
                </Button>
              </div>
            </form>
          </main>
        </div>
      </Container>
    </div>
  );
}
