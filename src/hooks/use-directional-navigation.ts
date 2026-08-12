import { useLanguage } from "@/context/LanguageContext";

export type HorizontalNavigationAction = "previous" | "next";

const LTR_CONTROL_ORDER: readonly HorizontalNavigationAction[] = ["previous", "next"];
const RTL_CONTROL_ORDER: readonly HorizontalNavigationAction[] = ["next", "previous"];

export function getHorizontalNavigationAction(
  key: string,
  isRtl: boolean
): HorizontalNavigationAction | null {
  if (key === "ArrowLeft") return isRtl ? "next" : "previous";
  if (key === "ArrowRight") return isRtl ? "previous" : "next";
  return null;
}

export function isEditableNavigationTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    target.matches("input, textarea, select, [role='textbox']")
  );
}

export function useDirectionalNavigation() {
  const { isRtl } = useLanguage();

  return {
    isRtl,
    controlOrder: isRtl ? RTL_CONTROL_ORDER : LTR_CONTROL_ORDER,
    actionForKey: (key: string) => getHorizontalNavigationAction(key, isRtl),
  };
}
