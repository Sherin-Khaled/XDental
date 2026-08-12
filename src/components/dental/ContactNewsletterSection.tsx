import { useState, type FormEvent } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { useLanguage } from "@/context/LanguageContext";
import { subscribeToNewsletter } from "@/services/contact";
import { ApiError } from "@/services/http";

const CONTACT_ITEMS = [
  { Icon: MessageCircle, text: "01035777335", labelKey: "home.contact.ordersWhatsApp" },
  { Icon: Phone, text: "01552229405", labelKey: "home.contact.mainSupport" },
  { Icon: Phone, text: "01065057035", labelKey: "home.contact.branch" },
];

export function ContactNewsletterSection() {
  const { t, language } = useLanguage();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const handleNewsletterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubscribing) return;
    const website = String(new FormData(event.currentTarget).get("website") ?? "").trim();

    setIsSubscribing(true);
    setSubscribeError(null);
    try {
      await subscribeToNewsletter({ email, source: "contact", locale: language, website });
      setSubmitted(true);
      setEmail("");
    } catch (error) {
      setSubscribeError(
        error instanceof ApiError && error.status !== 0
          ? error.message
          : t("home.contact.subscribeError", {
              fallback: "The subscription could not be completed. Please try again.",
            })
      );
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <section className="px-5 py-24 sm:px-8 lg:px-12" style={{ background: "var(--xd-white)" }}>
      <div className="mx-auto max-w-[1344px]">
        <div className="flex flex-col items-start gap-14 lg:flex-row lg:items-center lg:gap-20">
          <div className="flex flex-col gap-7 lg:w-[48%]">
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center font-display font-bold text-white"
                style={{ width: 32, height: 32, borderRadius: 8, background: "var(--xd-gold-warm)", fontSize: 15 }}
              >
                X
              </div>
              <span className="font-display font-semibold" style={{ fontSize: 15, color: "var(--xd-text)" }}>
                X Dental Store
              </span>
            </div>

            <div>
              <h2
                className="mb-3 font-display font-semibold"
                style={{
                  fontSize: "clamp(28px, 3.5vw, 44px)",
                  lineHeight: 1.1,
                  color: "var(--xd-text)",
                  letterSpacing: "-0.02em",
                }}
              >
                {t("home.contact.headline")}
              </h2>
              <p className="max-w-[400px] text-[16px] leading-[26px]" style={{ color: "var(--xd-muted-2)" }}>
                {t("home.contact.body")}
              </p>
            </div>

            <div className="mt-2 flex flex-col gap-4">
              {CONTACT_ITEMS.map(({ Icon, text, labelKey }) => (
                <div key={labelKey} className="flex items-center gap-4">
                  <div
                    className="xd-icon-card-surface flex shrink-0 items-center justify-center"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: "var(--xd-gold-bg-soft)",
                      border: "1px solid var(--xd-gold-border-soft)",
                    }}
                  >
                    <Icon
                      size={17}
                      strokeWidth={1.75}
                      className="xd-icon-amber xd-premium-icon"
                    />
                  </div>
                  <div>
                    <div className="mb-0.5 text-[11px]" style={{ color: "var(--xd-muted-2)" }}>
                      {t(labelKey)}
                    </div>
                    <div className="text-[14.5px] font-medium" style={{ color: "var(--xd-text)" }}>
                      {text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full lg:w-[52%] lg:items-center">
            <div
              className="w-full"
              style={{
                flex: 1,
                maxWidth: 640,
                minHeight: 320,
                marginLeft: "auto",
                backgroundColor: "rgba(255,255,255,0.52)",
                border: "1px solid rgba(212, 167, 44, 0.2)",
                borderRadius: 24,
                padding: "clamp(36px, 4vw, 48px)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 18px 50px rgba(5,5,5,0.05), 0 4px 16px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--xd-gold-active)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                {t("common.newsletter")}
              </div>
              <h3
                className="font-display"
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#050505",
                  lineHeight: 1.3,
                  marginBottom: 12,
                }}
              >
                {t("home.contact.headline")}
              </h3>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: "24px",
                  color: "#717182",
                  marginBottom: 30,
                  maxWidth: 500,
                }}
              >
                {t("home.contact.newsletterBody")}
              </p>

              {submitted ? (
                <div
                  className="flex items-center"
                  style={{
                    gap: 10,
                    padding: "14px 20px",
                    borderRadius: 12,
                    backgroundColor: "rgba(212, 167, 44, 0.08)",
                    border: "1px solid rgba(212, 167, 44, 0.25)",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "var(--xd-gold-active)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#050505" }}>
                    {t("home.contact.subscribed")}
                  </span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row" style={{ gap: 12 }}>
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-10000px] h-px w-px overflow-hidden" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("footer.emailPlaceholder")}
                    required
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 12,
                      border: "1px solid rgba(5,5,5,0.10)",
                      backgroundColor: "rgba(248,247,242,0.8)",
                      padding: "0 16px",
                      fontSize: 15,
                      color: "#050505",
                      outline: "none",
                      minWidth: 0,
                    }}
                    onFocus={(event) => {
                      event.currentTarget.style.borderColor = "rgba(212,167,44,0.5)";
                    }}
                    onBlur={(event) => {
                      event.currentTarget.style.borderColor = "rgba(5,5,5,0.10)";
                    }}
                  />
                  <Button
                    type="submit"
                    disabled={isSubscribing}
                    variant="primary"
                    className="h-[52px] shrink-0 gap-1.5 px-6 text-[15px] font-semibold"
                  >
                    {isSubscribing
                      ? t("common.saving", { fallback: "Saving..." })
                      : t("common.subscribe")}
                    <DirectionalIcon direction="forward" style={{ width: 15, height: 15 }} />
                  </Button>
                </form>
              )}
              {subscribeError && (
                <p role="alert" className="mt-3 text-[13px] font-semibold text-[#C62828]">
                  {subscribeError}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
