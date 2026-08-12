import type { Language } from "@/context/LanguageContext";

export type PromotionalFlyer = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
};

const FLYER_WIDTH = 1672;
const FLYER_HEIGHT = 941;

export const PROMOTIONAL_FLYERS: Record<Language, PromotionalFlyer[]> = {
  en: [
    {
      id: "flyer-1-en",
      src: "hero%20section/flyer1English.png",
      alt: "Equip your clinic with confidence using trusted dental supplies from X Dental Store.",
      width: FLYER_WIDTH,
      height: FLYER_HEIGHT,
    },
    {
      id: "flyer-2-en",
      src: "hero%20section/flyer2English.png",
      alt: "X Dental Store promotional flyer featuring flexible plans and dental equipment.",
      width: FLYER_WIDTH,
      height: FLYER_HEIGHT,
    },
  ],
  ar: [
    {
      id: "flyer-1-ar",
      src: "hero%20section/flyer1Arabic.png",
      alt: "جهّز عيادتك بثقة مع مستلزمات أسنان موثوقة من X Dental Store.",
      width: FLYER_WIDTH,
      height: FLYER_HEIGHT,
    },
    {
      id: "flyer-2-ar",
      src: "hero%20section/flyer2Arabic.png",
      alt: "نشرة ترويجية من X Dental Store تعرض خيارات مرنة ومعدات لعيادات الأسنان.",
      width: FLYER_WIDTH,
      height: FLYER_HEIGHT,
    },
  ],
};
