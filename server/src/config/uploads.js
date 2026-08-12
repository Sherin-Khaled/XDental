import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const PROFILE_IMAGE_DIRECTORY = path.resolve(
  currentDirectory,
  "../../uploads/profile-images"
);
export const PROFILE_IMAGE_PUBLIC_PREFIX = "/api/uploads/profile-images";

export const PRODUCT_IMAGE_DIRECTORY = path.resolve(
  currentDirectory,
  "../../uploads/product-images"
);
export const PRODUCT_IMAGE_PUBLIC_PREFIX = "/api/uploads/product-images";

export const HERO_IMAGE_DIRECTORY = path.resolve(
  currentDirectory,
  "../../uploads/hero-slides"
);
export const HERO_IMAGE_PUBLIC_PREFIX = "/api/uploads/hero-slides";
