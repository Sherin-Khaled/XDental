import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  ChevronDown,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { resolveApiAssetUrl } from "@/services/http";
import { cn } from "@/lib/utils";

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProductImageUploaderProps = {
  value: string;
  file: File | null;
  error?: string;
  isUploading: boolean;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
  onValueChange: (value: string) => void;
  onError: (message?: string) => void;
};

export function ProductImageUploader({
  value,
  file,
  error,
  isUploading,
  disabled = false,
  onFileChange,
  onValueChange,
  onError,
}: ProductImageUploaderProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showExternalUrl, setShowExternalUrl] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setLocalPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [file]);

  const savedPreviewUrl = resolveApiAssetUrl(value);
  const previewUrl = localPreviewUrl ?? savedPreviewUrl;
  const externalValue = /^https?:\/\//i.test(value) ? value : "";

  const openPicker = () => {
    if (!disabled && !isUploading) inputRef.current?.click();
  };

  const chooseFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (!ACCEPTED_IMAGE_TYPES.has(nextFile.type)) {
      onError(t("admin.products.imageUpload.invalidType"));
      return;
    }
    if (nextFile.size > PRODUCT_IMAGE_MAX_BYTES) {
      onError(t("admin.products.imageUpload.tooLarge"));
      return;
    }

    onError(undefined);
    onFileChange(nextFile);
    setShowExternalUrl(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPicker();
  };

  const removeImage = () => {
    onFileChange(null);
    onValueChange("");
    onError(undefined);
    setShowExternalUrl(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="sm:col-span-2">
      <span className="text-sm font-bold text-[#050505]">
        {t("admin.products.imageUpload.label")}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => chooseFile(event.target.files?.[0])}
      />

      <div
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        aria-label={t("admin.products.imageUpload.openPicker")}
        aria-invalid={Boolean(error)}
        onClick={openPicker}
        onKeyDown={handleKeyboard}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && !isUploading) setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={cn(
          "relative mt-2 overflow-hidden rounded-[18px] border bg-white p-4 outline-none transition focus:ring-4",
          error
            ? "border-[#B42318]/55 focus:border-[#B42318] focus:ring-[#B42318]/10"
            : isDragging
              ? "border-[#D4A72C] bg-[#FFF9E8] ring-4 ring-[#D4A72C]/10"
              : "border-[#E8D9AF] hover:border-[#D4A72C] focus:border-[#D4A72C] focus:ring-[#D4A72C]/10",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        {previewUrl ? (
          <div className="grid min-h-[210px] items-center gap-5 sm:grid-cols-[220px_1fr]">
            <div className="flex h-[190px] items-center justify-center overflow-hidden rounded-[14px] border border-[#EFE2BC] bg-[#FBFAF7] p-3">
              <img
                src={previewUrl}
                alt={t("admin.products.imageUpload.previewAlt")}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="py-2">
              <p className="text-base font-bold text-[#050505]">
                {file?.name ?? t("admin.products.imageUpload.currentImage")}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#717182]">
                {file
                  ? t("admin.products.imageUpload.ready")
                  : t("admin.products.imageUpload.saved")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled || isUploading}
                  onClick={(event) => {
                    event.stopPropagation();
                    openPicker();
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E8D9AF] bg-white px-4 text-sm font-semibold text-[#050505] transition hover:border-[#D4A72C] hover:bg-[#FFF9E8] disabled:opacity-60"
                >
                  <RefreshCw size={15} />
                  {t("admin.products.imageUpload.replace")}
                </button>
                <button
                  type="button"
                  disabled={disabled || isUploading}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeImage();
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#F2C8C8] bg-white px-4 text-sm font-semibold text-[#B42318] transition hover:bg-[#FFF3F3] disabled:opacity-60"
                >
                  <Trash2 size={15} />
                  {t("admin.products.imageUpload.remove")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[210px] flex-col items-center justify-center px-5 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3BF] text-[#9B6C12]">
              {isDragging ? <ImagePlus size={25} /> : <UploadCloud size={25} />}
            </span>
            <p className="mt-4 text-base font-bold text-[#050505]">
              {t("admin.products.imageUpload.dropTitle")}
            </p>
            <p className="mt-1.5 max-w-md text-sm leading-6 text-[#717182]">
              {t("admin.products.imageUpload.help")}
            </p>
            <span className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] shadow-sm">
              {t("admin.products.imageUpload.choose")}
            </span>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
            <LoaderCircle className="animate-spin text-[#B88A44]" size={30} />
            <p className="mt-3 text-sm font-bold text-[#050505]">
              {t("admin.products.imageUpload.uploading")}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-[#B42318]">
          {error}
        </p>
      )}

      <button
        type="button"
        aria-expanded={showExternalUrl}
        onClick={() => setShowExternalUrl((current) => !current)}
        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#8A651C] hover:text-[#5F430C]"
      >
        <ChevronDown
          size={15}
          className={cn("transition-transform", showExternalUrl && "rotate-180")}
        />
        {t("admin.products.imageUpload.externalToggle")}
      </button>

      {showExternalUrl && (
        <label htmlFor="product-external-image-url" className="mt-3 block">
          <span className="text-xs font-bold uppercase tracking-wide text-[#717182]">
            {t("admin.products.imageUpload.externalLabel")}
          </span>
          <input
            id="product-external-image-url"
            type="url"
            value={externalValue}
            maxLength={1000}
            disabled={disabled || isUploading}
            placeholder="https://example.com/product.webp"
            onChange={(event) => {
              onFileChange(null);
              onError(undefined);
              onValueChange(event.target.value);
            }}
            className="mt-2 h-[50px] w-full rounded-[14px] border border-[#050505]/10 bg-white px-4 text-sm font-semibold outline-none transition focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10 disabled:opacity-60"
          />
          <p className="mt-1.5 text-xs leading-5 text-[#8A8D9A]">
            {t("admin.products.imageUpload.externalHelp")}
          </p>
        </label>
      )}
    </div>
  );
}
