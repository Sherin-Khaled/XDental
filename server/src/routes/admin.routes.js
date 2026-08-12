import express, { Router, text } from "express";
import {
  getAdminProductRequest,
  getAdminProductRequests,
  updateAdminProductRequestStatus,
} from "../controllers/productRequest.controller.js";
import {
  getAdminOrder,
  getAdminOrders,
  updateAdminOrderPaymentStatus,
  updateAdminOrderStatus,
} from "../controllers/order.controller.js";
import {
  createAdminUser,
  createCustomerBenefit,
  getAdminUser,
  getAdminUsers,
  getPermissionCatalog,
  replaceSupportPermissions,
  updateCustomerBenefit,
  updateCustomerBenefitLifecycle,
  updateCustomerTier,
  updateUserStatus,
} from "../controllers/adminUser.controller.js";
import {
  createAdminBrand,
  deleteAdminBrand,
  getAdminBrands,
  updateAdminBrand,
} from "../controllers/adminBrand.controller.js";
import {
  createAdminCategory,
  createAdminProduct,
  deleteAdminCategory,
  deleteAdminProduct,
  getAdminCategories,
  getAdminProducts,
  updateAdminCategory,
  updateAdminProduct,
} from "../controllers/adminCatalog.controller.js";
import {
  createAdminProductGalleryImage,
  createAdminProductOption,
  createAdminProductOptionValue,
  createAdminProductVariant,
  deleteAdminProductGalleryImage,
  deleteAdminProductOptionValue,
  getAdminProductVariantCatalog,
  replaceAdminVariantOptionValues,
  reorderAdminProductGalleryImages,
  updateAdminProductGalleryImage,
  updateAdminProductVariant,
} from "../controllers/adminVariantCatalog.controller.js";
import {
  createAdminFlashSale,
  deleteAdminFlashSale,
  getAdminFlashSales,
  updateAdminFlashSale,
} from "../controllers/adminFlashSale.controller.js";
import {
  archiveAdminScheduledPromotion,
  createAdminScheduledPromotion,
  getAdminScheduledPromotions,
  updateAdminScheduledPromotion,
} from "../controllers/scheduledPromotion.controller.js";
import {
  getAdminQuote,
  getAdminQuotes,
  respondToAdminQuote,
  updateAdminQuoteStatus,
} from "../controllers/quote.controller.js";
import { getAdminThreads, getThreadMessages, postThreadMessage, updateAdminThreadStatus } from "../controllers/support.controller.js";
import {
  getAdminContactMessages,
  updateAdminContactMessage,
  updateAdminContactMessageStatus,
} from "../controllers/contact.controller.js";
import { getAdminNewsletterSubscribers } from "../controllers/newsletter.controller.js";
import {
  getAdminEmailDeliveries,
  retryAdminEmailDelivery,
} from "../controllers/emailDelivery.controller.js";
import { emailRetryRateLimit } from "../middleware/rateLimit.middleware.js";
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
} from "../controllers/adminDelivery.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  passwordActionRateLimit,
  supportMessageRateLimit,
} from "../middleware/rateLimit.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";
import {
  downloadProductImportTemplate,
  exportAdminConfirmedOrders,
  getAdminCatalogImportBatch,
  getAdminCatalogImportBatches,
  getAdminIntegrationLogs,
  getAdminIntegrationStatus,
  importAdminProductsCsv,
  previewAdminCatalogImport,
  previewAdminCatalogImportExcel,
  applyAdminCatalogImport,
} from "../controllers/integration.controller.js";
import { uploadAdminProductImage } from "../controllers/adminProductImage.controller.js";
import { PRODUCT_IMAGE_MAX_BYTES } from "../services/productImageStorage.service.js";
import { EXCEL_IMPORT_MAX_BYTES } from "../services/catalogImportExcel.service.js";
import {
  getAdminHeroSlides,
  publishAdminHeroSlide,
  saveAdminHeroSlideDraft,
  uploadAdminHeroImage,
} from "../controllers/adminHeroSlide.controller.js";
import { HERO_IMAGE_MAX_BYTES } from "../services/heroImageStorage.service.js";
import {
  createAdminCoupon,
  deleteAdminCoupon,
  getAdminCoupons,
  updateAdminCoupon,
} from "../controllers/adminCoupon.controller.js";
import {
  applyAdminAccountAction,
  createAdminUserAccountActionRequest,
  getAdminAccountActionRequestAttentionCount,
  getAdminAccountActionRequestById,
  getAdminAccountActionRequests,
} from "../controllers/accountActionRequest.controller.js";
import {
  adjustAdminCustomerPoints,
  adjustAdminCustomerWallet,
  getAdminLoyaltyCustomer,
  getAdminLoyaltyCustomerList,
  getAdminLoyaltySettings,
  patchAdminLoyaltySettings,
  reverseAdminOrderPoints,
} from "../controllers/loyalty.controller.js";

const router = Router();
const parseProductImageBody = express.raw({
  type: () => true,
  limit: PRODUCT_IMAGE_MAX_BYTES,
});
function productImageBody(request, response, next) {
  parseProductImageBody(request, response, (error) => {
    if (error?.type === "entity.too.large") {
      return response.status(413).json({
        message: "Product images must be 5 MB or smaller.",
        field: "imageUrl",
      });
    }
    return error ? next(error) : next();
  });
}

const parseHeroImageBody = express.raw({
  type: () => true,
  limit: HERO_IMAGE_MAX_BYTES,
});
function heroImageBody(request, response, next) {
  parseHeroImageBody(request, response, (error) => {
    if (error?.type === "entity.too.large") {
      return response.status(413).json({
        message: "Hero images must be 5 MB or smaller.",
        field: "desktopImageUrl",
      });
    }
    return error ? next(error) : next();
  });
}

const parseCatalogImportWorkbookBody = express.raw({
  type: () => true,
  limit: EXCEL_IMPORT_MAX_BYTES,
});
function catalogImportWorkbookBody(request, response, next) {
  parseCatalogImportWorkbookBody(request, response, (error) => {
    if (error?.type === "entity.too.large") {
      return response.status(413).json({ message: "Catalogue import workbooks must be 15 MB or smaller." });
    }
    return error ? next(error) : next();
  });
}

router.use(requireAuthServiceReady, requireAuth, requireRoles("admin", "support"));
router.get("/hero-slides", requireRoles("admin"), getAdminHeroSlides);
router.put(
  "/hero-images",
  requireRoles("admin"),
  heroImageBody,
  uploadAdminHeroImage
);
router.put("/hero-slides/:id/draft", requireRoles("admin"), saveAdminHeroSlideDraft);
router.post("/hero-slides/:id/publish", requireRoles("admin"), publishAdminHeroSlide);
router.get("/integrations/status", requireRoles("admin"), getAdminIntegrationStatus);
router.get("/integrations/sync-logs", requireRoles("admin"), getAdminIntegrationLogs);
router.get("/integrations/products/import-template", requireRoles("admin"), downloadProductImportTemplate);
router.post("/integrations/catalog-imports/preview", requireRoles("admin"), previewAdminCatalogImport);
router.post(
  "/integrations/catalog-imports/excel/preview",
  requireRoles("admin"),
  catalogImportWorkbookBody,
  previewAdminCatalogImportExcel
);
router.post("/integrations/catalog-imports/:batchId/apply", requireRoles("admin"), applyAdminCatalogImport);
router.get("/integrations/catalog-imports", requireRoles("admin"), getAdminCatalogImportBatches);
router.get("/integrations/catalog-imports/:batchId", requireRoles("admin"), getAdminCatalogImportBatch);
router.post(
  "/integrations/products/import-csv",
  requireRoles("admin"),
  text({ type: ["text/csv", "text/plain"], limit: "2mb" }),
  importAdminProductsCsv
);
router.get("/integrations/orders/export", requireRoles("admin"), exportAdminConfirmedOrders);
router.get("/orders", requirePermission("ORDERS_VIEW"), getAdminOrders);
router.get("/orders/:id", requirePermission("ORDERS_VIEW"), getAdminOrder);
router.patch("/orders/:id/status", requirePermission("ORDERS_UPDATE_STATUS"), updateAdminOrderStatus);
router.patch("/orders/:id/payment-status", requirePermission("ORDERS_UPDATE_STATUS"), updateAdminOrderPaymentStatus);
router.post(
  "/loyalty/orders/:orderId/reverse-points",
  requirePermission("LOYALTY_MANAGE"),
  reverseAdminOrderPoints
);
router.get(
  "/account-action-requests",
  requirePermission("ACCOUNT_REQUESTS_VIEW"),
  requirePermission("ACCOUNT_LIFECYCLE_VIEW"),
  getAdminAccountActionRequests
);
router.get(
  "/account-action-requests-attention-count",
  requirePermission("ACCOUNT_REQUESTS_VIEW"),
  requirePermission("ACCOUNT_LIFECYCLE_VIEW"),
  getAdminAccountActionRequestAttentionCount
);
router.get(
  "/account-action-requests/:id",
  requirePermission("ACCOUNT_REQUESTS_VIEW"),
  requirePermission("ACCOUNT_LIFECYCLE_VIEW"),
  getAdminAccountActionRequestById
);
router.post(
  "/account-action-requests/:id/actions",
  requirePermission("ACCOUNT_REQUESTS_MANAGE"),
  requirePermission("ACCOUNT_LIFECYCLE_MANAGE"),
  applyAdminAccountAction
);
router.get("/brands", requireRoles("admin"), getAdminBrands);
router.post("/brands", requireRoles("admin"), createAdminBrand);
router.patch("/brands/:id", requireRoles("admin"), updateAdminBrand);
router.delete("/brands/:id", requireRoles("admin"), deleteAdminBrand);
router.get("/categories", requireRoles("admin"), getAdminCategories);
router.post("/categories", requireRoles("admin"), createAdminCategory);
router.patch("/categories/:id", requireRoles("admin"), updateAdminCategory);
router.delete("/categories/:id", requireRoles("admin"), deleteAdminCategory);
router.get("/products", requireRoles("admin"), getAdminProducts);
router.get("/products/:productId/variant-catalog", requireRoles("admin"), getAdminProductVariantCatalog);
router.post("/products/:productId/options", requireRoles("admin"), createAdminProductOption);
router.post("/product-options/:optionId/values", requireRoles("admin"), createAdminProductOptionValue);
router.delete("/product-option-values/:valueId", requireRoles("admin"), deleteAdminProductOptionValue);
router.post("/products/:productId/variants", requireRoles("admin"), createAdminProductVariant);
router.patch("/product-variants/:variantId", requireRoles("admin"), updateAdminProductVariant);
router.put("/product-variants/:variantId/option-values", requireRoles("admin"), replaceAdminVariantOptionValues);
router.post("/products/:productId/gallery-images", requireRoles("admin"), createAdminProductGalleryImage);
router.put("/products/:productId/gallery-images/reorder", requireRoles("admin"), reorderAdminProductGalleryImages);
router.patch("/product-images/:imageId", requireRoles("admin"), updateAdminProductGalleryImage);
router.delete("/product-images/:imageId", requireRoles("admin"), deleteAdminProductGalleryImage);
router.put(
  "/product-images",
  requireRoles("admin"),
  productImageBody,
  uploadAdminProductImage
);
router.post("/products", requireRoles("admin"), createAdminProduct);
router.patch("/products/:id", requireRoles("admin"), updateAdminProduct);
router.delete("/products/:id", requireRoles("admin"), deleteAdminProduct);
router.get("/flash-sales", requireRoles("admin"), getAdminFlashSales);
router.post("/flash-sales", requireRoles("admin"), createAdminFlashSale);
router.patch("/flash-sales/:id", requireRoles("admin"), updateAdminFlashSale);
router.delete("/flash-sales/:id", requireRoles("admin"), deleteAdminFlashSale);
router.get("/coupons", requireRoles("admin"), getAdminCoupons);
router.post("/coupons", requireRoles("admin"), createAdminCoupon);
router.patch("/coupons/:id", requireRoles("admin"), updateAdminCoupon);
router.delete("/coupons/:id", requireRoles("admin"), deleteAdminCoupon);
router.get("/scheduled-promotions", requireRoles("admin"), getAdminScheduledPromotions);
router.post("/scheduled-promotions", requireRoles("admin"), createAdminScheduledPromotion);
router.patch(
  "/scheduled-promotions/:id",
  requireRoles("admin"),
  updateAdminScheduledPromotion
);
router.delete(
  "/scheduled-promotions/:id",
  requireRoles("admin"),
  archiveAdminScheduledPromotion
);
router.get("/delivery-zones", requireRoles("admin"), getAdminDeliveryZones);
router.post("/delivery-zones", requireRoles("admin"), createAdminDeliveryZone);
router.patch("/delivery-zones/:id", requireRoles("admin"), updateAdminDeliveryZone);
router.delete("/delivery-zones/:id", requireRoles("admin"), deleteAdminDeliveryZone);
router.get("/delivery-offers", requireRoles("admin"), getAdminDeliveryOffers);
router.post("/delivery-offers", requireRoles("admin"), createAdminDeliveryOffer);
router.patch("/delivery-offers/:id", requireRoles("admin"), updateAdminDeliveryOffer);
router.delete("/delivery-offers/:id", requireRoles("admin"), deleteAdminDeliveryOffer);
router.get(
  "/delivery-offers/:id/eligible-users",
  requireRoles("admin"),
  getEligibleUsersForDeliveryOffer
);
router.get("/permissions", requireRoles("admin"), getPermissionCatalog);
router.get("/users", requirePermission("USERS_VIEW"), getAdminUsers);
router.get("/loyalty/customers", requirePermission("LOYALTY_VIEW"), getAdminLoyaltyCustomerList);
router.get("/loyalty/customers/:userId", requirePermission("LOYALTY_VIEW"), getAdminLoyaltyCustomer);
router.post("/loyalty/customers/:userId/points", requirePermission("LOYALTY_MANAGE"), adjustAdminCustomerPoints);
router.post("/loyalty/customers/:userId/wallet", requirePermission("LOYALTY_MANAGE"), adjustAdminCustomerWallet);
router.get("/loyalty/settings", requirePermission("LOYALTY_VIEW"), getAdminLoyaltySettings);
router.patch("/loyalty/settings", requirePermission("LOYALTY_MANAGE"), patchAdminLoyaltySettings);
router.post("/users", requireRoles("admin"), passwordActionRateLimit, createAdminUser);
router.get("/users/:id", requirePermission("ACCOUNT_LIFECYCLE_VIEW"), getAdminUser);
router.post(
  "/users/:id/account-action-requests",
  requirePermission("ACCOUNT_LIFECYCLE_MANAGE"),
  createAdminUserAccountActionRequest
);
router.patch("/users/:id/tier", requireRoles("admin"), updateCustomerTier);
router.put("/users/:id/permissions", requireRoles("admin"), replaceSupportPermissions);
router.patch("/users/:id/status", requireRoles("admin"), updateUserStatus);
router.post("/users/:id/benefits", requireRoles("admin"), createCustomerBenefit);
router.patch("/users/:id/benefits/:benefitId", requireRoles("admin"), updateCustomerBenefit);
router.post("/users/:id/benefits/:benefitId/lifecycle", requireRoles("admin"), updateCustomerBenefitLifecycle);
router.get("/quotes", requirePermission("QUOTES_VIEW"), getAdminQuotes);
router.get("/quotes/:id", requirePermission("QUOTES_VIEW"), getAdminQuote);
router.patch("/quotes/:id/status", requirePermission("QUOTES_APPROVE"), updateAdminQuoteStatus);
router.post("/quotes/:id/response", requirePermission("QUOTES_REPLY"), respondToAdminQuote);
router.get("/product-requests", requirePermission("PRODUCT_REQUESTS_VIEW"), getAdminProductRequests);
router.get("/product-requests/:id", requirePermission("PRODUCT_REQUESTS_VIEW"), getAdminProductRequest);
router.patch("/product-requests/:id/status", requirePermission("PRODUCT_REQUESTS_UPDATE"), updateAdminProductRequestStatus);
router.get("/contact-messages", requireRoles("admin"), getAdminContactMessages);
router.patch("/contact-messages/:id", requireRoles("admin"), updateAdminContactMessage);
router.patch("/contact-messages/:id/status", requireRoles("admin"), updateAdminContactMessageStatus);
router.get("/newsletter-subscribers", requireRoles("admin"), getAdminNewsletterSubscribers);
router.get("/email-deliveries", requireRoles("admin"), getAdminEmailDeliveries);
router.post(
  "/email-deliveries/:id/retry",
  requireRoles("admin"),
  emailRetryRateLimit,
  retryAdminEmailDelivery
);
router.get("/support/threads", requirePermission("SUPPORT_INBOX_VIEW"), getAdminThreads);
router.get("/support/threads/:threadId/messages", requirePermission("SUPPORT_INBOX_VIEW"), getThreadMessages);
router.post("/support/threads/:threadId/messages", requirePermission("SUPPORT_INBOX_REPLY"), supportMessageRateLimit, postThreadMessage);
router.patch("/support/threads/:threadId/status", requirePermission("SUPPORT_INBOX_CLOSE"), updateAdminThreadStatus);
export default router;
