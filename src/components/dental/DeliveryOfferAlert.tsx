import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { MapPin, Truck, X } from "lucide-react";
import { Container } from "@/components/dental/Container";
import { useStore } from "@/context/StoreContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  getMyMatchingDeliveryOffers,
  type MyMatchingDeliveryOffersResponse,
} from "@/services/delivery";

const DISMISSAL_PREFIX = "xdental.delivery-alert";
const DELIVERY_TIMEZONE = "Africa/Cairo";
const AUTH_ROUTES = [
  "/login",
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
] as const;

function isAuthenticationRoute(location: string) {
  const pathname = location.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function cairoDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dismissalKey(userId: string, response: MyMatchingDeliveryOffersResponse) {
  const offerKey =
    response.offers.length > 0
      ? response.offers.map((offer) => offer.id).sort().join(",")
      : "locations-required";
  return `${DISMISSAL_PREFIX}:${userId}:${cairoDateKey()}:${offerKey}`;
}

function formatCutoff(cutoffTime: string, language: "en" | "ar") {
  const [hours, minutes] = cutoffTime.split(":").map(Number);
  const value = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
    hour: "numeric",
    minute: minutes === 0 ? undefined : "2-digit",
  }).format(value);
}

export function DeliveryOfferAlert() {
  const { currentUser, isAuthLoading } = useStore();
  const { language, direction, t } = useLanguage();
  const [location] = useLocation();
  const [response, setResponse] =
    useState<MyMatchingDeliveryOffersResponse | null>(null);
  const [loadedResponseKey, setLoadedResponseKey] = useState<string | null>(
    null
  );
  const [isLocationStateLoading, setIsLocationStateLoading] = useState(false);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const isAuthRoute = isAuthenticationRoute(location);
  const accountRole = currentUser?.role?.trim().toLowerCase();
  const isCustomerFacingAccount = accountRole === "customer";
  const locationSignature =
    currentUser?.clinicLocations
      .map(
        (location) =>
          `${location.deliveryZoneId}:${location.customArea ?? ""}`
      )
      .sort()
      .join("|") ?? "";
  const responseKey = currentUser
    ? `${currentUser.id}:${locationSignature}`
    : null;

  useEffect(() => {
    if (
      isAuthRoute ||
      isAuthLoading ||
      !currentUser ||
      !isCustomerFacingAccount
    ) {
      setResponse(null);
      setLoadedResponseKey(null);
      setIsLocationStateLoading(false);
      return;
    }

    const controller = new AbortController();
    let isCurrentRequest = true;
    setResponse(null);
    setLoadedResponseKey(null);
    setIsLocationStateLoading(true);
    getMyMatchingDeliveryOffers(controller.signal)
      .then((result) => {
        if (isCurrentRequest) {
          setResponse(result);
          setLoadedResponseKey(responseKey);
        }
      })
      .catch((error) => {
        if (
          isCurrentRequest &&
          (error as Error).name !== "AbortError"
        ) {
          setResponse(null);
        }
      })
      .finally(() => {
        if (isCurrentRequest) setIsLocationStateLoading(false);
      });
    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [
    currentUser?.id,
    isAuthLoading,
    isAuthRoute,
    isCustomerFacingAccount,
    locationSignature,
    responseKey,
  ]);

  const storageKey = useMemo(
    () =>
      currentUser && response
        ? dismissalKey(currentUser.id, response)
        : null,
    [currentUser, response]
  );

  if (
    isAuthRoute ||
    isAuthLoading ||
    isLocationStateLoading ||
    !currentUser ||
    !isCustomerFacingAccount ||
    !response ||
    loadedResponseKey !== responseKey ||
    (!response.needsClinicLocations && response.offers.length === 0) ||
    !storageKey ||
    dismissedKey === storageKey ||
    window.localStorage.getItem(storageKey) === "1"
  ) {
    return null;
  }

  const dismiss = () => {
    window.localStorage.setItem(storageKey, "1");
    setDismissedKey(storageKey);
  };

  const firstOffer = response.offers[0];
  const title = firstOffer
    ? language === "ar"
      ? firstOffer.titleAr
      : firstOffer.titleEn
    : t("deliveryAlerts.locationNeededTitle", {
        fallback: "Add your clinic location",
      });
  const description = firstOffer
    ? language === "ar"
      ? firstOffer.descriptionAr
      : firstOffer.descriptionEn
    : t("deliveryAlerts.locationNeededDescription", {
        fallback:
          "Save your clinic's delivery area to see available delivery services and location-based offers.",
      });
  const locationNames =
    firstOffer?.matchedLocations.map((location) => {
      const baseName = language === "ar" ? location.nameAr : location.nameEn;
      return location.customArea || baseName;
    }) ?? [];

  return (
    <div
      dir={direction}
      className="border-b border-[var(--xd-gold-border-soft)] bg-[var(--xd-surface-strong)] text-[var(--xd-text)] shadow-[0_1px_0_var(--xd-border-soft)]"
      data-testid="delivery-offer-alert"
    >
      <Container className="py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)] shadow-sm">
            {firstOffer ? <Truck size={17} /> : <MapPin size={17} />}
          </span>

          <div className="min-w-0 flex-[1_1_190px] sm:flex sm:items-center sm:gap-3">
            <p className="truncate text-[13px] font-bold text-[var(--xd-text)]">
              {title}
            </p>
            <p className="line-clamp-1 text-[12px] leading-5 text-[var(--xd-text-muted)]">
              {description}
            </p>
            {locationNames.length > 0 && (
              <span className="mt-1 inline-flex max-w-full items-center rounded-full border border-[var(--xd-gold-border-soft)] bg-[var(--xd-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--xd-gold-text)] sm:mt-0">
                <MapPin size={11} className="me-1 shrink-0" />
                <span className="truncate">{locationNames.join(" · ")}</span>
              </span>
            )}
            {firstOffer?.cutoffTime && (
              <span className="ms-1 whitespace-nowrap text-[11px] font-semibold text-[var(--xd-text-muted)]">
                {t("deliveryAlerts.orderBefore", {
                  fallback: "Order before {time}",
                  values: {
                    time: formatCutoff(firstOffer.cutoffTime, language),
                  },
                })}
              </span>
            )}
            {response.offers.length > 1 && (
              <span className="ms-1 whitespace-nowrap text-[11px] font-bold text-[var(--xd-gold-text)]">
                +{response.offers.length - 1}{" "}
                {t("deliveryAlerts.more", { fallback: "more" })}
              </span>
            )}
          </div>

          <div className="ms-auto flex shrink-0 items-center gap-2">
            {response.needsClinicLocations && (
              <Link
                href="/account/profile#clinic-locations"
                className="shrink-0 rounded-full border border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-medium)] px-3 py-2 text-[11px] font-bold text-[var(--xd-text)] transition-[background-color,border-color,color,box-shadow] hover:border-[var(--xd-gold-border-hover)] hover:bg-[var(--xd-gold-bg-soft)] hover:text-[var(--xd-gold-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-surface-strong)]"
              >
                {t("deliveryAlerts.updateProfile", {
                  fallback: "Update profile",
                })}
              </Link>
            )}

            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[var(--xd-text-muted)] transition-[background-color,color,box-shadow] hover:bg-[var(--xd-gold-bg-soft)] hover:text-[var(--xd-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-surface-strong)]"
              aria-label={t("deliveryAlerts.dismiss", {
                fallback: "Dismiss delivery alert",
              })}
            >
              <span className="text-[11px] font-semibold">
                {t("deliveryAlerts.hideForToday", {
                  fallback: "Hide for today",
                })}
              </span>
              <X size={15} />
            </button>
          </div>
        </div>
      </Container>
    </div>
  );
}
