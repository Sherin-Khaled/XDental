import { apiRequest } from "./http";
import type { HeroSlide } from "@/types/heroSlide";

export type AdminHeroSlide = {
  id: string;
  slotNumber: number;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  updatedAt: string;
  published: HeroSlide & { slotNumber: number };
  draft: (HeroSlide & { slotNumber: number }) | null;
};

export type HeroSlideDraftInput = {
  order: number;
  isActive: boolean;
  content: Omit<HeroSlide, "id" | "order" | "isActive" | "countdownTo">;
};

export async function getAdminHeroSlides(signal?: AbortSignal) {
  const result = await apiRequest<{ slides: AdminHeroSlide[] }>("/admin/hero-slides", { signal });
  return result.slides;
}

export async function saveHeroSlideDraft(id: string, input: HeroSlideDraftInput) {
  const result = await apiRequest<{ slide: AdminHeroSlide }>(
    `/admin/hero-slides/${encodeURIComponent(id)}/draft`,
    { method: "PUT", body: JSON.stringify(input) }
  );
  return result.slide;
}

export async function publishHeroSlide(id: string, input: HeroSlideDraftInput) {
  const result = await apiRequest<{ slide: AdminHeroSlide }>(
    `/admin/hero-slides/${encodeURIComponent(id)}/publish`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.slide;
}

export async function uploadHeroImage(file: File, kind: "desktop" | "mobile") {
  return apiRequest<{ imageUrl: string }>("/admin/hero-images", {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
      "X-Hero-Image-Kind": kind,
    },
  });
}
