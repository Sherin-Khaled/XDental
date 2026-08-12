import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { DeliveryZoneMultiSelect } from "@/components/dental/DeliveryZoneMultiSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/context/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { CLINIC_SPECIALTIES } from "@/lib/clinicSpecialties";
import { cn } from "@/lib/utils";
import {
  getActiveDeliveryZones,
  type ClinicLocationInput,
  type DeliveryZone,
} from "@/services/delivery";

const inputClassName =
  "h-12 min-w-0 w-full rounded-[12px] border border-[#050505]/10 bg-white/80 px-11 text-[14px] text-[#050505] outline-none transition placeholder:text-[#9A9A9A] focus:border-[var(--xd-gold-active)]/70 focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]";

const meshMotionStyles = `
  @keyframes authMeshFloatA {
    0% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(130px, 145px, 0) scale(1.16); }
    100% { transform: translate3d(230px, 320px, 0) scale(1.04); }
  }

  @keyframes authMeshFloatB {
    0% { transform: translate3d(35px, 115px, 0) scale(1.08); }
    50% { transform: translate3d(-130px, -35px, 0) scale(1.18); }
    100% { transform: translate3d(-275px, -185px, 0) scale(0.96); }
  }

  @keyframes authMeshFloatC {
    0% { transform: translate3d(160px, 28px, 0) scale(1.08); }
    50% { transform: translate3d(20px, -190px, 0) scale(1.18); }
    100% { transform: translate3d(-95px, -360px, 0) scale(0.98); }
  }

  .auth-mesh-float-a {
    animation: authMeshFloatA 8.5s ease-in-out -2s infinite alternate;
    will-change: transform;
  }

  .auth-mesh-float-b {
    animation: authMeshFloatB 9.5s ease-in-out -4.2s infinite alternate;
    will-change: transform;
  }

  .auth-mesh-float-c {
    animation: authMeshFloatC 7.5s ease-in-out -3s infinite alternate;
    will-change: transform;
  }

  @media (prefers-reduced-motion: reduce) {
    .auth-mesh-float-a,
    .auth-mesh-float-b,
    .auth-mesh-float-c {
      animation: none;
      transform: none;
      will-change: auto;
    }
  }
`;

export default function Signup() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    clinicSpecialty: "",
    clinicLocations: [] as ClinicLocationInput[],
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [clinicSpecialtyError, setClinicSpecialtyError] = useState(false);
  const [clinicLocationsError, setClinicLocationsError] = useState<string | undefined>();
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [deliveryZonesLoadError, setDeliveryZonesLoadError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const clinicSpecialtyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { toast } = useToast();
  const { signUp } = useStore();
  const [, navigate] = useLocation();

  useEffect(() => {
    const controller = new AbortController();
    getActiveDeliveryZones(controller.signal)
      .then((zones) => {
        setDeliveryZones(zones);
        setDeliveryZonesLoadError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDeliveryZonesLoadError(true);
      });
    return () => controller.abort();
  }, []);

  const updateField = (
    field: Exclude<keyof typeof formData, "clinicLocations">,
    value: string
  ) => {
    if (field === "clinicSpecialty") {
      setClinicSpecialtyError(false);
    }
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const updateClinicLocations = (clinicLocations: ClinicLocationInput[]) => {
    setFormData((current) => ({ ...current, clinicLocations }));
    setClinicLocationsError(undefined);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) return;

    if (!formData.clinicSpecialty) {
      setClinicSpecialtyError(true);
      clinicSpecialtyTriggerRef.current?.focus();
      return;
    }

    if (formData.clinicLocations.length === 0) {
      setClinicLocationsError(
        t("auth.signup.clinicLocationsRequired", {
          fallback: "Select at least one clinic location.",
        })
      );
      return;
    }

    const selectedOther = formData.clinicLocations.find(
      (location) =>
        deliveryZones.find((zone) => zone.id === location.deliveryZoneId)
          ?.slug === "other"
    );
    if (selectedOther && (selectedOther.customArea?.trim().length ?? 0) < 2) {
      setClinicLocationsError(
        t("auth.signup.clinicLocationsOtherRequired", {
          fallback: "Enter your clinic area when selecting Other.",
        })
      );
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: t("auth.signup.passwordMismatchTitle"),
        description: t("auth.signup.passwordMismatchBody"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const result = await signUp({
      fullName: formData.fullName,
      phone: formData.phone,
      clinicSpecialty: formData.clinicSpecialty,
      clinicLocations: formData.clinicLocations.map((location) => ({
        ...location,
        customArea: location.customArea?.trim() || undefined,
      })),
      email: formData.email,
      password: formData.password,
    });

    if (!result.success) {
      toast({
        title: t("auth.signup.errorTitle", { fallback: "Could not create account" }),
        description: result.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    toast({
      title: t("auth.signup.toastTitle"),
      description: t("auth.signup.toastDescription"),
    });

    navigate("/account/dashboard");
  };

  return (
    <section className="relative isolate overflow-hidden bg-[var(--xd-bg)] px-4 py-10 sm:px-6 lg:py-16">
      <SEO page="signup" />
      <style>{meshMotionStyles}</style>
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-[var(--xd-gold-bg-medium)] blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-[#25B8C7]/10 blur-3xl" />

      <Button
        asChild
        variant="secondary"
        size="icon"
        className="absolute left-5 top-5 z-20 h-10 w-10 bg-white/80"
      >
        <Link href="/" aria-label={t("common.backToHome")} data-testid="button-back-home">
          <DirectionalIcon direction="back" size={17} />
        </Link>
      </Button>

      <div className="relative z-10 mx-auto flex min-h-[590px] min-w-0 w-[calc(100vw-2rem)] max-w-[1040px] overflow-hidden rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white/78 shadow-[0_32px_80px_rgba(58,38,0,0.12)] backdrop-blur-xl">
        <div className="relative hidden w-[42%] shrink-0 overflow-hidden p-2 md:block">
          <div className="relative isolate flex h-full min-h-[574px] flex-col overflow-hidden rounded-[22px] bg-[#241900] px-8 py-8 text-white">
            <div className="auth-mesh-float-a pointer-events-none absolute -left-20 -top-14 z-[1] h-72 w-72 rounded-full bg-[rgba(249,220,92,0.55)] blur-3xl" />
            <div className="auth-mesh-float-b pointer-events-none absolute -right-20 top-[38%] z-[1] h-72 w-72 rounded-full bg-[rgba(255,232,170,0.24)] blur-3xl" />
            <div className="auth-mesh-float-c pointer-events-none absolute -bottom-24 left-10 z-[1] h-72 w-72 rounded-full bg-[rgba(255,214,120,0.18)] blur-3xl" />
            <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.16),transparent_45%,rgba(5,5,5,0.24))]" />

            <Link href="/" className="relative z-10 flex w-fit items-center gap-2.5">
              <span className="xd-gradient-gold flex h-10 w-10 items-center justify-center rounded-[11px] font-display text-[18px] font-bold text-[#050505] shadow-[var(--xd-gold-gradient-shadow)]">
                X
              </span>
              <span className="font-display text-[15px] font-semibold tracking-tight">
                X Dental Store
              </span>
            </Link>

            <div className="relative z-10 mt-auto max-w-[310px]">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[12px] border border-white/20 bg-white/10 backdrop-blur">
                <ShieldCheck size={21} />
              </div>
              <h1 className="font-display text-[31px] font-bold leading-[1.15] tracking-[-0.035em]">
                {t("auth.signup.sideTitle")}
              </h1>
              <p className="mt-4 text-[14px] leading-6 text-white/70">
                {t("auth.signup.sideBody")}
              </p>

              <div className="mt-8 flex items-center gap-3 text-[12px] font-semibold text-white/80">
                <span className="h-px w-10 bg-[var(--xd-gold)]" />
                {t("auth.login.sideCaption")}
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="min-w-0 w-full max-w-[440px]">
            <div className="mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-text)]">
                {t("auth.login.eyebrow")}
              </p>
              <h2 className="mt-3 font-display text-[30px] font-bold tracking-[-0.035em] text-[#050505]">
                {t("auth.signup.title")}
              </h2>
              <p className="mt-2 text-[14px] leading-6 text-[#717182]">
                {t("auth.signup.intro")}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.09em] text-[#3A3A3A]">
                    {t("auth.signup.fullName")}
                  </span>
                  <span className="relative block">
                    <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--xd-gold-text)]" size={16} />
                    <input
                      required
                      type="text"
                      value={formData.fullName}
                      onChange={(event) => updateField("fullName", event.target.value)}
                      className={inputClassName}
                      placeholder={t("auth.signup.fullNamePlaceholder")}
                      autoComplete="name"
                      data-testid="input-fullname"
                    />
                  </span>
                </label>

                <label className="block min-w-0">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.09em] text-[#3A3A3A]">
                    {t("checkout.phone")}
                  </span>
                  <span className="relative block">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--xd-gold-text)]" size={16} />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(event) => updateField("phone", event.target.value)}
                      className={inputClassName}
                      placeholder={t("auth.signup.phonePlaceholder")}
                      autoComplete="tel"
                      data-testid="input-phone"
                    />
                  </span>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.09em] text-[#3A3A3A]">
                  {t("auth.signup.clinicSpecialty", { fallback: "Clinic Specialty" })}
                </span>
                <Select
                  value={formData.clinicSpecialty}
                  onValueChange={(value) => updateField("clinicSpecialty", value)}
                >
                  <SelectTrigger
                    ref={clinicSpecialtyTriggerRef}
                    aria-invalid={clinicSpecialtyError}
                    aria-describedby={clinicSpecialtyError ? "clinic-specialty-error" : undefined}
                    className={cn(
                      inputClassName,
                      "relative flex justify-start text-left font-normal shadow-none",
                      "data-[placeholder]:text-[#9A9A9A] data-[placeholder]:font-normal",
                      "data-[state=open]:border-[var(--xd-gold-active)]/50 data-[state=open]:ring-4 data-[state=open]:ring-[var(--xd-gold-bg-soft)]",
                      "[&>span]:min-w-0 [&>span]:truncate [&>svg:last-child]:absolute [&>svg:last-child]:right-4 [&>svg:last-child]:top-1/2 [&>svg:last-child]:h-4 [&>svg:last-child]:w-4 [&>svg:last-child]:-translate-y-1/2 [&>svg:last-child]:text-[#9A9A9A] [&>svg:last-child]:opacity-100 [&>svg:last-child]:transition-transform data-[state=open]:[&>svg:last-child]:rotate-180",
                      clinicSpecialtyError &&
                        "border-[#C97922]/35 bg-[#FFF8E6]/45 focus:border-[#C97922]/50 focus:ring-[#C97922]/10"
                    )}
                    data-testid="select-clinic-specialty"
                  >
                    <Stethoscope className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--xd-gold-text)]" size={16} />
                    <SelectValue
                      placeholder={t("auth.signup.clinicSpecialtyPlaceholder", {
                        fallback: "Select your clinic specialty",
                      })}
                    />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    sideOffset={8}
                    className="z-[100] max-h-[min(280px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-32px)] overflow-hidden rounded-[16px] border border-[#050505]/10 bg-white p-1.5 text-[#050505] shadow-[0_18px_44px_rgba(5,5,5,0.12)]"
                  >
                    {CLINIC_SPECIALTIES.map((specialty) => (
                      <SelectItem
                        key={specialty}
                        value={specialty}
                        className="min-w-0 rounded-[12px] py-2.5 ps-3 pe-9 text-[14px] font-medium text-[#3A3A3A] outline-none transition-colors focus:bg-[var(--xd-gold-bg-soft)] focus:text-[#050505] data-[state=checked]:bg-[var(--xd-gold-bg-soft)] data-[state=checked]:text-[var(--xd-gold-text)] [&>span:last-child]:min-w-0 [&>span:last-child]:truncate"
                      >
                        {specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clinicSpecialtyError && (
                  <p id="clinic-specialty-error" className="mt-2 text-[12px] font-medium text-[#9B6B18]">
                    {t("auth.signup.clinicSpecialtyRequired", {
                      fallback: "Select your clinic specialty to continue.",
                    })}
                  </p>
                )}
              </label>

              <DeliveryZoneMultiSelect
                zones={deliveryZones}
                value={formData.clinicLocations}
                onChange={updateClinicLocations}
                label={t("auth.signup.clinicLocations", {
                  fallback: "Clinic Locations",
                })}
                placeholder={t("auth.signup.clinicLocationsPlaceholder", {
                  fallback: "Select your clinic locations",
                })}
                addAnotherPlaceholder={t(
                  "auth.signup.clinicLocationsAddAnother",
                  {
                    fallback: "Add another location",
                  }
                )}
                searchPlaceholder={t("auth.signup.clinicLocationsSearch", {
                  fallback: "Search delivery areas",
                })}
                emptyText={
                  deliveryZonesLoadError
                    ? t("auth.signup.clinicLocationsLoadError", {
                        fallback: "Clinic locations could not be loaded.",
                      })
                    : t("auth.signup.clinicLocationsEmpty", {
                        fallback: "No clinic locations found.",
                      })
                }
                otherLabel={t("auth.signup.clinicLocationsOtherLabel", {
                  fallback: "Other location name",
                })}
                otherPlaceholder={t("auth.signup.clinicLocationsOtherPlaceholder", {
                  fallback: "Enter your clinic area",
                })}
                error={clinicLocationsError}
                testId="signup-clinic-locations"
              />

              <label className="block">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.09em] text-[#3A3A3A]">
                  {t("auth.login.email")}
                </span>
                <span className="relative block">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--xd-gold-text)]" size={16} />
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    className={inputClassName}
                    placeholder={t("auth.login.emailPlaceholder")}
                    autoComplete="email"
                    data-testid="input-email"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.09em] text-[#3A3A3A]">
                  {t("auth.login.password")}
                </span>
                <span className="relative block">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--xd-gold-text)]" size={16} />
                  <input
                    required
                    minLength={8}
                    maxLength={128}
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    className={`${inputClassName} pr-11`}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    data-testid="input-password"
                  />
                  <Button
                    type="button"
                    onClick={() => setShowPassword((isVisible) => !isVisible)}
                    variant="tertiary"
                    size="icon"
                    className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-[#9A9A9A]"
                    aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.09em] text-[#3A3A3A]">
                  {t("auth.signup.confirmPassword")}
                </span>
                <span className="relative block">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--xd-gold-text)]" size={16} />
                  <input
                    required
                    minLength={8}
                    maxLength={128}
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(event) => updateField("confirmPassword", event.target.value)}
                    className={`${inputClassName} pr-11`}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    data-testid="input-confirm-password"
                  />
                  <Button
                    type="button"
                    onClick={() => setShowConfirmPassword((isVisible) => !isVisible)}
                    variant="tertiary"
                    size="icon"
                    className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-[#9A9A9A]"
                    aria-label={showConfirmPassword ? t("auth.signup.hideConfirmPassword") : t("auth.signup.showConfirmPassword")}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </span>
              </label>

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="mt-2 h-[52px] w-full gap-2 text-[15px]"
                data-testid="button-signup"
              >
                {isSubmitting ? t("auth.signup.creating") : t("auth.signup.createAccount")}
                {!isSubmitting && <DirectionalIcon direction="forward" size={17} />}
              </Button>
            </form>

            <p className="mt-6 text-center text-[13px] text-[#717182]">
              {t("auth.signup.hasAccount")}{" "}
              <Link href="/signin" className="font-bold text-[var(--xd-gold-text)] transition hover:text-[#050505]">
                {t("auth.login.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
