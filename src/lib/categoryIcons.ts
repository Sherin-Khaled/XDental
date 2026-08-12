import {
  Activity,
  BookOpen,
  Disc,
  Droplet,
  FileText,
  FlaskConical,
  Hexagon,
  MonitorCog,
  Pill,
  Scissors,
  ScanLine,
  Shield,
  ShoppingBag,
  Smile,
  Syringe,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type CategoryIcon = LucideIcon;

export const DEFAULT_CATEGORY_ICON = ShoppingBag;

export const categoryIconMap: Record<string, LucideIcon> = {
  all: ShoppingBag,
  endodontics: Activity,
  "composites-bonding": Droplet,
  restorative: Droplet,
  "restorative-materials": Droplet,
  prosthodontics: Smile,
  pedodontics: Smile,
  orthodontics: Smile,
  "hand-instruments": Wrench,
  instruments: Wrench,
  "dental-instruments": Wrench,
  "sterilization-disposables": ShoppingBag,
  "sterilization-material": Shield,
  "disposable-material": ShoppingBag,
  consumables: ShoppingBag,
  disposables: ShoppingBag,
  equipment: Hexagon,
  machines: MonitorCog,
  "machine-inquiries": MonitorCog,
  surgery: Scissors,
  implantology: Pill,
  "infection-control": Shield,
  "clinic-essentials": FileText,
  "impression-materials": FileText,
  whitening: Zap,
  periodontics: Wind,
  "radiology-imaging": ScanLine,
  radiology: ScanLine,
  anesthesia: Syringe,
  "burs-rotary": Disc,
  burs: Disc,
  "dental-burs": Disc,
  laboratories: FlaskConical,
  "lab-supplies": FlaskConical,
  "oral-care-system": Smile,
  "online-courses": BookOpen,
  books: BookOpen,
  // Category-tree main slugs (owner Excel)
  "perio-surgery": Scissors,
  equipments: MonitorCog,
  implant: Pill,
  "dental-lab": FlaskConical,
  bleaching: Zap,
  "burs-stones": Disc,
};

function normalizeCategoryIconKey(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getCategoryIcon(slug: string | null | undefined, name?: string | null) {
  const slugKey = normalizeCategoryIconKey(slug);
  const nameKey = normalizeCategoryIconKey(name);
  return categoryIconMap[slugKey] ?? categoryIconMap[nameKey] ?? DEFAULT_CATEGORY_ICON;
}
