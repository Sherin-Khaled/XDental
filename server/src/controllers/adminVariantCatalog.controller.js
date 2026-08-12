import { prisma } from "../config/db.js";
import { cleanText, isValidId } from "../utils/records.js";
import { combinationSignature, variantCombinationSignature } from "../services/variantCatalog.service.js";

const STATUSES = new Set(["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK", "DRAFT", "INACTIVE"]);

function asInt(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function validUrl(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol); } catch { return false; }
}

async function productOr404(id, response) {
  if (!isValidId(id)) { response.status(404).json({ message: "Product not found." }); return null; }
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) { response.status(404).json({ message: "Product not found." }); return null; }
  return product;
}

export async function getAdminProductVariantCatalog(request, response) {
  const product = await productOr404(request.params.productId, response);
  if (!product) return;
  const catalog = await prisma.product.findUnique({
    where: { id: product.id },
    include: {
      options: { orderBy: { sortOrder: "asc" }, include: { values: { orderBy: { sortOrder: "asc" } } } },
      variants: { orderBy: { sortOrder: "asc" }, include: { selections: { include: { option: true, optionValue: true } } } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });
  return response.json({ product: catalog });
}

export async function createAdminProductOption(request, response) {
  const product = await productOr404(request.params.productId, response);
  if (!product) return;
  const code = cleanText(request.body?.code, 80).toUpperCase();
  const nameEn = cleanText(request.body?.nameEn, 160);
  if (!code || !nameEn) return response.status(400).json({ message: "Option code and English name are required." });
  try {
    const option = await prisma.productOption.create({ data: { productId: product.id, code, nameEn, nameAr: cleanText(request.body?.nameAr, 160) || null, sortOrder: asInt(request.body?.sortOrder) } });
    return response.status(201).json({ option });
  } catch (error) {
    if (error?.code === "P2002") return response.status(409).json({ message: "This product already has that option code." });
    throw error;
  }
}

export async function createAdminProductOptionValue(request, response) {
  const option = await prisma.productOption.findUnique({ where: { id: request.params.optionId } });
  if (!option) return response.status(404).json({ message: "Product option not found." });
  const code = cleanText(request.body?.code, 80).toUpperCase();
  const valueEn = cleanText(request.body?.valueEn, 160);
  if (!code || !valueEn) return response.status(400).json({ message: "Value code and English value are required." });
  try {
    const value = await prisma.productOptionValue.create({ data: { optionId: option.id, code, valueEn, valueAr: cleanText(request.body?.valueAr, 160) || null, displayHex: cleanText(request.body?.displayHex, 20) || null, sortOrder: asInt(request.body?.sortOrder) } });
    return response.status(201).json({ value });
  } catch (error) {
    if (error?.code === "P2002") return response.status(409).json({ message: "This option already has that value code." });
    throw error;
  }
}

/**
 * Pure, database-injectable variant creation so it can be unit tested with a
 * fake Prisma-shaped object (including simulating the P2002 unique-constraint
 * error the real database raises for a duplicate SKU, barcode, or
 * sourceSystem+externalVariantId) without a live database connection.
 */
export async function createProductVariant(database, productId, input) {
  const sku = cleanText(input?.sku, 120) || null;
  const barcode = cleanText(input?.barcode, 120) || null;
  const status = cleanText(input?.status, 50).toUpperCase() || "ACTIVE";
  if (!STATUSES.has(status)) return { error: { status: 400, message: "Invalid variant status." } };
  const stockQuantity = asInt(input?.stockQuantity);
  try {
    const variant = await database.productVariant.create({
      data: {
        productId, sku, barcode, status: stockQuantity === 0 ? "OUT_OF_STOCK" : status,
        isAvailable: input?.isAvailable !== false && stockQuantity > 0,
        stockQuantity, lowStockThreshold: asInt(input?.lowStockThreshold, 5),
        priceOverride: input?.priceOverride === null || input?.priceOverride === undefined || input?.priceOverride === "" ? null : Number(input.priceOverride),
        nameEn: cleanText(input?.nameEn, 200) || null, nameAr: cleanText(input?.nameAr, 200) || null,
        externalVariantId: cleanText(input?.externalVariantId, 200) || null, sourceSystem: cleanText(input?.sourceSystem, 120) || null,
        sortOrder: asInt(input?.sortOrder),
      },
    });
    return { variant };
  } catch (error) {
    if (error?.code === "P2002") return { error: { status: 409, message: "Variant SKU, barcode, or external identifier already exists." } };
    throw error;
  }
}

export async function createAdminProductVariant(request, response) {
  const product = await productOr404(request.params.productId, response);
  if (!product) return;
  const result = await createProductVariant(prisma, product.id, request.body);
  if (result.error) return response.status(result.error.status).json({ message: result.error.message });
  return response.status(201).json({ variant: result.variant });
}

export async function updateProductVariant(database, variant, input) {
  const status = input?.status === undefined ? variant.status : cleanText(input.status, 50).toUpperCase();
  if (!STATUSES.has(status)) return { error: { status: 400, message: "Invalid variant status." } };
  const stockQuantity = input?.stockQuantity === undefined ? variant.stockQuantity : asInt(input.stockQuantity);
  try {
    const updated = await database.productVariant.update({ where: { id: variant.id }, data: {
      sku: input?.sku === undefined ? variant.sku : cleanText(input.sku, 120) || null,
      barcode: input?.barcode === undefined ? variant.barcode : cleanText(input.barcode, 120) || null,
      status: stockQuantity === 0 ? "OUT_OF_STOCK" : status,
      isAvailable: input?.isAvailable === undefined ? variant.isAvailable && stockQuantity > 0 : input.isAvailable === true && stockQuantity > 0,
      stockQuantity, lowStockThreshold: input?.lowStockThreshold === undefined ? variant.lowStockThreshold : asInt(input.lowStockThreshold, 5),
      priceOverride: input?.priceOverride === undefined ? variant.priceOverride : input.priceOverride === null || input.priceOverride === "" ? null : Number(input.priceOverride),
      nameEn: input?.nameEn === undefined ? variant.nameEn : cleanText(input.nameEn, 200) || null,
      nameAr: input?.nameAr === undefined ? variant.nameAr : cleanText(input.nameAr, 200) || null,
      sortOrder: input?.sortOrder === undefined ? variant.sortOrder : asInt(input.sortOrder),
    } });
    return { variant: updated };
  } catch (error) {
    if (error?.code === "P2002") return { error: { status: 409, message: "Variant SKU or barcode already exists." } };
    throw error;
  }
}

export async function updateAdminProductVariant(request, response) {
  const variant = await prisma.productVariant.findUnique({ where: { id: request.params.variantId } });
  if (!variant) return response.status(404).json({ message: "Product variant not found." });
  const result = await updateProductVariant(prisma, variant, request.body);
  if (result.error) return response.status(result.error.status).json({ message: result.error.message });
  return response.json({ variant: result.variant });
}

/**
 * Replaces a variant's complete option-value combination and rejects it if
 * that exact combination (compared by canonical option/value codes, not
 * database IDs — see variantCatalog.service.js) already belongs to another
 * variant of the same product. Comparing against `variant.id` excluded from
 * `peers` means resaving a variant's own unchanged combination always
 * succeeds.
 */
export async function replaceVariantOptionValues(database, variant, optionValueIds) {
  const ids = Array.isArray(optionValueIds) ? [...new Set(optionValueIds.filter(isValidId))] : [];
  if (ids.length === 0) return { error: { status: 400, message: "At least one option value is required." } };
  const values = await database.productOptionValue.findMany({ where: { id: { in: ids } }, include: { option: true } });
  if (values.length !== ids.length || values.some((value) => value.option.productId !== variant.productId)) {
    return { error: { status: 400, message: "Option values must belong to this variant product." } };
  }
  if (new Set(values.map((value) => value.optionId)).size !== values.length) {
    return { error: { status: 409, message: "Only one value may be selected for each option." } };
  }
  const signature = combinationSignature(values.map((value) => ({ optionCode: value.option.code, valueCode: value.code })));
  const peers = await database.productVariant.findMany({
    where: { productId: variant.productId, id: { not: variant.id } },
    include: { selections: { include: { option: true, optionValue: true } } },
  });
  const conflict = peers.find((peer) => variantCombinationSignature(peer) === signature);
  if (conflict) {
    return { error: { status: 409, message: `Another variant already has this option combination: ${signature}` } };
  }
  await database.$transaction(async (transaction) => {
    await transaction.productVariantOptionValue.deleteMany({ where: { variantId: variant.id } });
    await transaction.productVariantOptionValue.createMany({ data: values.map((value) => ({ variantId: variant.id, optionId: value.optionId, optionValueId: value.id })) });
  });
  return { message: "Variant option combination saved.", signature };
}

export async function replaceAdminVariantOptionValues(request, response) {
  const variant = await prisma.productVariant.findUnique({ where: { id: request.params.variantId } });
  if (!variant) return response.status(404).json({ message: "Product variant not found." });
  const result = await replaceVariantOptionValues(prisma, variant, request.body?.optionValueIds);
  if (result.error) return response.status(result.error.status).json({ message: result.error.message });
  return response.json({ message: result.message });
}

export async function createAdminProductGalleryImage(request, response) {
  const product = await productOr404(request.params.productId, response);
  if (!product) return;
  const variantId = cleanText(request.body?.variantId, 200) || null;
  if (variantId) {
    const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId: product.id } });
    if (!variant) return response.status(400).json({ message: "Variant does not belong to this product." });
  }
  const url = cleanText(request.body?.url, 1000);
  if (!url || !validUrl(url)) return response.status(400).json({ message: "Image URL must use http or https." });
  const image = await prisma.$transaction(async (database) => {
    if (request.body?.isPrimary === true) await database.productImage.updateMany({ where: { productId: product.id, variantId, isPrimary: true }, data: { isPrimary: false } });
    return database.productImage.create({ data: {
      productId: product.id, variantId, url, altEn: cleanText(request.body?.altEn, 300) || null, altAr: cleanText(request.body?.altAr, 300) || null,
      sortOrder: asInt(request.body?.sortOrder), isPrimary: request.body?.isPrimary === true,
      sourceSystem: cleanText(request.body?.sourceSystem, 120) || null, sourceUrl: cleanText(request.body?.sourceUrl, 1000) || null,
      rightsConfirmed: request.body?.rightsConfirmed === true, rightsNote: cleanText(request.body?.rightsNote, 1000) || null,
    } });
  });
  return response.status(201).json({ image });
}

export async function updateAdminProductGalleryImage(request, response) {
  const image = await prisma.productImage.findUnique({ where: { id: request.params.imageId } });
  if (!image) return response.status(404).json({ message: "Image not found." });
  const url = request.body?.url === undefined ? image.url : cleanText(request.body.url, 1000);
  if (!url || !validUrl(url)) return response.status(400).json({ message: "Image URL must use http or https." });
  const isPrimary = request.body?.isPrimary === undefined ? image.isPrimary : request.body.isPrimary === true;
  const updated = await prisma.$transaction(async (database) => {
    if (isPrimary && !image.isPrimary) {
      await database.productImage.updateMany({
        where: { productId: image.productId, variantId: image.variantId, isPrimary: true, id: { not: image.id } },
        data: { isPrimary: false },
      });
    }
    return database.productImage.update({
      where: { id: image.id },
      data: {
        url,
        altEn: request.body?.altEn === undefined ? image.altEn : cleanText(request.body.altEn, 300) || null,
        altAr: request.body?.altAr === undefined ? image.altAr : cleanText(request.body.altAr, 300) || null,
        sortOrder: request.body?.sortOrder === undefined ? image.sortOrder : asInt(request.body.sortOrder, image.sortOrder),
        isPrimary,
        rightsConfirmed: request.body?.rightsConfirmed === undefined ? image.rightsConfirmed : request.body.rightsConfirmed === true,
        rightsNote: request.body?.rightsNote === undefined ? image.rightsNote : cleanText(request.body.rightsNote, 1000) || null,
      },
    });
  });
  return response.json({ image: updated });
}

export async function reorderAdminProductGalleryImages(request, response) {
  const product = await productOr404(request.params.productId, response);
  if (!product) return;
  const orderedIds = Array.isArray(request.body?.imageIds) ? [...new Set(request.body.imageIds.filter(isValidId))] : [];
  if (orderedIds.length === 0) return response.status(400).json({ message: "At least one image ID is required." });
  const images = await prisma.productImage.findMany({ where: { id: { in: orderedIds }, productId: product.id } });
  if (images.length !== orderedIds.length) return response.status(400).json({ message: "All images must belong to this product." });
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.productImage.update({ where: { id }, data: { sortOrder: index } }))
  );
  const gallery = await prisma.productImage.findMany({ where: { productId: product.id }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] });
  return response.json({ images: gallery });
}

export async function deleteAdminProductGalleryImage(request, response) {
  const image = await prisma.productImage.findUnique({ where: { id: request.params.imageId } });
  if (!image) return response.status(404).json({ message: "Image not found." });
  await prisma.productImage.delete({ where: { id: image.id } });
  return response.json({ message: "Image deleted successfully." });
}

/**
 * Option values are cascade-deletable at the database level, but silently
 * dropping one out from under an active variant would leave that variant
 * sellable with an incomplete option combination. Deleting is refused unless
 * every affected variant is deactivated in the same request (`force: true`),
 * which is the "safe explicit operation" the value can be removed through.
 */
export async function deleteAdminProductOptionValue(request, response) {
  const value = await prisma.productOptionValue.findUnique({ where: { id: request.params.valueId } });
  if (!value) return response.status(404).json({ message: "Option value not found." });
  const force = request.body?.force === true || request.query?.force === "true";
  const affectedVariants = await prisma.productVariant.findMany({
    where: { selections: { some: { optionValueId: value.id } } },
    select: { id: true, status: true, isAvailable: true },
  });
  const activeVariants = affectedVariants.filter((variant) => variant.isAvailable && variant.status !== "INACTIVE");
  if (activeVariants.length > 0 && !force) {
    return response.status(409).json({
      message: "This option value is used by active variants. Pass force=true to deactivate them and delete it.",
      activeVariantCount: activeVariants.length,
    });
  }
  await prisma.$transaction(async (database) => {
    if (activeVariants.length > 0) {
      await database.productVariant.updateMany({
        where: { id: { in: activeVariants.map((variant) => variant.id) } },
        data: { status: "INACTIVE", isAvailable: false },
      });
    }
    await database.productOptionValue.delete({ where: { id: value.id } });
  });
  return response.json({ message: "Option value deleted successfully.", deactivatedVariantCount: activeVariants.length });
}
