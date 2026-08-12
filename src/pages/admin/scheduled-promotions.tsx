import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Archive,
  CalendarClock,
  Eye,
  ImageOff,
  Pause,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import { ApiError } from "@/services/http";
import {
  archiveAdminScheduledPromotion,
  createAdminScheduledPromotion,
  getAdminScheduledPromotions,
  updateAdminScheduledPromotion,
  type PromotionDisplayPlacement,
  type PromotionScheduleType,
  type PromotionStatus,
  type PromotionType,
  type ScheduledPromotion,
  type ScheduledPromotionInput,
} from "@/services/scheduledPromotions";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminLayout } from "./_components/AdminLayout";
import {
  AdminPageHeader,
  AdminStatusPill,
  AdminTableShell,
} from "./_components/admin-ui";
import {
  AdminCheckbox,
  AdminFieldLabel,
  AdminFormError,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminWeekdaySelector,
} from "./_components/admin-form";

type PromotionForm = {
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  badgeEn: string;
  badgeAr: string;
  imageUrl: string;
  promotionType: PromotionType;
  discountPercent: string;
  discountAmount: string;
  couponCode: string;
  minimumOrderAmount: string;
  targetUrl: string;
  buttonTextEn: string;
  buttonTextAr: string;
  scheduleType: PromotionScheduleType;
  weekdays: number[];
  startAt: string;
  endAt: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  displayPlacement: PromotionDisplayPlacement;
  priority: string;
  isDismissible: boolean;
  isActive: boolean;
  status: PromotionStatus;
};

type FormErrors = Partial<Record<keyof PromotionForm, string>>;

const EMPTY_FORM: PromotionForm = {
  titleEn: "",
  titleAr: "",
  descriptionEn: "",
  descriptionAr: "",
  badgeEn: "",
  badgeAr: "",
  imageUrl: "",
  promotionType: "INFORMATIONAL",
  discountPercent: "",
  discountAmount: "",
  couponCode: "",
  minimumOrderAmount: "",
  targetUrl: "",
  buttonTextEn: "",
  buttonTextAr: "",
  scheduleType: "WEEKLY_RECURRING",
  weekdays: [],
  startAt: "",
  endAt: "",
  startTime: "",
  endTime: "",
  allDay: true,
  displayPlacement: "POPUP",
  priority: "0",
  isDismissible: true,
  isActive: true,
  status: "DRAFT",
};

const copy = {
  en: {
    nav: "Scheduled Promotions",
    title: "Scheduled Promotions",
    description:
      "Create bilingual promotions that appear automatically by date, weekday, time, and display placement.",
    add: "Add promotion",
    refresh: "Refresh",
    loading: "Loading scheduled promotions...",
    empty: "No scheduled promotions have been created yet.",
    loadError: "Scheduled promotions could not be loaded.",
    created: "Promotion created successfully.",
    updated: "Promotion updated successfully.",
    archived: "Promotion archived.",
    saveError: "The promotion could not be saved.",
    editorTitle: "Promotion editor",
    editorDescription:
      "All schedule evaluation uses Africa/Cairo. Preview the localized content before activation.",
    edit: "Edit",
    archive: "Archive",
    preview: "Preview",
    content: "Content",
    benefit: "Benefit",
    schedule: "Schedule",
    display: "Display",
    status: "Status",
    titleEn: "English title",
    titleAr: "Arabic title",
    descriptionEn: "English description",
    descriptionAr: "Arabic description",
    badgeEn: "English badge",
    badgeAr: "Arabic badge",
    imageUrl: "Image URL",
    targetUrl: "CTA destination",
    buttonTextEn: "English CTA text",
    buttonTextAr: "Arabic CTA text",
    optional: "Optional",
    promotionType: "Benefit type",
    discountPercent: "Discount percentage",
    discountAmount: "Discount amount (EGP)",
    couponCode: "Coupon code",
    minimumOrderAmount: "Minimum order amount (EGP)",
    scheduleType: "Schedule type",
    weekdays: "Weekdays",
    date: "Promotion date",
    startDate: "Start date",
    endDate: "End date",
    startTime: "Start time",
    endTime: "End time",
    allDay: "All day",
    allDayHint: "The promotion runs for the full selected day in Africa/Cairo.",
    scheduleSummary: "Schedule summary",
    displayPlacement: "Display placement",
    priority: "Priority",
    dismissible: "User can dismiss",
    dismissibleHint:
      "Dismissal applies only to the current occurrence, so future weekly occurrences still appear.",
    active: "Enabled",
    activeHint: "Disabled promotions are never returned by the public API.",
    saveDraft: "Save Draft",
    saveDraftHint: "Saves this promotion privately. Drafts are never shown publicly.",
    scheduleAction: "Schedule Promotion",
    scheduleHint: "Uses the selected date, weekday, and time schedule.",
    publishNow: "Publish Now",
    scheduleUnavailableAlways:
      "Always-active promotions do not need a future schedule. Use Publish Now.",
    publishNowHint:
      "Publishes immediately only when this schedule is valid in Africa/Cairo now.",
    pause: "Pause",
    pauseHint: "Hides this promotion without deleting its history.",
    cancel: "Cancel",
    saving: "Saving...",
    previewTitle: "Localized preview",
    previewEmpty: "Add content to preview the promotion.",
    columns: {
      promotion: "Promotion",
      schedule: "Schedule",
      placement: "Placement",
      status: "Status",
      actions: "Actions",
    },
    validation: {
      titleEn: "English title is required.",
      titleAr: "Arabic title is required.",
      descriptionEn: "English description is required.",
      descriptionAr: "Arabic description is required.",
      weekdays: "Select at least one weekday.",
      startAt: "Select a valid start date.",
      endAt: "Select a valid end date.",
      endAfterStart: "End date must be after the start date.",
      startTimeRequired: "Start time is required.",
      endTimeRequired: "End time is required.",
      endTime: "End time must be after the start time.",
      publishNow:
        "Publish Now requires a schedule that is valid in Africa/Cairo right now.",
      percentage: "Enter a valid discount percentage between 1 and 100.",
      amount: "Enter a valid discount amount.",
      coupon: "Enter a valid coupon code.",
      minimumOrder: "Enter a valid minimum order amount.",
      priority: "Priority must be a whole number from 0 to 1000.",
      imageUrl: "Enter a valid image URL.",
      targetUrl: "Enter a valid URL or site path.",
    },
  },
  ar: {
    nav: "العروض المجدولة",
    title: "العروض المجدولة",
    description:
      "أنشئ عروضًا ثنائية اللغة تظهر تلقائيًا حسب التاريخ واليوم والوقت ومكان العرض.",
    add: "إضافة عرض",
    refresh: "تحديث",
    loading: "جارٍ تحميل العروض المجدولة...",
    empty: "لم يتم إنشاء عروض مجدولة بعد.",
    loadError: "تعذر تحميل العروض المجدولة.",
    created: "تم إنشاء العرض بنجاح.",
    updated: "تم تحديث العرض بنجاح.",
    archived: "تمت أرشفة العرض.",
    saveError: "تعذر حفظ العرض.",
    editorTitle: "محرر العرض",
    editorDescription:
      "يتم تقييم جميع الجداول بتوقيت القاهرة. راجع المحتوى المترجم قبل التفعيل.",
    edit: "تعديل",
    archive: "أرشفة",
    preview: "معاينة",
    content: "المحتوى",
    benefit: "الميزة",
    schedule: "الجدول",
    display: "العرض",
    status: "الحالة",
    titleEn: "العنوان باللغة الإنجليزية",
    titleAr: "العنوان باللغة العربية",
    descriptionEn: "الوصف باللغة الإنجليزية",
    descriptionAr: "الوصف باللغة العربية",
    badgeEn: "الشارة باللغة الإنجليزية",
    badgeAr: "الشارة باللغة العربية",
    imageUrl: "رابط الصورة",
    targetUrl: "وجهة زر الإجراء",
    buttonTextEn: "نص الزر بالإنجليزية",
    buttonTextAr: "نص الزر بالعربية",
    optional: "اختياري",
    promotionType: "نوع الميزة",
    discountPercent: "نسبة الخصم",
    discountAmount: "قيمة الخصم (جنيه)",
    couponCode: "كود الخصم",
    minimumOrderAmount: "الحد الأدنى للطلب (جنيه)",
    scheduleType: "نوع الجدول",
    weekdays: "أيام الأسبوع",
    date: "تاريخ العرض",
    startDate: "تاريخ البداية",
    endDate: "تاريخ الانتهاء",
    startTime: "وقت البداية",
    endTime: "وقت الانتهاء",
    allDay: "طوال اليوم",
    allDayHint: "يعمل العرض طوال اليوم المحدد وفق توقيت القاهرة.",
    scheduleSummary: "ملخص الجدول",
    displayPlacement: "مكان العرض",
    priority: "الأولوية",
    dismissible: "يمكن للمستخدم إغلاقه",
    dismissibleHint:
      "يتم الإغلاق للظهور الحالي فقط، لذلك تظهر التكرارات الأسبوعية المستقبلية.",
    active: "مفعّل",
    activeHint: "العروض غير المفعلة لا يعيدها الـ API العام.",
    saveDraft: "حفظ كمسودة",
    saveDraftHint: "يحفظ العرض بشكل خاص. لا تظهر المسودات للعامة.",
    scheduleAction: "جدولة العرض",
    scheduleHint: "يستخدم التاريخ وأيام الأسبوع والأوقات المحددة.",
    publishNow: "نشر الآن",
    scheduleUnavailableAlways:
      "العروض النشطة دائمًا لا تحتاج إلى جدول مستقبلي. استخدم «نشر الآن».",
    publishNowHint:
      "يتم النشر فورًا فقط عندما يكون الجدول صالحًا الآن وفق توقيت القاهرة.",
    pause: "إيقاف مؤقت",
    pauseHint: "يخفي العرض دون حذف سجله.",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ...",
    previewTitle: "معاينة المحتوى",
    previewEmpty: "أضف المحتوى لمعاينة العرض.",
    columns: {
      promotion: "العرض",
      schedule: "الجدول",
      placement: "مكان العرض",
      status: "الحالة",
      actions: "الإجراءات",
    },
    validation: {
      titleEn: "العنوان باللغة الإنجليزية مطلوب.",
      titleAr: "العنوان باللغة العربية مطلوب.",
      descriptionEn: "الوصف باللغة الإنجليزية مطلوب.",
      descriptionAr: "الوصف باللغة العربية مطلوب.",
      weekdays: "اختر يومًا واحدًا على الأقل.",
      startAt: "اختر تاريخ بداية صالحًا.",
      endAt: "اختر تاريخ انتهاء صالحًا.",
      endAfterStart: "يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء.",
      startTimeRequired: "وقت البداية مطلوب.",
      endTimeRequired: "وقت الانتهاء مطلوب.",
      endTime: "يجب أن يكون وقت الانتهاء بعد وقت البدء.",
      publishNow:
        "يتطلب «نشر الآن» جدولًا صالحًا في الوقت الحالي وفق توقيت القاهرة.",
      percentage: "أدخل نسبة خصم صحيحة من 1 إلى 100.",
      amount: "أدخل قيمة خصم صحيحة.",
      coupon: "أدخل كود خصم صالحًا.",
      minimumOrder: "أدخل حدًا أدنى صالحًا للطلب.",
      priority: "يجب أن تكون الأولوية رقمًا صحيحًا من 0 إلى 1000.",
      imageUrl: "أدخل رابط صورة صالحًا.",
      targetUrl: "أدخل رابطًا أو مسار موقع صالحًا.",
    },
  },
} as const;

const promotionTypeOptions: Array<{ value: PromotionType; en: string; ar: string }> = [
  { value: "INFORMATIONAL", en: "Informational only", ar: "معلومات فقط" },
  { value: "PERCENTAGE_DISCOUNT", en: "Percentage discount", ar: "خصم بنسبة" },
  { value: "FIXED_DISCOUNT", en: "Fixed discount", ar: "خصم بقيمة ثابتة" },
  { value: "COUPON", en: "Coupon code", ar: "كود خصم" },
  { value: "FREE_DELIVERY", en: "Free delivery", ar: "توصيل مجاني" },
  { value: "CUSTOM", en: "Custom", ar: "مخصص" },
];
const promotionBehaviorCopy: Record<PromotionType, { en: string; ar: string }> = {
  INFORMATIONAL: {
    en: "This promotion displays campaign content and does not change checkout totals.",
    ar: "يعرض هذا العرض محتوى الحملة ولا يغيّر إجماليات الدفع.",
  },
  PERCENTAGE_DISCOUNT: {
    en: "Applies automatically at checkout while this promotion is active.",
    ar: "يُطبّق تلقائيًا عند الدفع أثناء نشاط هذا العرض.",
  },
  FIXED_DISCOUNT: {
    en: "Applies automatically at checkout while this promotion is active.",
    ar: "يُطبّق تلقائيًا عند الدفع أثناء نشاط هذا العرض.",
  },
  COUPON: {
    en: "Customers must enter this code before checkout.",
    ar: "يجب على العملاء إدخال هذا الكود قبل الدفع.",
  },
  FREE_DELIVERY: {
    en: "Applies automatically to eligible Standard and Fast delivery.",
    ar: "يُطبّق تلقائيًا على التوصيل العادي والسريع المؤهل.",
  },
  CUSTOM: {
    en: "This promotion displays campaign content and does not change checkout totals.",
    ar: "يعرض هذا العرض محتوى الحملة ولا يغيّر إجماليات الدفع.",
  },
};
const scheduleTypeOptions: Array<{ value: PromotionScheduleType; en: string; ar: string }> = [
  { value: "ONE_TIME_DATE", en: "One-time date", ar: "تاريخ لمرة واحدة" },
  { value: "DATE_RANGE", en: "Date range", ar: "نطاق تاريخ" },
  { value: "WEEKLY_RECURRING", en: "Weekly recurring", ar: "تكرار أسبوعي" },
  { value: "ALWAYS_ACTIVE", en: "Always active", ar: "نشط دائمًا" },
];
const placementOptions: Array<{ value: PromotionDisplayPlacement; en: string; ar: string }> = [
  { value: "ANNOUNCEMENT_BANNER", en: "Announcement banner", ar: "شريط إعلان" },
  { value: "NOTIFICATION_CENTER", en: "Notification center", ar: "مركز الإشعارات" },
  { value: "HOMEPAGE_PROMOTION_CARD", en: "Homepage promotion card", ar: "بطاقة عرض بالصفحة الرئيسية" },
  { value: "ACCOUNT_DASHBOARD", en: "Account dashboard", ar: "لوحة حساب العميل" },
  { value: "POPUP", en: "Popup", ar: "نافذة منبثقة" },
];

const statusVariant = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  ACTIVE: "success",
  PAUSED: "paused",
  EXPIRED: "error",
  ARCHIVED: "archived",
} as const;

const statusLabels: Record<PromotionStatus, { en: string; ar: string }> = {
  DRAFT: { en: "Draft", ar: "مسودة" },
  SCHEDULED: { en: "Scheduled", ar: "مجدول" },
  ACTIVE: { en: "Active", ar: "نشط" },
  PAUSED: { en: "Paused", ar: "متوقف مؤقتًا" },
  EXPIRED: { en: "Expired", ar: "منتهي" },
  ARCHIVED: { en: "Archived", ar: "مؤرشف" },
};

function toForm(promotion: ScheduledPromotion): PromotionForm {
  return {
    titleEn: promotion.titleEn,
    titleAr: promotion.titleAr,
    descriptionEn: promotion.descriptionEn,
    descriptionAr: promotion.descriptionAr,
    badgeEn: promotion.badgeEn ?? "",
    badgeAr: promotion.badgeAr ?? "",
    imageUrl: promotion.imageUrl ?? "",
    promotionType: promotion.promotionType,
    discountPercent: promotion.discountPercent?.toString() ?? "",
    discountAmount: promotion.discountAmount?.toString() ?? "",
    couponCode: promotion.couponCode ?? "",
    minimumOrderAmount: promotion.minimumOrderAmount?.toString() ?? "",
    targetUrl: promotion.targetUrl ?? "",
    buttonTextEn: promotion.buttonTextEn ?? "",
    buttonTextAr: promotion.buttonTextAr ?? "",
    scheduleType: promotion.scheduleType,
    weekdays: promotion.weekdays,
    startAt: promotion.startAt ?? "",
    endAt: promotion.endAt ?? "",
    startTime: promotion.startTime ?? "",
    endTime: promotion.endTime ?? "",
    allDay: !promotion.startTime && !promotion.endTime,
    displayPlacement: promotion.displayPlacement,
    priority: promotion.priority.toString(),
    isDismissible: promotion.isDismissible,
    isActive: promotion.isActive,
    status: promotion.storedStatus,
  };
}

function nullableNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

function isValidLink(value: string) {
  if (!value.trim()) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function cairoClock() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );
  const weekdayByName: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdayByName[parts.weekday],
    time: `${parts.hour}:${parts.minute}`,
  };
}

function isFormScheduleCurrent(form: PromotionForm) {
  const now = cairoClock();
  if (form.scheduleType === "ALWAYS_ACTIVE") return true;
  if (
    form.scheduleType === "WEEKLY_RECURRING" &&
    !form.weekdays.includes(now.weekday)
  ) {
    return false;
  }
  if (
    form.scheduleType === "ONE_TIME_DATE" &&
    form.startAt !== now.date
  ) {
    return false;
  }
  if (form.scheduleType === "DATE_RANGE") {
    if (!form.startAt || !form.endAt || !form.startTime || !form.endTime) {
      return false;
    }
    return (
      `${now.date}T${now.time}` >= `${form.startAt}T${form.startTime}` &&
      `${now.date}T${now.time}` < `${form.endAt}T${form.endTime}`
    );
  }
  return (
    form.allDay ||
    Boolean(
      form.startTime &&
      form.endTime &&
      now.time >= form.startTime &&
      now.time < form.endTime
    )
  );
}

export default function AdminScheduledPromotionsPage() {
  const { language } = useLanguage();
  const text = copy[language];
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [promotions, setPromotions] = useState<ScheduledPromotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledPromotion | null>(null);
  const [form, setForm] = useState<PromotionForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const weekdayLabels = useMemo(
    () =>
      language === "ar"
        ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    [language]
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    getAdminScheduledPromotions(controller.signal)
      .then(setPromotions)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : text.loadError);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [refreshVersion, text.loadError]);

  const optionsFor = <T extends string>(
    options: Array<{ value: T; en: string; ar: string }>
  ) =>
    options.map((option) => ({
      value: option.value,
      label: option[language],
    }));

  const update = <K extends keyof PromotionForm>(
    field: K,
    value: PromotionForm[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const updatePromotionType = (promotionType: PromotionType) => {
    setForm((current) => ({
      ...current,
      promotionType,
      discountPercent:
        promotionType === "PERCENTAGE_DISCOUNT" ? current.discountPercent : "",
      discountAmount:
        promotionType === "FIXED_DISCOUNT" ? current.discountAmount : "",
      couponCode: promotionType === "COUPON" ? current.couponCode : "",
      minimumOrderAmount:
        promotionType === "INFORMATIONAL" || promotionType === "CUSTOM"
          ? ""
          : current.minimumOrderAmount,
    }));
    setErrors((current) => ({
      ...current,
      promotionType: undefined,
      discountPercent: undefined,
      discountAmount: undefined,
      couponCode: undefined,
      minimumOrderAmount: undefined,
    }));
    setFormError(null);
  };

  const updateScheduleType = (value: PromotionScheduleType) => {
    setForm((current) => ({
      ...current,
      scheduleType: value,
      allDay:
        value === "DATE_RANGE"
          ? false
          : value === "ALWAYS_ACTIVE"
            ? true
            : current.allDay,
      startTime: value === "ALWAYS_ACTIVE" ? "" : current.startTime,
      endTime: value === "ALWAYS_ACTIVE" ? "" : current.endTime,
    }));
    setErrors((current) => ({
      ...current,
      scheduleType: undefined,
      startTime: undefined,
      endTime: undefined,
    }));
    setFormError(null);
  };

  const updateAllDay = (value: boolean) => {
    setForm((current) => ({
      ...current,
      allDay: value,
      startTime: value ? "" : current.startTime,
      endTime: value ? "" : current.endTime,
    }));
    setErrors((current) => ({
      ...current,
      startTime: undefined,
      endTime: undefined,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError(null);
    setShowPreview(false);
    setIsEditorOpen(true);
  };

  const openEdit = (promotion: ScheduledPromotion) => {
    setEditing(promotion);
    setForm(toForm(promotion));
    setErrors({});
    setFormError(null);
    setShowPreview(false);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    if (isSaving) return;
    setIsEditorOpen(false);
    setEditing(null);
    setErrors({});
    setFormError(null);
    setShowPreview(false);
  };

  const focusFirstError = () => {
    window.requestAnimationFrame(() => {
      const invalid = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]'
      );
      const target =
        invalid?.matches("input, textarea, button")
          ? invalid
          : invalid?.querySelector<HTMLElement>("input, textarea, button");
      target?.focus();
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const validate = (targetStatus: PromotionStatus) => {
    const next: FormErrors = {};
    const requiresSchedule =
      targetStatus === "SCHEDULED" || targetStatus === "ACTIVE";
    if (!form.titleEn.trim()) next.titleEn = text.validation.titleEn;
    if (!form.titleAr.trim()) next.titleAr = text.validation.titleAr;
    if (!form.descriptionEn.trim())
      next.descriptionEn = text.validation.descriptionEn;
    if (!form.descriptionAr.trim())
      next.descriptionAr = text.validation.descriptionAr;
    if (
      requiresSchedule &&
      form.scheduleType === "WEEKLY_RECURRING" &&
      form.weekdays.length === 0
    ) {
      next.weekdays = text.validation.weekdays;
    }
    if (
      requiresSchedule &&
      (form.scheduleType === "ONE_TIME_DATE" ||
        form.scheduleType === "DATE_RANGE") &&
      !form.startAt
    ) {
      next.startAt = text.validation.startAt;
    }
    if (requiresSchedule && form.scheduleType === "DATE_RANGE") {
      if (!form.endAt) {
        next.endAt = text.validation.endAt;
      }
      if (!form.startTime) next.startTime = text.validation.startTimeRequired;
      if (!form.endTime) next.endTime = text.validation.endTimeRequired;
      if (
        form.startAt &&
        form.endAt &&
        form.startTime &&
        form.endTime &&
        `${form.endAt}T${form.endTime}` <=
          `${form.startAt}T${form.startTime}`
      ) {
        next.endAt = text.validation.endAfterStart;
      }
    }
    if (
      requiresSchedule &&
      (form.scheduleType === "WEEKLY_RECURRING" ||
        form.scheduleType === "ONE_TIME_DATE") &&
      !form.allDay
    ) {
      if (!form.startTime) next.startTime = text.validation.startTimeRequired;
      if (!form.endTime) next.endTime = text.validation.endTimeRequired;
    }
    if (
      requiresSchedule &&
      form.scheduleType !== "DATE_RANGE" &&
      form.startTime &&
      form.endTime &&
      form.endTime <= form.startTime
    ) {
      next.endTime = text.validation.endTime;
    }
    if (
      targetStatus === "ACTIVE" &&
      requiresSchedule &&
      !isFormScheduleCurrent(form)
    ) {
      next.scheduleType = text.validation.publishNow;
    }
    if (
      form.promotionType === "PERCENTAGE_DISCOUNT" &&
      (!Number.isFinite(Number(form.discountPercent)) ||
        Number(form.discountPercent) < 1 ||
        Number(form.discountPercent) > 100)
    ) {
      next.discountPercent = text.validation.percentage;
    }
    if (
      form.promotionType === "FIXED_DISCOUNT" &&
      (!Number.isFinite(Number(form.discountAmount)) ||
        Number(form.discountAmount) <= 0)
    ) {
      next.discountAmount = text.validation.amount;
    }
    if (
      form.promotionType === "COUPON" &&
      !/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(form.couponCode.trim())
    ) {
      next.couponCode = text.validation.coupon;
    }
    if (
      form.minimumOrderAmount.trim() &&
      (!Number.isFinite(Number(form.minimumOrderAmount)) ||
        Number(form.minimumOrderAmount) < 0)
    ) {
      next.minimumOrderAmount = text.validation.minimumOrder;
    }
    const priority = Number(form.priority);
    if (
      !Number.isInteger(priority) ||
      priority < 0 ||
      priority > 1000
    ) {
      next.priority = text.validation.priority;
    }
    if (!isValidLink(form.imageUrl)) next.imageUrl = text.validation.imageUrl;
    if (!isValidLink(form.targetUrl))
      next.targetUrl = text.validation.targetUrl;
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError();
      return false;
    }
    return true;
  };

  const buildInput = (status: PromotionStatus): ScheduledPromotionInput => ({
    titleEn: form.titleEn.trim(),
    titleAr: form.titleAr.trim(),
    descriptionEn: form.descriptionEn.trim(),
    descriptionAr: form.descriptionAr.trim(),
    badgeEn: form.badgeEn.trim() || null,
    badgeAr: form.badgeAr.trim() || null,
    imageUrl: form.imageUrl.trim() || null,
    promotionType: form.promotionType,
    discountPercent:
      form.promotionType === "PERCENTAGE_DISCOUNT"
        ? nullableNumber(form.discountPercent)
        : null,
    discountAmount:
      form.promotionType === "FIXED_DISCOUNT"
        ? nullableNumber(form.discountAmount)
        : null,
    couponCode:
      form.promotionType === "COUPON"
        ? form.couponCode.trim().toUpperCase()
        : null,
    minimumOrderAmount:
      form.promotionType === "INFORMATIONAL" || form.promotionType === "CUSTOM"
        ? null
        : nullableNumber(form.minimumOrderAmount),
    targetUrl: form.targetUrl.trim() || null,
    buttonTextEn: form.buttonTextEn.trim() || null,
    buttonTextAr: form.buttonTextAr.trim() || null,
    scheduleType: form.scheduleType,
    weekdays:
      form.scheduleType === "WEEKLY_RECURRING" ? form.weekdays : [],
    startAt:
      form.scheduleType === "ONE_TIME_DATE" ||
      form.scheduleType === "DATE_RANGE"
        ? form.startAt || null
        : null,
    endAt:
      form.scheduleType === "DATE_RANGE" ? form.endAt || null : null,
    startTime:
      form.scheduleType === "ALWAYS_ACTIVE" ||
      ((form.scheduleType === "WEEKLY_RECURRING" ||
        form.scheduleType === "ONE_TIME_DATE") &&
        form.allDay)
        ? null
        : form.startTime || null,
    endTime:
      form.scheduleType === "ALWAYS_ACTIVE" ||
      ((form.scheduleType === "WEEKLY_RECURRING" ||
        form.scheduleType === "ONE_TIME_DATE") &&
        form.allDay)
        ? null
        : form.endTime || null,
    displayPlacement: form.displayPlacement,
    priority: Number(form.priority),
    isDismissible: form.isDismissible,
    status,
    isActive: status === "ACTIVE" || status === "SCHEDULED",
  });

  const save = async (status: PromotionStatus) => {
    if (!validate(status)) return;
    setIsSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateAdminScheduledPromotion(editing.id, buildInput(status));
        toast({ title: text.updated });
      } else {
        await createAdminScheduledPromotion(buildInput(status));
        toast({ title: text.created });
      }
      setIsEditorOpen(false);
      setEditing(null);
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.field &&
        error.field in EMPTY_FORM
      ) {
        setErrors((current) => ({
          ...current,
          [error.field as keyof PromotionForm]: error.message,
        }));
        focusFirstError();
      } else {
        setFormError(error instanceof Error ? error.message : text.saveError);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const archive = async (promotion: ScheduledPromotion) => {
    const confirmed = window.confirm(
      language === "ar"
        ? `أرشفة "${promotion.titleAr}"؟`
        : `Archive "${promotion.titleEn}"?`
    );
    if (!confirmed) return;
    try {
      await archiveAdminScheduledPromotion(promotion.id);
      toast({ title: text.archived });
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : text.saveError);
    }
  };

  const formatSchedule = (promotion: ScheduledPromotion) => {
    const timezone = promotion.timezone || "Africa/Cairo";
    const formatDate = (value: string | null) =>
      value
        ? new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }).format(new Date(`${value}T00:00:00Z`))
        : "—";
    const formatTime = (value: string | null) =>
      value
        ? new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          }).format(new Date(`2000-01-01T${value}:00Z`))
        : "";
    const allDay = language === "ar" ? "طوال اليوم" : "All day";
    const separator = language === "ar" ? " — " : " — ";
    if (promotion.scheduleType === "ALWAYS_ACTIVE") {
      return `${language === "ar" ? "نشط دائمًا" : "Always active"}${separator}${timezone}`;
    }
    if (promotion.scheduleType === "WEEKLY_RECURRING") {
      const days = promotion.weekdays.map((day) => weekdayLabels[day]).join(
        language === "ar" ? "، " : ", "
      );
      const window =
        !promotion.startTime && !promotion.endTime
          ? allDay
          : `${formatTime(promotion.startTime)} – ${formatTime(promotion.endTime)}`;
      return `${language === "ar" ? "كل" : "Every"} ${days}${separator}${window}${separator}${timezone}`;
    }
    if (promotion.scheduleType === "ONE_TIME_DATE") {
      const window =
        !promotion.startTime && !promotion.endTime
          ? allDay
          : `${formatTime(promotion.startTime)} – ${formatTime(promotion.endTime)}`;
      return `${formatDate(promotion.startAt)}${separator}${window}${separator}${timezone}`;
    }
    return `${formatDate(promotion.startAt)} ${formatTime(promotion.startTime)} – ${formatDate(promotion.endAt)} ${formatTime(promotion.endTime)}${separator}${timezone}`;
  };

  const formScheduleSummary = formatSchedule({
    ...({
      scheduleType: form.scheduleType,
      weekdays: form.weekdays,
      startAt: form.startAt || null,
      endAt: form.endAt || null,
      startTime: form.allDay ? null : form.startTime || null,
      endTime: form.allDay ? null : form.endTime || null,
      timezone: "Africa/Cairo",
    } as ScheduledPromotion),
  });

  const localizedPreview = {
    title: language === "ar" ? form.titleAr : form.titleEn,
    description:
      language === "ar" ? form.descriptionAr : form.descriptionEn,
    badge: language === "ar" ? form.badgeAr : form.badgeEn,
    button: language === "ar" ? form.buttonTextAr : form.buttonTextEn,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title={text.title}
          description={text.description}
          action={
            <button
              type="button"
              onClick={openCreate}
              className="xd-gradient-primary-button inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold"
            >
              <Plus size={16} />
              {text.add}
            </button>
          }
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setRefreshVersion((value) => value + 1)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-bold text-[#717182] hover:bg-[#FFF9E8]"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            {text.refresh}
          </button>
        </div>

        {loadError && (
          <p
            role="alert"
            className="rounded-xl border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]"
          >
            {loadError}
          </p>
        )}

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 text-start font-bold">
                  {text.columns.promotion}
                </th>
                <th className="px-5 py-3 text-start font-bold">
                  {text.columns.schedule}
                </th>
                <th className="px-5 py-3 text-start font-bold">
                  {text.columns.placement}
                </th>
                <th className="px-5 py-3 text-start font-bold">
                  {text.columns.status}
                </th>
                <th className="px-5 py-3 text-end font-bold">
                  {text.columns.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {promotions.map((promotion) => (
                <tr key={promotion.id}>
                  <td className="min-w-[260px] px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#EFE2BC] bg-[#FFF9E8]">
                        {promotion.imageUrl ? (
                          <img
                            src={promotion.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Sparkles size={18} className="text-[#B88A44]" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#050505]">
                          {language === "ar"
                            ? promotion.titleAr
                            : promotion.titleEn}
                        </p>
                        <p className="mt-1 text-xs text-[#717182]">
                          {promotion.promotionType.replaceAll("_", " ")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="min-w-[180px] px-5 py-4 text-[#717182]">
                    <p className="font-semibold text-[#050505]">
                      {formatSchedule(promotion)}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-[#717182]">
                    {promotion.displayPlacement.replaceAll("_", " ")}
                  </td>
                  <td className="px-5 py-4">
                    <AdminStatusPill variant={statusVariant[promotion.status]}>
                      {statusLabels[promotion.status][language]}
                    </AdminStatusPill>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(promotion)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#050505]/10 bg-white px-3 text-xs font-bold hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6]"
                      >
                        <Pencil size={13} />
                        {text.edit}
                      </button>
                      {promotion.status !== "ARCHIVED" && (
                        <button
                          type="button"
                          onClick={() => void archive(promotion)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#F2C8C8] bg-white px-3 text-xs font-bold text-[#B42318] hover:bg-[#FFF3F3]"
                        >
                          <Archive size={13} />
                          {text.archive}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && promotions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#717182]">
                    {text.loading}
                  </td>
                </tr>
              )}
              {!isLoading && !loadError && promotions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <CalendarClock
                      size={30}
                      className="mx-auto text-[#D4A72C]"
                    />
                    <p className="mt-3 text-sm font-semibold text-[#717182]">
                      {text.empty}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </div>

      <Dialog open={isEditorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-[24px] border-[#EFE2BC] bg-[#FFFEFB] p-0 sm:max-w-[920px]">
          <DialogHeader className="shrink-0 border-b border-[#EFE2BC] px-6 pb-5 pt-6">
            <DialogTitle className="text-2xl font-black">
              {text.editorTitle}
            </DialogTitle>
            <DialogDescription>{text.editorDescription}</DialogDescription>
          </DialogHeader>

          <form
            ref={formRef}
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void save("SCHEDULED");
            }}
            noValidate
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 min-w-0 flex-1 space-y-7 overflow-y-auto overflow-x-hidden px-6 py-5">
            <section>
              <h3 className="text-base font-black text-[#050505]">
                {text.content}
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AdminInput
                  id="titleEn"
                  label={text.titleEn}
                  value={form.titleEn}
                  onChange={(event) => update("titleEn", event.target.value)}
                  error={errors.titleEn}
                  dir="ltr"
                />
                <AdminInput
                  id="titleAr"
                  label={text.titleAr}
                  value={form.titleAr}
                  onChange={(event) => update("titleAr", event.target.value)}
                  error={errors.titleAr}
                  dir="rtl"
                />
                <AdminTextarea
                  id="descriptionEn"
                  label={text.descriptionEn}
                  value={form.descriptionEn}
                  onChange={(event) =>
                    update("descriptionEn", event.target.value)
                  }
                  error={errors.descriptionEn}
                  dir="ltr"
                />
                <AdminTextarea
                  id="descriptionAr"
                  label={text.descriptionAr}
                  value={form.descriptionAr}
                  onChange={(event) =>
                    update("descriptionAr", event.target.value)
                  }
                  error={errors.descriptionAr}
                  dir="rtl"
                />
                <AdminInput
                  id="badgeEn"
                  label={text.badgeEn}
                  optional={text.optional}
                  value={form.badgeEn}
                  onChange={(event) => update("badgeEn", event.target.value)}
                />
                <AdminInput
                  id="badgeAr"
                  label={text.badgeAr}
                  optional={text.optional}
                  value={form.badgeAr}
                  onChange={(event) => update("badgeAr", event.target.value)}
                  dir="rtl"
                />
                <AdminInput
                  id="imageUrl"
                  label={text.imageUrl}
                  optional={text.optional}
                  value={form.imageUrl}
                  onChange={(event) => update("imageUrl", event.target.value)}
                  error={errors.imageUrl}
                  wrapperClassName="sm:col-span-2"
                />
                <AdminInput
                  id="targetUrl"
                  label={text.targetUrl}
                  optional={text.optional}
                  value={form.targetUrl}
                  onChange={(event) => update("targetUrl", event.target.value)}
                  error={errors.targetUrl}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminInput
                    id="buttonTextEn"
                    label={text.buttonTextEn}
                    optional={text.optional}
                    value={form.buttonTextEn}
                    onChange={(event) =>
                      update("buttonTextEn", event.target.value)
                    }
                  />
                  <AdminInput
                    id="buttonTextAr"
                    label={text.buttonTextAr}
                    optional={text.optional}
                    value={form.buttonTextAr}
                    onChange={(event) =>
                      update("buttonTextAr", event.target.value)
                    }
                    dir="rtl"
                  />
                </div>
              </div>
            </section>

            <section className="border-t border-[#EFE2BC] pt-6">
              <h3 className="text-base font-black text-[#050505]">
                {text.benefit}
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AdminSelect
                  id="promotionType"
                  label={text.promotionType}
                  value={form.promotionType}
                  onChange={(value) => updatePromotionType(value as PromotionType)}
                  options={optionsFor(promotionTypeOptions)}
                />
                <p className="self-end rounded-xl border border-[#EFE2BC] bg-[#FFF9E8] px-3.5 py-2.5 text-sm leading-5 text-[#5F5F5F] dark:border-[#D4A72C]/25 dark:bg-[#D4A72C]/10 dark:text-[#CEC8BA]">
                  {promotionBehaviorCopy[form.promotionType][language]}
                </p>
                {form.promotionType === "PERCENTAGE_DISCOUNT" && (
                  <AdminInput
                    id="discountPercent"
                    type="number"
                    min="1"
                    max="100"
                    step="0.01"
                    label={text.discountPercent}
                    value={form.discountPercent}
                    onChange={(event) =>
                      update("discountPercent", event.target.value)
                    }
                    error={errors.discountPercent}
                  />
                )}
                {form.promotionType === "FIXED_DISCOUNT" && (
                  <AdminInput
                    id="discountAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    label={text.discountAmount}
                    value={form.discountAmount}
                    onChange={(event) =>
                      update("discountAmount", event.target.value)
                    }
                    error={errors.discountAmount}
                  />
                )}
                {form.promotionType === "COUPON" && (
                  <AdminInput
                    id="couponCode"
                    label={text.couponCode}
                    value={form.couponCode}
                    onChange={(event) =>
                      update("couponCode", event.target.value.toUpperCase())
                    }
                    error={errors.couponCode}
                  />
                )}
                {form.promotionType !== "INFORMATIONAL" && form.promotionType !== "CUSTOM" && (
                  <AdminInput
                    id="minimumOrderAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    label={text.minimumOrderAmount}
                    optional={text.optional}
                    value={form.minimumOrderAmount}
                    onChange={(event) =>
                      update("minimumOrderAmount", event.target.value)
                    }
                    error={errors.minimumOrderAmount}
                  />
                )}
              </div>
              <div className="mt-4 space-y-1.5 rounded-lg border border-[#EFE2BC] bg-[#FBFAF7] px-3.5 py-2.5 text-xs font-semibold leading-5 text-[#717182] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#CEC8BA]">
                <p>
                  {language === "ar"
                    ? "يتحكم الموضع في مكان ظهور الحملة. تعتمد أهلية الدفع على جدول العرض وقواعده."
                    : "Placement controls where the campaign appears. Checkout eligibility is based on the promotion schedule and rules."}
                </p>
                <p>
                  {language === "ar"
                    ? "تستخدم جميع التواريخ والأوقات توقيت القاهرة."
                    : "All dates and times use Cairo time."}
                </p>
              </div>
            </section>

            <section className="border-t border-[#EFE2BC] pt-6">
              <h3 className="text-base font-black text-[#050505]">
                {text.schedule}
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AdminSelect
                  id="scheduleType"
                  label={text.scheduleType}
                  value={form.scheduleType}
                  onChange={(value) =>
                    updateScheduleType(value as PromotionScheduleType)
                  }
                  options={optionsFor(scheduleTypeOptions)}
                  error={errors.scheduleType}
                  wrapperClassName="sm:col-span-2"
                />
                {form.scheduleType === "WEEKLY_RECURRING" && (
                  <div className="sm:col-span-2">
                    <AdminFieldLabel>{text.weekdays}</AdminFieldLabel>
                    <div className="mt-2">
                      <AdminWeekdaySelector
                        id="weekdays"
                        labels={weekdayLabels}
                        value={form.weekdays}
                        onChange={(value) => update("weekdays", value)}
                        error={errors.weekdays}
                      />
                    </div>
                  </div>
                )}
                {form.scheduleType === "ONE_TIME_DATE" && (
                  <AdminInput
                    id="startAt"
                    type="date"
                    label={text.date}
                    value={form.startAt}
                    onChange={(event) => update("startAt", event.target.value)}
                    error={errors.startAt}
                    wrapperClassName="sm:col-span-2"
                  />
                )}
                {form.scheduleType === "DATE_RANGE" && (
                  <>
                    <AdminInput
                      id="startAt"
                      type="date"
                      label={text.startDate}
                      value={form.startAt}
                      onChange={(event) =>
                        update("startAt", event.target.value)
                      }
                      error={errors.startAt}
                    />
                    <AdminInput
                      id="endAt"
                      type="date"
                      label={text.endDate}
                      value={form.endAt}
                      onChange={(event) => update("endAt", event.target.value)}
                      error={errors.endAt}
                    />
                  </>
                )}
                {(form.scheduleType === "WEEKLY_RECURRING" ||
                  form.scheduleType === "ONE_TIME_DATE") && (
                  <div className="sm:col-span-2">
                    <AdminCheckbox
                      id="allDay"
                      checked={form.allDay}
                      onCheckedChange={updateAllDay}
                      label={text.allDay}
                      description={text.allDayHint}
                    />
                  </div>
                )}
                {form.scheduleType !== "ALWAYS_ACTIVE" &&
                  (form.scheduleType === "DATE_RANGE" || !form.allDay) && (
                    <>
                      <AdminInput
                        id="startTime"
                        type="time"
                        label={text.startTime}
                        value={form.startTime}
                        onChange={(event) =>
                          update("startTime", event.target.value)
                        }
                        error={errors.startTime}
                      />
                      <AdminInput
                        id="endTime"
                        type="time"
                        label={text.endTime}
                        value={form.endTime}
                        onChange={(event) =>
                          update("endTime", event.target.value)
                        }
                        error={errors.endTime}
                      />
                    </>
                  )}
                <div data-admin-schedule-summary="" className="sm:col-span-2 rounded-[14px] border border-[#EFE2BC] bg-[#FFFDF6] p-4 dark:border-[#D4A72C]/25 dark:bg-[#1C1B16]">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#B88A44] dark:text-[#F6D85D]">
                    {text.scheduleSummary}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#050505] dark:text-[#F5F1E7]">
                    {formScheduleSummary}
                  </p>
                </div>
              </div>
            </section>

            <section className="border-t border-[#EFE2BC] pt-6">
              <h3 className="text-base font-black text-[#050505]">
                {text.display}
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AdminSelect
                  id="displayPlacement"
                  label={text.displayPlacement}
                  value={form.displayPlacement}
                  onChange={(value) =>
                    update(
                      "displayPlacement",
                      value as PromotionDisplayPlacement
                    )
                  }
                  options={optionsFor(placementOptions)}
                />
                <AdminInput
                  id="priority"
                  type="number"
                  min="0"
                  max="1000"
                  step="1"
                  label={text.priority}
                  value={form.priority}
                  onChange={(event) => update("priority", event.target.value)}
                  error={errors.priority}
                />
                <AdminCheckbox
                  id="isDismissible"
                  checked={form.isDismissible}
                  onCheckedChange={(value) => update("isDismissible", value)}
                  label={text.dismissible}
                  description={text.dismissibleHint}
                />
              </div>
            </section>

            {showPreview && (
              <section className="border-t border-[#EFE2BC] pt-6">
                <h3 className="text-base font-black text-[#050505]">
                  {text.previewTitle}
                </h3>
                <div className="mt-4 overflow-hidden rounded-[20px] border border-[#EFE2BC] bg-white shadow-sm">
                  {form.imageUrl ? (
                    <img
                      src={form.imageUrl}
                      alt=""
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-20 place-items-center bg-[#FFF9E8]">
                      <ImageOff size={22} className="text-[#B88A44]" />
                    </div>
                  )}
                  <div className="p-5">
                    {localizedPreview.badge && (
                      <span className="rounded-full border border-[#E7C85D]/60 bg-[#FFF7D6] px-3 py-1 text-xs font-black text-[#765600]">
                        {localizedPreview.badge}
                      </span>
                    )}
                    <h4 className="mt-3 text-xl font-black text-[#050505]">
                      {localizedPreview.title || text.previewEmpty}
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-[#717182]">
                      {localizedPreview.description}
                    </p>
                    {localizedPreview.button && form.targetUrl && (
                      <span className="mt-4 inline-flex h-10 items-center rounded-full bg-[#F9DC5C] px-5 text-sm font-black">
                        {localizedPreview.button}
                      </span>
                    )}
                  </div>
                </div>
              </section>
            )}

            {formError && (
              <AdminFormError className="rounded-xl border border-[#F2C8C8] bg-[#FFF3F3] p-3">
                {formError}
              </AdminFormError>
            )}
            </div>

            <DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-[#EFE2BC] bg-[#FFFEFB] px-6 py-4 sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (validate("DRAFT")) setShowPreview((current) => !current);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-bold text-[#717182] hover:bg-[#FFF9E8]"
                >
                  <Eye size={15} />
                  {text.preview}
                </button>
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={isSaving}
                  className="h-10 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-bold text-[#717182]"
                >
                  {text.cancel}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void save("DRAFT")}
                  title={text.saveDraftHint}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#050505]/10 bg-white px-4 text-sm font-bold hover:bg-[#FBFAF7] disabled:opacity-50"
                >
                  <Save size={15} />
                  {text.saveDraft}
                </button>
                {editing && editing.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void save("PAUSED")}
                    title={text.pauseHint}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E5C98D] bg-[#FFF9E8] px-4 text-sm font-bold text-[#8A6511] disabled:opacity-50"
                  >
                    <Pause size={15} />
                    {text.pause}
                  </button>
                )}
                {form.scheduleType !== "ALWAYS_ACTIVE" ? (
                  <button
                    type="submit"
                    disabled={isSaving}
                    title={text.scheduleHint}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#D4A72C]/50 bg-[#FFF3B0] px-4 text-sm font-bold text-[#6F5000] disabled:opacity-50"
                  >
                    <CalendarClock size={15} />
                    {text.scheduleAction}
                  </button>
                ) : (
                  <p className="max-w-56 self-center text-xs leading-5 text-[#717182]">
                    {text.scheduleUnavailableAlways}
                  </p>
                )}
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void save("ACTIVE")}
                  title={text.publishNowHint}
                  className="xd-gradient-primary-button inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-black disabled:opacity-50"
                >
                  <Send size={15} />
                  {isSaving ? text.saving : text.publishNow}
                </button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
