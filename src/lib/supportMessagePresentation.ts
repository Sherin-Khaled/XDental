import type { useLanguage } from "@/context/LanguageContext";

type TranslateFn = ReturnType<typeof useLanguage>["t"];

export const SUPPORT_AUTO_ACKNOWLEDGEMENT =
  "Thanks for contacting X Dental Store. Our support team received your message and will reply as soon as possible.";

export function presentSupportMessageBody(t: TranslateFn, body: string) {
  return body === SUPPORT_AUTO_ACKNOWLEDGEMENT
    ? t("floatingSupport.autoAcknowledgement", { fallback: SUPPORT_AUTO_ACKNOWLEDGEMENT })
    : body;
}
