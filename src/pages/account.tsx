import { useLocation } from "wouter";
import { Camera, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Container } from "@/components/dental/Container";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { useStore, type AuthUser } from "@/context/StoreContext";
import { useLanguage } from "@/context/LanguageContext";
import { accountT } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";
import { formatUserDisplayName } from "@/lib/userDisplayName";

type ProfileForm = {
  firstName: string;
  lastName: string;
  professionalRole: string;
  clinicName: string;
  email: string;
  phone: string;
  whatsapp: string;
};

const fieldClassName =
  "h-14 w-full rounded-[14px] border border-[#050505]/10 bg-white/[0.55] px-4 text-[14px] font-medium text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-active)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]";

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
    clinicName: user?.clinicName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    whatsapp: user?.phone ?? "",
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
  type = "text",
  autoComplete,
  onChange,
}: {
  label: string;
  value: string;
  helper?: string;
  type?: "email" | "tel" | "text";
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-semibold text-[#050505]">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
      />
      {helper && <span className="mt-2 block text-[13px] leading-5 text-[#717182]">{helper}</span>}
    </label>
  );
}

export default function AccountDashboard() {
  const [, navigate] = useLocation();
  const { signOut, currentUser, updateCurrentUser } = useStore();
  const { t, language } = useLanguage();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<ProfileForm>(() => buildProfileFromUser(currentUser));
  const [draftProfile, setDraftProfile] = useState<ProfileForm>(() => buildProfileFromUser(currentUser));
  const [profilePhotoName, setProfilePhotoName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  useEffect(() => {
    const nextProfile = buildProfileFromUser(currentUser);
    setProfile(nextProfile);
    setDraftProfile(nextProfile);
  }, [currentUser?.id]);

  const handleSignOut = async () => {
    setStatusMessage(null);
    await signOut();
    navigate("/signin");
  };

  const updateDraftProfile = (key: keyof ProfileForm, value: string) => {
    setDraftProfile((current) => ({
      ...current,
      [key]: value,
    }));
    setStatusMessage(null);
  };

  const cancelChanges = () => {
    setDraftProfile(profile);
    setStatusMessage(accountT(t, "profile.messages.changesDiscarded", "Changes discarded."));
  };

  const saveChanges = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const savedProfile: ProfileForm = {
      firstName: draftProfile.firstName.trim(),
      lastName: draftProfile.lastName.trim(),
      professionalRole: draftProfile.professionalRole.trim(),
      clinicName: draftProfile.clinicName.trim(),
      email: draftProfile.email.trim(),
      phone: draftProfile.phone.trim(),
      whatsapp: draftProfile.whatsapp.trim(),
    };
    const savedName = `${savedProfile.firstName} ${savedProfile.lastName}`.trim();

    setProfile(savedProfile);
    setDraftProfile(savedProfile);
    updateCurrentUser({
      name: savedName || "Dental Professional",
      professionalRole: savedProfile.professionalRole || "Dental Professional",
      clinicName: savedProfile.clinicName,
      email: savedProfile.email,
      phone: savedProfile.phone,
    });
    setStatusMessage(accountT(t, "profile.messages.profileSaved", "Profile changes saved."));
  };

  const handlePhotoSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProfilePhotoName(file.name);
    setStatusMessage(accountT(t, "profile.messages.photoSelected", "Profile photo \"{fileName}\" selected.", { fileName: file.name }));
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
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-soft)] text-[22px] font-bold text-[var(--xd-gold-active)]">
                    {initials || "XD"}
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
                    {profilePhotoName && (
                      <p className="mt-1 text-[12px] font-semibold text-[var(--xd-gold-text)]">
                        {accountT(t, "profile.selectedPhoto", "Selected photo: {fileName}", { fileName: profilePhotoName })}
                      </p>
                    )}
                  </div>
                </div>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoSelected}
                  className="sr-only"
                  aria-label={accountT(t, "profile.chooseProfilePhoto", "Choose profile photo")}
                />
                <Button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  variant="secondary"
                  size="sm"
                  className="h-12 gap-2 rounded-full px-5 text-[13px] text-[var(--xd-gold-text)]"
                >
                  <Camera size={15} />
                  {accountT(t, "profile.changePhoto", "Change Photo")}
                </Button>
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
                  <TextField
                    label={accountT(t, "profile.clinicName", "Clinic Name")}
                    value={draftProfile.clinicName}
                    autoComplete="organization"
                    onChange={(value) => updateDraftProfile("clinicName", value)}
                  />
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
                    helper={accountT(t, "profile.verifiedEmail", "Verified account email.")}
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
                    helper={accountT(t, "profile.whatsappHelper", "Used only for order and delivery support when needed.")}
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
                  className="h-12 rounded-full bg-[var(--xd-gold)] px-6 text-[14px] font-semibold text-[#050505]"
                >
                  {accountT(t, "common.saveChanges", "Save Changes")}
                </Button>
              </div>
            </form>
          </main>
        </div>
      </Container>
    </div>
  );
}
