import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { useStore } from "@/context/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";

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
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { signUp } = useStore();
  const [, navigate] = useLocation();

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) return;

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
              <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[var(--xd-gold-active)] font-display text-[18px] font-bold text-white shadow-[0_8px_20px_rgba(212,167,44,0.32)]">
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
                      placeholder="Sherin Khaled"
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
                      placeholder="+20 100 000 0000"
                      autoComplete="tel"
                      data-testid="input-phone"
                    />
                  </span>
                </label>
              </div>

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
