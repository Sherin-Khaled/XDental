import { Router } from "express";
import {
  getPublicBrands,
  getPublicCategories,
  getPublicCategoryTree,
  getPublicProduct,
  getPublicProducts,
} from "../controllers/catalog.controller.js";
import { getPublicHeroSlides } from "../controllers/heroSlide.controller.js";
import { getPublicFlashSale } from "../controllers/flashSale.controller.js";

const router = Router();

router.get("/products", getPublicProducts);
router.get("/products/:identifier", getPublicProduct);
router.get("/categories", getPublicCategories);
router.get("/categories/tree", getPublicCategoryTree);
router.get("/brands", getPublicBrands);
router.get("/hero-slides", getPublicHeroSlides);
router.get("/flash-sale", getPublicFlashSale);

export default router;
