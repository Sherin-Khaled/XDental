type AlertName = "daily-offer" | "notification-prompt";

export const ALERT_VISIBILITY_EVENT = "x-dental-alert-visibility-change";

function getAlertAttribute(alertName: AlertName) {
  return `data-x-dental-${alertName}-visible`;
}

export function isAlertVisible(alertName: AlertName) {
  if (typeof document === "undefined") return false;
  return document.body.getAttribute(getAlertAttribute(alertName)) === "true";
}

export function setAlertVisible(alertName: AlertName, isVisible: boolean) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const attribute = getAlertAttribute(alertName);

  if (isVisible) {
    document.body.setAttribute(attribute, "true");
  } else {
    document.body.removeAttribute(attribute);
  }

  window.dispatchEvent(
    new CustomEvent(ALERT_VISIBILITY_EVENT, {
      detail: { alertName, isVisible },
    })
  );
}
