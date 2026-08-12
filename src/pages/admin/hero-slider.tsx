import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Eye, ImagePlus, Pencil, RefreshCw, Save, Send, Trash2 } from "lucide-react";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusPill } from "./_components/admin-ui";
import {
  AdminCheckbox,
  AdminFormError,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from "./_components/admin-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HeroSlider } from "@/components/dental/hero-slider/HeroSlider";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { ApiError, resolveApiAssetUrl } from "@/services/http";
import {
  getAdminHeroSlides,
  publishHeroSlide,
  saveHeroSlideDraft,
  uploadHeroImage,
  type AdminHeroSlide,
  type HeroSlideDraftInput,
} from "@/services/heroSlidesAdmin";
import type { HeroSlide } from "@/types/heroSlide";

type FormErrors = Partial<Record<
  "headlineEn" | "headlineAr" | "desktopImageUrl" | "primaryButtonUrl" | "primaryButtonText",
  string
>>;

const copy = {
  en: {
    title: "Hero Slider",
    description: "Manage the three bilingual Home page Hero slots. Drafts stay private until you publish them.",
    edit: "Edit",
    preview: "Preview",
    active: "Active",
    inactive: "Inactive",
    draft: "Draft",
    published: "Published",
    updated: "Updated",
    loading: "Loading Hero slides…",
    refresh: "Refresh",
    editor: "Edit Hero slide",
    editorHelp: "Recommended desktop ratio: 16:9 (about 1672 × 941 px). JPEG, PNG, or WebP; maximum 5 MB.",
    content: "Bilingual content",
    buttons: "Buttons",
    images: "Responsive images",
    settings: "Settings",
    saveDraft: "Save Draft",
    publish: "Publish Changes",
    cancel: "Cancel",
    previewDraft: "Draft preview",
    previewHelp: "This uses the real Home Hero component. Previewing never publishes the draft.",
  },
  ar: {
    title: "السلايدر الرئيسي",
    description: "إدارة الشرائح الثلاث ثنائية اللغة في الصفحة الرئيسية. تبقى المسودات خاصة حتى نشرها.",
    edit: "تعديل",
    preview: "معاينة",
    active: "نشط",
    inactive: "غير نشط",
    draft: "مسودة",
    published: "منشور",
    updated: "آخر تحديث",
    loading: "جارٍ تحميل الشرائح…",
    refresh: "تحديث",
    editor: "تعديل شريحة",
    editorHelp: "النسبة المقترحة لسطح المكتب 16:9 (حوالي 1672 × 941). JPEG أو PNG أو WebP، بحد أقصى 5 م.ب.",
    content: "المحتوى ثنائي اللغة",
    buttons: "الأزرار",
    images: "الصور المتجاوبة",
    settings: "الإعدادات",
    saveDraft: "حفظ المسودة",
    publish: "نشر التغييرات",
    cancel: "إلغاء",
    previewDraft: "معاينة المسودة",
    previewHelp: "تستخدم المعاينة مكوّن الصفحة الرئيسية الحقيقي ولا تنشر المسودة.",
  },
};

function editable(slide: AdminHeroSlide): HeroSlide {
  return structuredClone(slide.draft ?? slide.published);
}

function toInput(slide: HeroSlide): HeroSlideDraftInput {
  const { id: _id, order, isActive, countdownTo: _countdownTo, ...content } = slide;
  return { order, isActive, content };
}

function formatDate(value: string, language: "en" | "ar") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function validateFile(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (file.size > 5 * 1024 * 1024) return "Hero images must be 5 MB or smaller.";
  return "";
}

function ImageUploader({
  label,
  value,
  optional,
  onChange,
}: {
  label: string;
  value: string;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const kind = optional ? "mobile" : "desktop";

  const processFile = async (file?: File) => {
    if (!file) return;
    const fileError = validateFile(file);
    if (fileError) return setError(fileError);
    setError("");
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const ratio = image.naturalWidth / image.naturalHeight;
      setWarning(ratio < 1.55 || ratio > 1.95 ? "This image is outside the recommended 16:9 range and may crop more than expected." : "");
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
    setUploading(true);
    try {
      const result = await uploadHeroImage(file, kind);
      onChange(result.imageUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void processFile(event.dataTransfer.files[0]);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[#050505]">{label}</p>
        {optional && value && (
          <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs font-bold text-[#B42318]">
            <Trash2 size={13} /> Remove
          </button>
        )}
      </div>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
        className="mt-2 overflow-hidden rounded-[16px] border border-dashed border-[#D4A72C]/55 bg-[#FFFDF6] p-3"
      >
        {value && (
          <img
            src={resolveApiAssetUrl(value) ?? value}
            alt=""
            className="mb-3 aspect-video w-full rounded-xl bg-[#F2EFE6] object-cover"
          />
        )}
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#EFE2BC] bg-white px-4 text-sm font-bold text-[#6F5000] transition hover:border-[#D4A72C]"
        >
          <ImagePlus size={17} />
          {uploading ? "Uploading…" : value ? "Replace image" : "Upload or drop image"}
        </button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => void processFile(event.target.files?.[0])}
        />
      </div>
      <AdminFormError>{error}</AdminFormError>
      {warning && <p className="mt-1.5 text-xs font-semibold text-[#9A6C00]">{warning}</p>}
    </div>
  );
}

export default function AdminHeroSliderPage() {
  const { language, setLanguage } = useLanguage();
  const text = copy[language];
  const { toast } = useToast();
  const [slides, setSlides] = useState<AdminHeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<AdminHeroSlide | null>(null);
  const [form, setForm] = useState<HeroSlide | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const load = async () => {
    setLoading(true);
    try {
      setSlides(await getAdminHeroSlides());
    } catch (error) {
      toast({ title: "Hero Slider", description: error instanceof Error ? error.message : "Slides could not be loaded.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openEditor = (slide: AdminHeroSlide) => {
    setEditor(slide);
    setForm(editable(slide));
    setErrors({});
  };

  const update = (recipe: (next: HeroSlide) => void) => {
    setForm((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      recipe(next);
      return next;
    });
  };

  const localErrors = (publishing: boolean) => {
    if (!form) return {};
    const next: FormErrors = {};
    if (publishing && !form.headline.en.trim()) next.headlineEn = "English title is required.";
    if (publishing && !form.headline.ar.trim()) next.headlineAr = "Arabic title is required.";
    if (publishing && !form.image.src) next.desktopImageUrl = "A desktop Hero image is required.";
    if ((form.primaryCta.label.en || form.primaryCta.label.ar) && !form.primaryCta.href.trim()) {
      next.primaryButtonUrl = "Enter a destination for the primary button.";
    }
    if (publishing && (!form.primaryCta.label.en.trim() || !form.primaryCta.label.ar.trim())) {
      next.primaryButtonText = "Primary button text is required in both languages.";
    }
    return next;
  };

  const persist = async (publish: boolean) => {
    if (!form || !editor) return;
    const nextErrors = localErrors(publish);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const saved = publish
        ? await publishHeroSlide(editor.id, toInput(form))
        : await saveHeroSlideDraft(editor.id, toInput(form));
      setSlides((current) => current.map((item) => item.id === saved.id ? saved : item));
      setEditor(null);
      setForm(null);
      toast({ title: publish ? "Hero slide published" : "Draft saved", description: publish ? "The Home page now uses this version." : "Public visitors still see the published version." });
      if (publish) void load();
    } catch (error) {
      toast({ title: "Hero slide", description: error instanceof ApiError ? error.message : "The slide could not be saved.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const previewSlide = useMemo(() => form ? [{ ...form, isActive: true }] : [], [form]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-7">
        <AdminPageHeader
          title={text.title}
          description={text.description}
          action={
            <button type="button" onClick={() => void load()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-bold">
              <RefreshCw size={16} /> {text.refresh}
            </button>
          }
        />

        {loading ? (
          <div className="rounded-2xl border border-[#EFE2BC] bg-white p-10 text-center text-sm font-semibold text-[#717182]">{text.loading}</div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-3">
            {slides.map((slide) => {
              const shown = slide.draft ?? slide.published;
              return (
                <article key={slide.id} className="overflow-hidden rounded-[22px] border border-[#EFE2BC] bg-white shadow-sm">
                  <img src={resolveApiAssetUrl(shown.image.src) ?? shown.image.src} alt="" className="aspect-video w-full bg-[#F2EFE6] object-cover" />
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#050505] px-3 py-1 text-xs font-black text-white">Slide {slide.slotNumber}</span>
                      <AdminStatusPill variant={shown.isActive ? "success" : "paused"}>{shown.isActive ? text.active : text.inactive}</AdminStatusPill>
                      <AdminStatusPill variant={slide.status === "DRAFT" ? "draft" : "success"}>{slide.status === "DRAFT" ? text.draft : text.published}</AdminStatusPill>
                    </div>
                    <h2 className="mt-4 line-clamp-2 text-lg font-black text-[#050505]">{shown.headline.en || "Untitled draft"}</h2>
                    <p dir="rtl" className="mt-2 line-clamp-2 text-right text-sm font-bold text-[#717182]">{shown.headline.ar || "مسودة بدون عنوان"}</p>
                    <p className="mt-4 text-xs font-semibold text-[#8A8D9A]">{text.updated}: {formatDate(slide.updatedAt, language)}</p>
                    <div className="mt-5 flex gap-2">
                      <button type="button" onClick={() => openEditor(slide)} className="xd-gradient-primary-button inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold">
                        <Pencil size={15} /> {text.edit}
                      </button>
                      <button type="button" onClick={() => { openEditor(slide); setPreviewOpen(true); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D4A72C]/45 px-4 text-sm font-bold">
                        <Eye size={15} /> {text.preview}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-5xl flex-col overflow-hidden rounded-[24px] border-[#EFE2BC] bg-[#FFFEFB] p-0">
          <DialogHeader className="border-b border-[#EFE2BC] px-6 py-5">
            <DialogTitle>{text.editor} {editor?.slotNumber}</DialogTitle>
            <DialogDescription>{text.editorHelp}</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
              <section>
                <h3 className="mb-4 text-lg font-black">{text.content}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminInput label="Eyebrow — English" value={form.badgeText.en} maxLength={80} onChange={(e) => update((x) => { x.badgeText.en = e.target.value; })} />
                  <AdminInput label="Eyebrow — العربية" dir="rtl" value={form.badgeText.ar} maxLength={80} onChange={(e) => update((x) => { x.badgeText.ar = e.target.value; })} />
                  <AdminInput label="Main title — English" value={form.headline.en} error={errors.headlineEn} maxLength={120} onChange={(e) => update((x) => { x.headline.en = e.target.value; })} />
                  <AdminInput label="العنوان الرئيسي — العربية" dir="rtl" value={form.headline.ar} error={errors.headlineAr} maxLength={120} onChange={(e) => update((x) => { x.headline.ar = e.target.value; })} />
                  <AdminTextarea label="Description — English" value={form.subtext.en} maxLength={420} onChange={(e) => update((x) => { x.subtext.en = e.target.value; })} />
                  <AdminTextarea label="الوصف — العربية" dir="rtl" value={form.subtext.ar} maxLength={420} onChange={(e) => update((x) => { x.subtext.ar = e.target.value; })} />
                </div>
              </section>
              <section>
                <h3 className="mb-4 text-lg font-black">{text.buttons}</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <AdminInput label="Primary text — English" value={form.primaryCta.label.en} error={errors.primaryButtonText} onChange={(e) => update((x) => { x.primaryCta.label.en = e.target.value; })} />
                  <AdminInput label="النص الأساسي — العربية" dir="rtl" value={form.primaryCta.label.ar} onChange={(e) => update((x) => { x.primaryCta.label.ar = e.target.value; })} />
                  <AdminInput label="Primary destination" value={form.primaryCta.href} error={errors.primaryButtonUrl} placeholder="/products" onChange={(e) => update((x) => { x.primaryCta.href = e.target.value; })} />
                  <AdminInput label="Secondary text — English" value={form.secondaryCta?.label.en ?? ""} onChange={(e) => update((x) => { x.secondaryCta ??= { label: { en: "", ar: "" }, href: "" }; x.secondaryCta.label.en = e.target.value; })} />
                  <AdminInput label="النص الثانوي — العربية" dir="rtl" value={form.secondaryCta?.label.ar ?? ""} onChange={(e) => update((x) => { x.secondaryCta ??= { label: { en: "", ar: "" }, href: "" }; x.secondaryCta.label.ar = e.target.value; })} />
                  <AdminInput label="Secondary destination" value={form.secondaryCta?.href ?? ""} placeholder="/contact" onChange={(e) => update((x) => { x.secondaryCta ??= { label: { en: "", ar: "" }, href: "" }; x.secondaryCta.href = e.target.value; })} />
                </div>
              </section>
              <section>
                <h3 className="mb-4 text-lg font-black">{text.images}</h3>
                <div className="grid gap-5 md:grid-cols-2">
                  <ImageUploader label="Desktop Hero image" value={form.image.src} onChange={(value) => update((x) => { x.image.src = value; })} />
                  <ImageUploader label="Mobile Hero image (optional)" value={form.mobileImage?.src ?? ""} optional onChange={(value) => update((x) => { x.mobileImage = value ? { src: value } : null; })} />
                  <AdminFormError>{errors.desktopImageUrl}</AdminFormError>
                  <div />
                  <AdminInput label="Image alt text — English" value={form.image.alt.en} onChange={(e) => update((x) => { x.image.alt.en = e.target.value; })} />
                  <AdminInput label="النص البديل — العربية" dir="rtl" value={form.image.alt.ar} onChange={(e) => update((x) => { x.image.alt.ar = e.target.value; })} />
                </div>
              </section>
              <section>
                <h3 className="mb-4 text-lg font-black">{text.settings}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminSelect id="hero-position" label="Slide position" value={String(form.order)} onChange={(value) => update((x) => { x.order = Number(value); })} options={[1, 2, 3].map((value) => ({ value: String(value), label: `Position ${value}` }))} />
                  <AdminCheckbox id="hero-active" checked={form.isActive} onCheckedChange={(checked) => update((x) => { x.isActive = checked; })} label="Active on Home page" description="Inactive slides remain editable but are excluded from the public slider after publish." />
                </div>
              </section>
            </div>
          )}
          <DialogFooter className="flex-wrap border-t border-[#EFE2BC] px-6 py-4 sm:justify-between">
            <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D4A72C]/45 px-4 text-sm font-bold"><Eye size={16} /> {text.preview}</button>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditor(null)} className="h-10 rounded-xl border border-[#EFE2BC] px-4 text-sm font-bold">{text.cancel}</button>
              <button disabled={saving} type="button" onClick={() => void persist(false)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D4A72C] px-4 text-sm font-bold"><Save size={16} /> {text.saveDraft}</button>
              <button disabled={saving} type="button" onClick={() => void persist(true)} className="xd-gradient-primary-button inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold"><Send size={16} /> {text.publish}</button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-6xl overflow-y-auto rounded-[24px] border-[#EFE2BC] bg-[var(--xd-bg)]">
          <DialogHeader>
            <DialogTitle>{text.previewDraft}</DialogTitle>
            <DialogDescription>{text.previewHelp}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <button type="button" onClick={() => setLanguage("en")} className={`rounded-full px-4 py-2 text-sm font-bold ${language === "en" ? "bg-[#F9DC5C] text-black" : "border border-[#D4A72C]/40"}`}>English</button>
            <button type="button" onClick={() => setLanguage("ar")} className={`rounded-full px-4 py-2 text-sm font-bold ${language === "ar" ? "bg-[#F9DC5C] text-black" : "border border-[#D4A72C]/40"}`}>العربية</button>
          </div>
          <div className="mt-3">{previewSlide.length > 0 && <HeroSlider slides={previewSlide} />}</div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
