import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Eye,
  MapPinned,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/services/http";
import {
  createAdminDeliveryOffer,
  createAdminDeliveryZone,
  deleteAdminDeliveryOffer,
  deleteAdminDeliveryZone,
  getAdminDeliveryOffers,
  getAdminDeliveryZones,
  getEligibleUsersForDeliveryOffer,
  updateAdminDeliveryOffer,
  updateAdminDeliveryZone,
  type AdminDeliveryOffer,
  type AdminDeliveryOfferInput,
  type AdminDeliveryZone,
  type AdminDeliveryZoneInput,
  type EligibleDeliveryUser,
} from "@/services/adminDelivery";
import { AdminLayout } from "./_components/AdminLayout";
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from "./_components/admin-ui";
import {
  AdminCheckbox,
  AdminInput,
  AdminMultiSelect,
  AdminSelect,
  AdminTextarea,
  AdminWeekdaySelector,
} from "./_components/admin-form";

const inputClass =
  "h-11 w-full rounded-lg border border-[#050505]/10 bg-white px-3 text-sm text-[#050505] outline-none transition focus:border-[#D4A72C] focus:ring-2 focus:ring-[#D4A72C]/20";
const primaryButton =
  "xd-gradient-primary-button inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#050505]/10 bg-white px-3 text-xs font-semibold text-[#050505] transition hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6] disabled:opacity-50";

type ZoneForm = {
  slug: string;
  nameEn: string;
  nameAr: string;
  displayOrder: string;
  isActive: boolean;
};

type OfferForm = {
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  offerType: AdminDeliveryOffer["offerType"];
  recurrenceType: AdminDeliveryOffer["recurrenceType"];
  weekdays: number[];
  specificDate: string;
  startDate: string;
  endDate: string;
  cutoffTime: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  minimumOrderAmount: string;
  appliesToStandard: boolean;
  appliesToFast: boolean;
  isActive: boolean;
  deliveryZoneIds: string[];
};

type ZoneFormErrors = Partial<Record<keyof ZoneForm, string>>;
type OfferFormErrors = Partial<Record<keyof OfferForm, string>>;

const EMPTY_ZONE: ZoneForm = {
  slug: "",
  nameEn: "",
  nameAr: "",
  displayOrder: "0",
  isActive: true,
};

const EMPTY_OFFER: OfferForm = {
  titleEn: "",
  titleAr: "",
  descriptionEn: "",
  descriptionAr: "",
  offerType: "SAME_DAY_DELIVERY",
  recurrenceType: "WEEKLY",
  weekdays: [],
  specificDate: "",
  startDate: "",
  endDate: "",
  cutoffTime: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  minimumOrderAmount: "",
  appliesToStandard: true,
  appliesToFast: true,
  isActive: true,
  deliveryZoneIds: [],
};

function offerToForm(offer: AdminDeliveryOffer): OfferForm {
  return {
    titleEn: offer.titleEn,
    titleAr: offer.titleAr,
    descriptionEn: offer.descriptionEn,
    descriptionAr: offer.descriptionAr,
    offerType: offer.offerType,
    recurrenceType: offer.recurrenceType,
    weekdays: offer.weekdays,
    specificDate: offer.specificDate ?? "",
    startDate: offer.startDate ?? "",
    endDate: offer.endDate ?? "",
    cutoffTime: offer.cutoffTime ?? "",
    discountType: offer.discountType ?? "PERCENTAGE",
    discountValue: offer.discountValue?.toString() ?? "",
    minimumOrderAmount: offer.minimumOrderAmount?.toString() ?? "",
    appliesToStandard: offer.appliesToStandard,
    appliesToFast: offer.appliesToFast,
    isActive: offer.isActive,
    deliveryZoneIds: offer.deliveryZones.map((zone) => zone.id),
  };
}

export default function AdminDeliveryPage() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [zones, setZones] = useState<AdminDeliveryZone[]>([]);
  const [offers, setOffers] = useState<AdminDeliveryOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [zoneForm, setZoneForm] = useState<ZoneForm>(EMPTY_ZONE);
  const [editingZone, setEditingZone] = useState<AdminDeliveryZone | null>(null);
  const [offerForm, setOfferForm] = useState<OfferForm>(EMPTY_OFFER);
  const [editingOffer, setEditingOffer] =
    useState<AdminDeliveryOffer | null>(null);
  const [isSavingZone, setIsSavingZone] = useState(false);
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [zoneErrors, setZoneErrors] = useState<ZoneFormErrors>({});
  const [offerErrors, setOfferErrors] = useState<OfferFormErrors>({});
  const zoneFormRef = useRef<HTMLFormElement | null>(null);
  const offerFormRef = useRef<HTMLFormElement | null>(null);
  const [previewOffer, setPreviewOffer] =
    useState<AdminDeliveryOffer | null>(null);
  const [eligibleUsers, setEligibleUsers] = useState<
    EligibleDeliveryUser[] | null
  >(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"zones" | "offers">("zones");
  const [isZoneEditorOpen, setIsZoneEditorOpen] = useState(false);
  const [isOfferEditorOpen, setIsOfferEditorOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      getAdminDeliveryZones(controller.signal),
      getAdminDeliveryOffers(controller.signal),
    ])
      .then(([zoneRows, offerRows]) => {
        setZones(zoneRows);
        setOffers(offerRows);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : t("admin.delivery.loadError", {
                  fallback: "Delivery settings could not be loaded.",
                })
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [refreshVersion, t]);

  const weekdayLabels = useMemo(
    () =>
      language === "ar"
        ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    [language]
  );

  const validationCopy =
    language === "ar"
      ? {
          nameEn: "الاسم باللغة الإنجليزية مطلوب.",
          nameAr: "الاسم باللغة العربية مطلوب.",
          slug: "أدخل اسمًا مختصرًا من حروف إنجليزية صغيرة وأرقام وشرطات.",
          titleEn: "العنوان باللغة الإنجليزية مطلوب.",
          titleAr: "العنوان باللغة العربية مطلوب.",
          descriptionEn: "الوصف باللغة الإنجليزية مطلوب.",
          descriptionAr: "الوصف باللغة العربية مطلوب.",
          weekdays: "اختر يومًا واحدًا على الأقل.",
          zones: "اختر منطقة توصيل واحدة على الأقل.",
          specificDate: "اختر تاريخًا صالحًا.",
          startDate: "اختر تاريخ بداية صالحًا.",
          endDate: "اختر تاريخ انتهاء صالحًا.",
          endAfterStart: "يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء.",
        }
      : {
          nameEn: "English name is required.",
          nameAr: "Arabic name is required.",
          slug: "Enter a slug using lowercase letters, numbers, and hyphens.",
          titleEn: "English title is required.",
          titleAr: "Arabic title is required.",
          descriptionEn: "English description is required.",
          descriptionAr: "Arabic description is required.",
          weekdays: "Select at least one weekday.",
          zones: "Select at least one delivery zone.",
          specificDate: "Select a valid date.",
          startDate: "Select a valid start date.",
          endDate: "Select a valid end date.",
          endAfterStart: "End date must be after the start date.",
        };

  const focusFirstInvalid = (form: HTMLFormElement | null) => {
    window.requestAnimationFrame(() => {
      const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
      const target = invalid?.matches("input, textarea, button")
        ? invalid
        : invalid?.querySelector<HTMLElement>("input, textarea, button");
      target?.focus();
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const saveZone = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: ZoneFormErrors = {};
    if (!zoneForm.nameEn.trim()) nextErrors.nameEn = validationCopy.nameEn;
    if (!zoneForm.nameAr.trim()) nextErrors.nameAr = validationCopy.nameAr;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(zoneForm.slug.trim())) {
      nextErrors.slug = validationCopy.slug;
    }
    setZoneErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(zoneFormRef.current);
      return;
    }
    const input: AdminDeliveryZoneInput = {
      slug: zoneForm.slug.trim().toLowerCase(),
      nameEn: zoneForm.nameEn.trim(),
      nameAr: zoneForm.nameAr.trim(),
      displayOrder: Number(zoneForm.displayOrder) || 0,
      isActive: zoneForm.isActive,
    };
    setIsSavingZone(true);
    setFormError(null);
    try {
      if (editingZone) {
        await updateAdminDeliveryZone(editingZone.id, input);
      } else {
        await createAdminDeliveryZone(input);
      }
      setZoneForm(EMPTY_ZONE);
      setZoneErrors({});
      setEditingZone(null);
      setIsZoneEditorOpen(false);
      setRefreshVersion((value) => value + 1);
      toast({
        title: t("admin.delivery.zoneSaved", {
          fallback: "Delivery zone saved.",
        }),
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.field &&
        error.field in EMPTY_ZONE
      ) {
        setZoneErrors((current) => ({
          ...current,
          [error.field as keyof ZoneForm]: error.message,
        }));
        focusFirstInvalid(zoneFormRef.current);
      } else {
        setFormError(error instanceof Error ? error.message : "Unable to save.");
      }
    } finally {
      setIsSavingZone(false);
    }
  };

  const editZone = (zone: AdminDeliveryZone) => {
    setEditingZone(zone);
    setZoneForm({
      slug: zone.slug,
      nameEn: zone.nameEn,
      nameAr: zone.nameAr,
      displayOrder: String(zone.displayOrder),
      isActive: zone.isActive,
    });
    setFormError(null);
    setZoneErrors({});
    setIsZoneEditorOpen(true);
  };

  const openCreateZone = () => {
    setEditingZone(null);
    setZoneForm(EMPTY_ZONE);
    setZoneErrors({});
    setFormError(null);
    setIsZoneEditorOpen(true);
  };

  const closeZoneEditor = () => {
    if (isSavingZone) return;
    setIsZoneEditorOpen(false);
    setEditingZone(null);
    setZoneForm(EMPTY_ZONE);
    setZoneErrors({});
    setFormError(null);
  };

  const removeZone = async (zone: AdminDeliveryZone) => {
    if (
      !window.confirm(
        t("admin.delivery.confirmDeleteZone", {
          fallback: `Delete ${zone.nameEn}?`,
          values: { name: zone.nameEn },
        })
      )
    )
      return;
    try {
      await deleteAdminDeliveryZone(zone.id);
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete.");
    }
  };

  const saveOffer = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: OfferFormErrors = {};
    if (!offerForm.titleEn.trim()) nextErrors.titleEn = validationCopy.titleEn;
    if (!offerForm.titleAr.trim()) nextErrors.titleAr = validationCopy.titleAr;
    if (!offerForm.descriptionEn.trim()) {
      nextErrors.descriptionEn = validationCopy.descriptionEn;
    }
    if (!offerForm.descriptionAr.trim()) {
      nextErrors.descriptionAr = validationCopy.descriptionAr;
    }
    if (offerForm.deliveryZoneIds.length === 0) {
      nextErrors.deliveryZoneIds = validationCopy.zones;
    }
    if (
      offerForm.recurrenceType === "WEEKLY" &&
      offerForm.weekdays.length === 0
    ) {
      nextErrors.weekdays = validationCopy.weekdays;
    }
    if (
      offerForm.recurrenceType === "SPECIFIC_DATE" &&
      !offerForm.specificDate
    ) {
      nextErrors.specificDate = validationCopy.specificDate;
    }
    if (offerForm.recurrenceType === "DATE_RANGE") {
      if (!offerForm.startDate) {
        nextErrors.startDate = validationCopy.startDate;
      }
      if (!offerForm.endDate) {
        nextErrors.endDate = validationCopy.endDate;
      } else if (
        offerForm.startDate &&
        offerForm.endDate < offerForm.startDate
      ) {
        nextErrors.endDate = validationCopy.endAfterStart;
      }
    }
    const hasMonetaryRule =
      offerForm.offerType === "FREE_DELIVERY"
      || offerForm.offerType === "DISCOUNTED_DELIVERY";
    if (
      hasMonetaryRule
      && offerForm.minimumOrderAmount.trim()
      && (!Number.isFinite(Number(offerForm.minimumOrderAmount))
        || Number(offerForm.minimumOrderAmount) < 0)
    ) {
      nextErrors.minimumOrderAmount = language === "ar"
        ? "يجب أن يكون الحد الأدنى صفرًا أو أكثر."
        : "Minimum order must be zero or greater.";
    }
    if (offerForm.offerType === "DISCOUNTED_DELIVERY") {
      const discountValue = Number(offerForm.discountValue);
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        nextErrors.discountValue = language === "ar"
          ? "أدخل قيمة خصم أكبر من صفر."
          : "Enter a discount value greater than zero.";
      } else if (offerForm.discountType === "PERCENTAGE" && discountValue > 100) {
        nextErrors.discountValue = language === "ar"
          ? "لا يمكن أن تتجاوز النسبة 100٪."
          : "Percentage cannot exceed 100%.";
      }
    }
    if (hasMonetaryRule && !offerForm.appliesToStandard && !offerForm.appliesToFast) {
      nextErrors.appliesToStandard = language === "ar"
        ? "اختر التوصيل العادي أو السريع أو كليهما."
        : "Select Standard, Fast, or both.";
    }
    setOfferErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(offerFormRef.current);
      return;
    }
    const input: AdminDeliveryOfferInput = {
      ...offerForm,
      titleEn: offerForm.titleEn.trim(),
      titleAr: offerForm.titleAr.trim(),
      descriptionEn: offerForm.descriptionEn.trim(),
      descriptionAr: offerForm.descriptionAr.trim(),
      specificDate:
        offerForm.recurrenceType === "SPECIFIC_DATE"
          ? offerForm.specificDate || null
          : null,
      startDate:
        offerForm.recurrenceType === "DATE_RANGE"
          ? offerForm.startDate || null
          : null,
      endDate:
        offerForm.recurrenceType === "DATE_RANGE"
          ? offerForm.endDate || null
          : null,
      cutoffTime: offerForm.cutoffTime || null,
      discountType:
        offerForm.offerType === "DISCOUNTED_DELIVERY"
          ? offerForm.discountType
          : null,
      discountValue:
        offerForm.offerType === "DISCOUNTED_DELIVERY"
          ? Number(offerForm.discountValue)
          : null,
      minimumOrderAmount:
        hasMonetaryRule && offerForm.minimumOrderAmount.trim()
          ? Number(offerForm.minimumOrderAmount)
          : null,
      appliesToStandard: hasMonetaryRule && offerForm.appliesToStandard,
      appliesToFast: hasMonetaryRule && offerForm.appliesToFast,
      weekdays:
        offerForm.recurrenceType === "WEEKLY" ? offerForm.weekdays : [],
    };
    setIsSavingOffer(true);
    setFormError(null);
    try {
      if (editingOffer) {
        await updateAdminDeliveryOffer(editingOffer.id, input);
      } else {
        await createAdminDeliveryOffer(input);
      }
      setOfferForm(EMPTY_OFFER);
      setOfferErrors({});
      setEditingOffer(null);
      setIsOfferEditorOpen(false);
      setRefreshVersion((value) => value + 1);
      toast({
        title: t("admin.delivery.offerSaved", {
          fallback: "Delivery offer saved.",
        }),
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.field &&
        error.field in EMPTY_OFFER
      ) {
        setOfferErrors((current) => ({
          ...current,
          [error.field as keyof OfferForm]: error.message,
        }));
        focusFirstInvalid(offerFormRef.current);
      } else if (
        error instanceof ApiError &&
        error.field === "deliveryZoneIds"
      ) {
        setOfferErrors((current) => ({
          ...current,
          deliveryZoneIds: error.message,
        }));
        focusFirstInvalid(offerFormRef.current);
      } else {
        setFormError(error instanceof Error ? error.message : "Unable to save.");
      }
    } finally {
      setIsSavingOffer(false);
    }
  };

  const openCreateOffer = () => {
    setEditingOffer(null);
    setOfferForm(EMPTY_OFFER);
    setOfferErrors({});
    setFormError(null);
    setIsOfferEditorOpen(true);
  };

  const editOffer = (offer: AdminDeliveryOffer) => {
    setEditingOffer(offer);
    setOfferForm(offerToForm(offer));
    setOfferErrors({});
    setFormError(null);
    setIsOfferEditorOpen(true);
  };

  const closeOfferEditor = () => {
    if (isSavingOffer) return;
    setIsOfferEditorOpen(false);
    setEditingOffer(null);
    setOfferForm(EMPTY_OFFER);
    setOfferErrors({});
    setFormError(null);
  };

  const removeOffer = async (offer: AdminDeliveryOffer) => {
    if (
      !window.confirm(
        t("admin.delivery.confirmDeleteOffer", {
          fallback: `Delete ${offer.titleEn}?`,
          values: { name: offer.titleEn },
        })
      )
    )
      return;
    try {
      await deleteAdminDeliveryOffer(offer.id);
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete.");
    }
  };

  const openPreview = async (offer: AdminDeliveryOffer) => {
    setPreviewOffer(offer);
    setEligibleUsers(null);
    setPreviewError(null);
    try {
      const result = await getEligibleUsersForDeliveryOffer(offer.id);
      setEligibleUsers(result.eligibleUsers);
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : "Unable to load users."
      );
    }
  };

  const ui = language === "ar"
    ? {
        zonesTab: "مناطق التوصيل",
        offersTab: "عروض التوصيل",
        zoneDefinition: "منطقة جغرافية لتوصيل الطلبات إلى العيادات، مثل القاهرة الجديدة.",
        offerDefinition: "خدمة مجدولة أو ميزة شحن مرتبطة بمناطق توصيل محددة.",
        addOffer: "إضافة عرض",
        createZone: "إنشاء منطقة توصيل",
        editZone: "تعديل منطقة التوصيل",
        createOffer: "إنشاء عرض توصيل",
        editOffer: "تعديل عرض التوصيل",
        noZones: "لا توجد مناطق توصيل بعد.",
        noOffers: "لا توجد عروض توصيل بعد.",
        name: "المنطقة",
        customers: "العملاء",
        linkedOffers: "العروض المرتبطة",
        offer: "العرض",
        schedule: "الجدول",
        linkedZones: "المناطق المرتبطة",
        status: "الحالة",
        actions: "الإجراءات",
        active: "نشط",
        inactive: "غير نشط",
        scheduled: "مجدول",
        checkoutEligible: "تنبيه وقاعدة دفع مؤهلان",
        alertEligible: "التنبيه مؤهل الآن",
        cutoff: "موعد الإغلاق",
        updateOffer: "تحديث العرض",
        createOfferAction: "إنشاء العرض",
        savedMatches: "مطابقات مواقع العيادات المحفوظة",
        loadingUsers: "جارٍ تحميل المستخدمين...",
        noMatches: "لا توجد مواقع عيادات محفوظة تطابق هذا العرض حاليًا.",
        cairoTime: "تستخدم جميع التواريخ والأوقات توقيت القاهرة.",
      }
    : {
        zonesTab: "Delivery Zones",
        offersTab: "Delivery Offers",
        zoneDefinition: "A geographic clinic-delivery area, such as New Cairo.",
        offerDefinition: "A scheduled service or shipping benefit assigned to selected delivery zones.",
        addOffer: "Add offer",
        createZone: "Create delivery zone",
        editZone: "Edit delivery zone",
        createOffer: "Create delivery offer",
        editOffer: "Edit delivery offer",
        noZones: "No delivery zones yet.",
        noOffers: "No delivery offers yet.",
        name: "Zone",
        customers: "Customers",
        linkedOffers: "Linked offers",
        offer: "Offer",
        schedule: "Schedule",
        linkedZones: "Linked zones",
        status: "Status",
        actions: "Actions",
        active: "Active",
        inactive: "Inactive",
        scheduled: "Scheduled",
        checkoutEligible: "Alert + checkout rule eligible",
        alertEligible: "Alert currently eligible",
        cutoff: "Cutoff",
        updateOffer: "Update offer",
        createOfferAction: "Create offer",
        savedMatches: "Saved-clinic location matches",
        loadingUsers: "Loading users...",
        noMatches: "No saved clinic locations currently match this offer.",
        cairoTime: "All dates and times use Cairo time.",
      };

  return (
    <AdminLayout>
      <div className="space-y-7">
        <AdminPageHeader
          title={t("admin.delivery.title", {
            fallback: "Delivery Zones & Offers",
          })}
          description={t("admin.delivery.description", {
            fallback:
              "Manage clinic delivery areas, localized offers, schedules, and Cairo cutoff times.",
          })}
          action={
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setRefreshVersion((value) => value + 1)}
            >
              <RefreshCw size={15} />
              {t("admin.delivery.refresh", { fallback: "Refresh" })}
            </button>
          }
        />

        {loadError && (
          <p className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm text-[#B42318]">
            {loadError}
          </p>
        )}
        {formError && (
          <p className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm text-[#B42318]">
            {formError}
          </p>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "zones" | "offers")}
          dir={language === "ar" ? "rtl" : "ltr"}
          data-admin-delivery-tabs=""
          className="min-w-0"
        >
          <TabsList className="grid h-12 w-full max-w-xl grid-cols-2 rounded-xl border border-[#EFE2BC] bg-white p-1 dark:border-white/10 dark:bg-[#171714]">
            <TabsTrigger value="zones" className="h-9 gap-2 rounded-lg font-bold data-[state=active]:bg-[#FFF3B0] data-[state=active]:text-[#050505] dark:data-[state=active]:bg-[#F9DC5C] dark:data-[state=active]:text-[#050505]">
              <MapPinned size={16} />
              {ui.zonesTab}
            </TabsTrigger>
            <TabsTrigger value="offers" className="h-9 gap-2 rounded-lg font-bold data-[state=active]:bg-[#FFF3B0] data-[state=active]:text-[#050505] dark:data-[state=active]:bg-[#F9DC5C] dark:data-[state=active]:text-[#050505]">
              <Truck size={16} />
              {ui.offersTab}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="zones" className="mt-5 min-w-0 space-y-4" data-admin-delivery-panel="zones">
            <div className="flex flex-col gap-3 rounded-xl border border-[#EFE2BC] bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-[#171714]">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF9E8] text-[#B88A44] dark:bg-[#D4A72C]/10 dark:text-[#F6D85D]">
                  <MapPinned size={19} />
                </span>
                <div>
                  <h2 className="font-black text-[#050505] dark:text-[#F5F1E7]">{ui.zonesTab}</h2>
                  <p className="mt-1 text-sm leading-5 text-[#717182] dark:text-[#CEC8BA]">{ui.zoneDefinition}</p>
                </div>
              </div>
              <button type="button" onClick={openCreateZone} className={primaryButton}>
                <Plus size={15} />
                {t("admin.delivery.addZone", { fallback: "Add zone" })}
              </button>
            </div>

            <AdminTableShell>
              <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
                <thead className="bg-[#FBFAF7] text-xs uppercase tracking-wider text-[#717182]">
                  <tr>
                    <th className="px-4 py-3 text-start">{ui.name}</th>
                    <th className="px-4 py-3 text-start">{ui.customers}</th>
                    <th className="px-4 py-3 text-start">{ui.linkedOffers}</th>
                    <th className="px-4 py-3 text-start">{ui.status}</th>
                    <th className="px-4 py-3 text-end">{ui.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE2BC]">
                  {zones.map((zone) => (
                    <tr key={zone.id}>
                      <td className="px-4 py-4">
                        <p className="font-bold text-[#050505]">{language === "ar" ? zone.nameAr : zone.nameEn}</p>
                        <p className="mt-1 text-xs text-[#717182]">{zone.slug}</p>
                      </td>
                      <td className="px-4 py-4 text-[#717182]">{zone.userCount}</td>
                      <td className="px-4 py-4 text-[#717182]">{zone.offerCount}</td>
                      <td className="px-4 py-4"><AdminStatusBadge tone={zone.isActive ? "green" : "slate"}>{zone.isActive ? ui.active : ui.inactive}</AdminStatusBadge></td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-1 rtl:justify-start">
                          <button type="button" className="rounded-lg p-2 text-[#717182] hover:bg-[#FFF9E8] hover:text-[#050505]" onClick={() => editZone(zone)} aria-label={`${ui.editZone}: ${zone.nameEn}`}><Pencil size={16} /></button>
                          <button type="button" className="rounded-lg p-2 text-[#B42318] hover:bg-[#FFF3F3]" onClick={() => removeZone(zone)} aria-label={`${ui.actions}: ${zone.nameEn}`}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && zones.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-[#717182]">{ui.noZones}</td></tr>}
                </tbody>
              </table>
            </AdminTableShell>
          </TabsContent>

          <Dialog open={isZoneEditorOpen} onOpenChange={(open) => (open ? setIsZoneEditorOpen(true) : closeZoneEditor())}>
            <DialogContent dir={language === "ar" ? "rtl" : "ltr"} data-admin-dialog="delivery-zone-editor" className={`flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-[22px] border-[#EFE2BC] bg-[#FFFEFB] p-0 sm:max-w-[620px] ${language === "ar" ? "[&>button]:left-4 [&>button]:right-auto" : ""}`}>
              <DialogHeader className="shrink-0 border-b border-[#EFE2BC] px-6 pb-5 pt-6 text-start sm:text-start">
                <DialogTitle className="text-2xl font-black">{editingZone ? ui.editZone : ui.createZone}</DialogTitle>
                <DialogDescription>{ui.zoneDefinition}</DialogDescription>
              </DialogHeader>
            <form
              ref={zoneFormRef}
              onSubmit={saveZone}
              noValidate
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="grid min-h-0 min-w-0 flex-1 gap-4 overflow-y-auto overflow-x-hidden px-6 py-5">
              <AdminInput
                id="zone-name-en"
                label={language === "ar" ? "الاسم بالإنجليزية" : "English name"}
                value={zoneForm.nameEn}
                onChange={(event) => {
                  setZoneForm((current) => ({
                    ...current,
                    nameEn: event.target.value,
                  }));
                  setZoneErrors((current) => ({ ...current, nameEn: undefined }));
                }}
                error={zoneErrors.nameEn}
                placeholder="English name"
                required
              />
              <AdminInput
                id="zone-name-ar"
                label={language === "ar" ? "الاسم بالعربية" : "Arabic name"}
                dir="rtl"
                value={zoneForm.nameAr}
                onChange={(event) => {
                  setZoneForm((current) => ({
                    ...current,
                    nameAr: event.target.value,
                  }));
                  setZoneErrors((current) => ({ ...current, nameAr: undefined }));
                }}
                error={zoneErrors.nameAr}
                placeholder="الاسم بالعربية"
                required
              />
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <AdminInput
                  id="zone-slug"
                  label="Slug"
                  value={zoneForm.slug}
                  onChange={(event) => {
                    setZoneForm((current) => ({
                      ...current,
                      slug: event.target.value,
                    }));
                    setZoneErrors((current) => ({ ...current, slug: undefined }));
                  }}
                  error={zoneErrors.slug}
                  placeholder="zone-slug"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
                <input
                  className={inputClass}
                  value={zoneForm.displayOrder}
                  type="number"
                  min="0"
                  onChange={(event) =>
                    setZoneForm((current) => ({
                      ...current,
                      displayOrder: event.target.value,
                    }))
                  }
                  aria-label="Display order"
                />
              </div>
              <AdminCheckbox
                id="zone-active"
                checked={zoneForm.isActive}
                onCheckedChange={(isActive) =>
                  setZoneForm((current) => ({ ...current, isActive }))
                }
                label={t("admin.delivery.active", { fallback: "Active" })}
              />
              </div>
              <DialogFooter className="shrink-0 gap-2 border-t border-[#EFE2BC] bg-[#FFFEFB] px-6 py-4 sm:space-x-0">
                <button type="button" className={secondaryButton} onClick={closeZoneEditor} disabled={isSavingZone}>
                  {t("admin.delivery.cancel", { fallback: "Cancel" })}
                </button>
                <button
                  type="submit"
                  className={primaryButton}
                  disabled={isSavingZone}
                >
                  <Plus size={15} />
                  {editingZone
                    ? t("admin.delivery.updateZone", {
                        fallback: "Update zone",
                      })
                    : t("admin.delivery.addZone", { fallback: "Add zone" })}
                </button>
              </DialogFooter>
            </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isOfferEditorOpen} onOpenChange={(open) => (open ? setIsOfferEditorOpen(true) : closeOfferEditor())}>
            <DialogContent dir={language === "ar" ? "rtl" : "ltr"} data-admin-dialog="delivery-offer-editor" className={`flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-[22px] border-[#EFE2BC] bg-[#FFFEFB] p-0 sm:max-w-[820px] ${language === "ar" ? "[&>button]:left-4 [&>button]:right-auto" : ""}`}>
              <DialogHeader className="shrink-0 border-b border-[#EFE2BC] px-6 pb-5 pt-6 text-start sm:text-start">
                <DialogTitle className="text-2xl font-black">{editingOffer ? ui.editOffer : ui.createOffer}</DialogTitle>
                <DialogDescription>{ui.offerDefinition}</DialogDescription>
              </DialogHeader>
            <form
              ref={offerFormRef}
              onSubmit={saveOffer}
              noValidate
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInput
                  id="delivery-title-en"
                  label={language === "ar" ? "العنوان بالإنجليزية" : "English title"}
                  value={offerForm.titleEn}
                  onChange={(event) => {
                    setOfferForm((current) => ({
                      ...current,
                      titleEn: event.target.value,
                    }));
                    setOfferErrors((current) => ({ ...current, titleEn: undefined }));
                  }}
                  error={offerErrors.titleEn}
                />
                <AdminInput
                  id="delivery-title-ar"
                  label={language === "ar" ? "العنوان بالعربية" : "Arabic title"}
                  dir="rtl"
                  value={offerForm.titleAr}
                  onChange={(event) => {
                    setOfferForm((current) => ({
                      ...current,
                      titleAr: event.target.value,
                    }));
                    setOfferErrors((current) => ({ ...current, titleAr: undefined }));
                  }}
                  error={offerErrors.titleAr}
                  placeholder="العنوان بالعربية"
                  required
                />
                <AdminTextarea
                  id="delivery-description-en"
                  label={language === "ar" ? "الوصف بالإنجليزية" : "English description"}
                  value={offerForm.descriptionEn}
                  onChange={(event) => {
                    setOfferForm((current) => ({
                      ...current,
                      descriptionEn: event.target.value,
                    }));
                    setOfferErrors((current) => ({ ...current, descriptionEn: undefined }));
                  }}
                  error={offerErrors.descriptionEn}
                />
                <AdminTextarea
                  id="delivery-description-ar"
                  label={language === "ar" ? "الوصف بالعربية" : "Arabic description"}
                  dir="rtl"
                  value={offerForm.descriptionAr}
                  onChange={(event) => {
                    setOfferForm((current) => ({
                      ...current,
                      descriptionAr: event.target.value,
                    }));
                    setOfferErrors((current) => ({ ...current, descriptionAr: undefined }));
                  }}
                  error={offerErrors.descriptionAr}
                  placeholder="الوصف بالعربية"
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <AdminSelect
                  id="delivery-offer-type"
                  label={language === "ar" ? "نوع العرض" : "Offer type"}
                  value={offerForm.offerType}
                  onChange={(value) =>
                    setOfferForm((current) => ({
                      ...current,
                      offerType: value as AdminDeliveryOffer["offerType"],
                      discountType: "PERCENTAGE",
                      discountValue: "",
                      minimumOrderAmount: "",
                      appliesToStandard: true,
                      appliesToFast: true,
                    }))
                  }
                  options={[
                    { value: "SAME_DAY_DELIVERY", label: language === "ar" ? "توصيل في نفس اليوم" : "Same-day delivery" },
                    { value: "FREE_DELIVERY", label: language === "ar" ? "توصيل مجاني" : "Free delivery" },
                    { value: "DISCOUNTED_DELIVERY", label: language === "ar" ? "توصيل مخفض" : "Discounted delivery" },
                    { value: "CUSTOM", label: language === "ar" ? "مخصص" : "Custom" },
                  ]}
                />
                <AdminSelect
                  id="delivery-schedule-type"
                  label={language === "ar" ? "نوع الجدول" : "Schedule type"}
                  value={offerForm.recurrenceType}
                  onChange={(value) =>
                    setOfferForm((current) => ({
                      ...current,
                      recurrenceType: value as AdminDeliveryOffer["recurrenceType"],
                    }))
                  }
                  options={[
                    { value: "WEEKLY", label: language === "ar" ? "أسبوعي" : "Weekly" },
                    { value: "SPECIFIC_DATE", label: language === "ar" ? "تاريخ محدد" : "Specific date" },
                    { value: "DATE_RANGE", label: language === "ar" ? "نطاق تاريخ" : "Date range" },
                  ]}
                />
                <AdminInput
                  id="delivery-cutoff-time"
                  type="time"
                  label={language === "ar" ? "موعد الإغلاق بتوقيت القاهرة" : "Cairo cutoff"}
                  optional={language === "ar" ? "اختياري" : "Optional"}
                  value={offerForm.cutoffTime}
                  onChange={(event) =>
                    setOfferForm((current) => ({
                      ...current,
                      cutoffTime: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="rounded-xl border border-[#EFE2BC] bg-[#FFF9E8] px-3.5 py-2.5 text-sm leading-5 text-[#5F5F5F] dark:border-[#D4A72C]/25 dark:bg-[#D4A72C]/10 dark:text-[#CEC8BA]">
                {offerForm.offerType === "SAME_DAY_DELIVERY" && (
                  <p>{language === "ar" ? "يعرض معلومات توفر خدمة التوصيل في نفس اليوم فقط ولا يغيّر رسوم الدفع." : "Service availability and alert only — this does not change checkout shipping."}</p>
                )}
                {offerForm.offerType === "CUSTOM" && (
                  <p>{language === "ar" ? "محتوى معلوماتي فقط حتى يتم تطوير قاعدة دفع مخصصة." : "Informational only until a custom checkout rule is developed."}</p>
                )}
                {offerForm.offerType === "FREE_DELIVERY" && (
                  <p>{language === "ar" ? "يجعل رسوم التوصيل العادي أو السريع المؤهلة صفرًا. الاستلام غير مؤهل." : "Sets eligible Standard or Fast delivery to zero. Pickup is never eligible."}</p>
                )}
                {offerForm.offerType === "DISCOUNTED_DELIVERY" && (
                  <p>{language === "ar" ? "يطبّق أقوى خصم توصيل مؤهل ولا يمكن أن يجعل رسوم التوصيل سالبة." : "Applies the strongest eligible shipping discount and never makes shipping negative."}</p>
                )}
              </div>

              {(offerForm.offerType === "FREE_DELIVERY" || offerForm.offerType === "DISCOUNTED_DELIVERY") && (
                <div className="space-y-4 rounded-xl border border-[#EFE2BC] bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  {offerForm.offerType === "DISCOUNTED_DELIVERY" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AdminSelect
                        id="delivery-discount-type"
                        label={language === "ar" ? "نوع خصم التوصيل" : "Shipping discount type"}
                        value={offerForm.discountType}
                        onChange={(value) => setOfferForm((current) => ({ ...current, discountType: value as "PERCENTAGE" | "FIXED" }))}
                        options={[
                          { value: "PERCENTAGE", label: language === "ar" ? "نسبة مئوية" : "Percentage" },
                          { value: "FIXED", label: language === "ar" ? "مبلغ ثابت" : "Fixed amount" },
                        ]}
                      />
                      <AdminInput
                        id="delivery-discount-value"
                        type="number"
                        min="0.01"
                        step="0.01"
                        label={offerForm.discountType === "PERCENTAGE" ? (language === "ar" ? "النسبة المئوية" : "Percentage") : (language === "ar" ? "قيمة الخصم (جنيه)" : "Discount amount (EGP)")}
                        value={offerForm.discountValue}
                        onChange={(event) => {
                          setOfferForm((current) => ({ ...current, discountValue: event.target.value }));
                          setOfferErrors((current) => ({ ...current, discountValue: undefined }));
                        }}
                        error={offerErrors.discountValue}
                      />
                    </div>
                  )}
                  <AdminInput
                    id="delivery-minimum-order"
                    type="number"
                    min="0"
                    step="0.01"
                    label={language === "ar" ? "الحد الأدنى للطلب (جنيه)" : "Minimum order (EGP)"}
                    optional={language === "ar" ? "اختياري" : "Optional"}
                    value={offerForm.minimumOrderAmount}
                    onChange={(event) => {
                      setOfferForm((current) => ({ ...current, minimumOrderAmount: event.target.value }));
                      setOfferErrors((current) => ({ ...current, minimumOrderAmount: undefined }));
                    }}
                    error={offerErrors.minimumOrderAmount}
                  />
                  <fieldset>
                    <legend className="mb-2 text-xs font-bold text-[#717182]">{language === "ar" ? "طرق التوصيل المؤهلة" : "Eligible delivery methods"}</legend>
                    <div className="flex flex-wrap gap-4">
                      <AdminCheckbox
                        id="delivery-applies-standard"
                        checked={offerForm.appliesToStandard}
                        onCheckedChange={(appliesToStandard) => setOfferForm((current) => ({ ...current, appliesToStandard }))}
                        label={language === "ar" ? "التوصيل العادي" : "Standard delivery"}
                      />
                      <AdminCheckbox
                        id="delivery-applies-fast"
                        checked={offerForm.appliesToFast}
                        onCheckedChange={(appliesToFast) => setOfferForm((current) => ({ ...current, appliesToFast }))}
                        label={language === "ar" ? "التوصيل السريع" : "Fast delivery"}
                      />
                    </div>
                    {offerErrors.appliesToStandard && <p className="mt-2 text-xs font-semibold text-[#B42318]">{offerErrors.appliesToStandard}</p>}
                    <p className="mt-2 text-xs text-[#717182]">{language === "ar" ? "الاستلام من المتجر غير مؤهل دائمًا." : "Pickup is always excluded."}</p>
                  </fieldset>
                </div>
              )}

              <p className="rounded-lg border border-[#EFE2BC] bg-[#FBFAF7] px-3 py-2 text-xs font-semibold text-[#717182] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#CEC8BA]">
                {ui.cairoTime}
              </p>

              {offerForm.recurrenceType === "WEEKLY" && (
                <fieldset>
                  <legend className="mb-2 text-xs font-bold text-[#717182]">
                    Delivery weekdays
                  </legend>
                  <AdminWeekdaySelector
                    id="delivery-weekdays"
                    labels={weekdayLabels}
                    value={offerForm.weekdays}
                    onChange={(weekdays) => {
                      setOfferForm((current) => ({ ...current, weekdays }));
                      setOfferErrors((current) => ({ ...current, weekdays: undefined }));
                    }}
                    error={offerErrors.weekdays}
                  />
                </fieldset>
              )}
              {offerForm.recurrenceType === "SPECIFIC_DATE" && (
                <AdminInput
                  id="delivery-specific-date"
                  type="date"
                  label={language === "ar" ? "تاريخ العرض" : "Offer date"}
                  value={offerForm.specificDate}
                  onChange={(event) => {
                    setOfferForm((current) => ({
                      ...current,
                      specificDate: event.target.value,
                    }));
                    setOfferErrors((current) => ({ ...current, specificDate: undefined }));
                  }}
                  error={offerErrors.specificDate}
                />
              )}
              {offerForm.recurrenceType === "DATE_RANGE" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminInput
                    id="delivery-start-date"
                    type="date"
                    label={language === "ar" ? "تاريخ البداية" : "Start date"}
                    value={offerForm.startDate}
                    onChange={(event) => {
                      setOfferForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }));
                      setOfferErrors((current) => ({ ...current, startDate: undefined }));
                    }}
                    error={offerErrors.startDate}
                  />
                  <AdminInput
                    id="delivery-end-date"
                    type="date"
                    label={language === "ar" ? "تاريخ الانتهاء" : "End date"}
                    value={offerForm.endDate}
                    onChange={(event) => {
                      setOfferForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }));
                      setOfferErrors((current) => ({ ...current, endDate: undefined }));
                    }}
                    error={offerErrors.endDate}
                  />
                </div>
              )}

              <fieldset>
                <AdminMultiSelect
                  id="delivery-zone-ids"
                  label={language === "ar" ? "مناطق التوصيل المؤهلة" : "Eligible delivery zones"}
                  value={offerForm.deliveryZoneIds}
                  onChange={(deliveryZoneIds) => {
                    setOfferForm((current) => ({ ...current, deliveryZoneIds }));
                    setOfferErrors((current) => ({ ...current, deliveryZoneIds: undefined }));
                  }}
                  options={zones.map((zone) => ({
                    value: zone.id,
                    label: language === "ar" ? zone.nameAr : zone.nameEn,
                    searchText: `${zone.nameEn} ${zone.nameAr} ${zone.slug}`,
                  }))}
                  placeholder={language === "ar" ? "اختر مناطق التوصيل" : "Select delivery zones"}
                  searchPlaceholder={language === "ar" ? "ابحث في المناطق" : "Search zones"}
                  emptyText={language === "ar" ? "لا توجد مناطق مطابقة." : "No matching zones."}
                  error={offerErrors.deliveryZoneIds}
                />
              </fieldset>

              <AdminCheckbox
                id="delivery-offer-active"
                checked={offerForm.isActive}
                onCheckedChange={(isActive) =>
                  setOfferForm((current) => ({ ...current, isActive }))
                }
                label={language === "ar" ? "عرض نشط" : "Active offer"}
              />
              </div>
              <DialogFooter className="shrink-0 gap-2 border-t border-[#EFE2BC] bg-[#FFFEFB] px-6 py-4 sm:space-x-0">
                <button type="button" className={secondaryButton} onClick={closeOfferEditor} disabled={isSavingOffer}>
                  {t("admin.delivery.cancel", { fallback: "Cancel" })}
                </button>
                <button
                  type="submit"
                  className={primaryButton}
                  disabled={isSavingOffer}
                >
                  <Truck size={15} />
                  {editingOffer ? ui.updateOffer : ui.createOfferAction}
                </button>
              </DialogFooter>
            </form>
            </DialogContent>
          </Dialog>

          <TabsContent value="offers" className="mt-5 min-w-0 space-y-4" data-admin-delivery-panel="offers">
            <div className="flex flex-col gap-3 rounded-xl border border-[#EFE2BC] bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-[#171714]">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF9E8] text-[#B88A44] dark:bg-[#D4A72C]/10 dark:text-[#F6D85D]"><Truck size={19} /></span>
                <div>
                  <h2 className="font-black text-[#050505] dark:text-[#F5F1E7]">{ui.offersTab}</h2>
                  <p className="mt-1 text-sm leading-5 text-[#717182] dark:text-[#CEC8BA]">{ui.offerDefinition}</p>
                </div>
              </div>
              <button type="button" onClick={openCreateOffer} className={primaryButton}><Plus size={15} />{ui.addOffer}</button>
            </div>

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FBFAF7] text-xs uppercase tracking-wider text-[#717182]">
              <tr>
                <th className="px-4 py-3 text-start">{ui.offer}</th>
                <th className="px-4 py-3 text-start">{ui.schedule}</th>
                <th className="px-4 py-3 text-start">{ui.linkedZones}</th>
                <th className="px-4 py-3 text-start">{ui.status}</th>
                <th className="px-4 py-3 text-end">{ui.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE2BC]">
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td className="px-4 py-4">
                    <p className="font-bold text-[#050505]">
                      {language === "ar" ? offer.titleAr : offer.titleEn}
                    </p>
                    <p className="mt-1 max-w-md truncate text-xs text-[#717182]">
                      {language === "ar"
                        ? offer.descriptionAr
                        : offer.descriptionEn}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-xs text-[#717182]">
                    {offer.recurrenceType.replaceAll("_", " ")}
                    {offer.cutoffTime && (
                      <span className="block">
                        {ui.cutoff} {offer.cutoffTime} · Cairo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-[#717182]">
                    <span className="mb-1 block font-black text-[#050505] dark:text-[#F5F1E7]">
                      {offer.deliveryZones.length}
                    </span>
                    {offer.deliveryZones
                      .slice(0, 3)
                      .map((zone) =>
                        language === "ar" ? zone.nameAr : zone.nameEn
                      )
                      .join(", ")}
                    {offer.deliveryZones.length > 3 &&
                      ` +${offer.deliveryZones.length - 3}`}
                  </td>
                  <td className="px-4 py-4">
                    <AdminStatusBadge
                      tone={
                        offer.isCurrentlyValid
                          ? "green"
                          : offer.isActive
                            ? "amber"
                            : "slate"
                      }
                    >
                      {offer.isCurrentlyValid
                        ? offer.offerType === "FREE_DELIVERY" || offer.offerType === "DISCOUNTED_DELIVERY"
                          ? ui.checkoutEligible
                          : ui.alertEligible
                        : offer.isActive
                          ? ui.scheduled
                          : ui.inactive}
                    </AdminStatusBadge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-1 rtl:justify-start">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-[#717182] hover:bg-[#FFF9E8] hover:text-[#050505]"
                        onClick={() => openPreview(offer)}
                        aria-label={`Preview saved-clinic location matches for ${offer.titleEn}`}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-[#717182] hover:bg-[#FFF9E8] hover:text-[#050505]"
                        onClick={() => editOffer(offer)}
                        aria-label={`Edit ${offer.titleEn}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-[#B42318] hover:bg-[#FFF3F3]"
                        onClick={() => removeOffer(offer)}
                        aria-label={`Delete ${offer.titleEn}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && offers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-[#717182]"
                  >
                    {ui.noOffers}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTableShell>
          </TabsContent>
        </Tabs>

      <Dialog open={Boolean(previewOffer)} onOpenChange={(open) => !open && setPreviewOffer(null)}>
        <DialogContent dir={language === "ar" ? "rtl" : "ltr"} data-admin-dialog="delivery-eligibility-preview" className={`flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-[22px] border-[#EFE2BC] bg-[#FFFEFB] p-0 sm:max-w-[680px] ${language === "ar" ? "[&>button]:left-4 [&>button]:right-auto" : ""}`}>
          <DialogHeader className="shrink-0 border-b border-[#EFE2BC] px-6 pb-5 pt-6 text-start sm:text-start">
            <DialogTitle className="text-xl font-black">{ui.savedMatches}</DialogTitle>
            <DialogDescription>{previewOffer ? (language === "ar" ? previewOffer.titleAr : previewOffer.titleEn) : ""}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
            {previewError && (
              <p className="text-sm text-[#B42318]">{previewError}</p>
            )}
            {eligibleUsers === null && !previewError ? (
              <p className="text-sm text-[#717182]">{ui.loadingUsers}</p>
            ) : (
              <div className="space-y-2">
                {eligibleUsers?.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-lg border border-[#EFE2BC] p-3"
                  >
                    <p className="font-bold text-[#050505]">{user.name}</p>
                    <p className="text-xs text-[#717182]">{user.email}</p>
                    <p className="mt-1 text-xs font-semibold text-[#B88A44]">
                      {user.matchedLocations
                        .map((location) =>
                          language === "ar"
                            ? location.nameAr
                            : location.nameEn
                        )
                        .join(", ")}
                    </p>
                  </div>
                ))}
                {eligibleUsers?.length === 0 && (
                  <p className="py-8 text-center text-sm text-[#717182]">
                    {ui.noMatches}
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </AdminLayout>
  );
}
