import { prisma } from "../config/db.js";
import { isValidId } from "../utils/records.js";

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source ?? {}, key);
}

function serializeFlashSale(flashSale) {
  return {
    id: flashSale.id,
    salePrice: Number(flashSale.salePrice),
    startsAt: flashSale.startsAt.toISOString(),
    endsAt: flashSale.endsAt.toISOString(),
    isActive: flashSale.isActive,
    displayOrder: flashSale.displayOrder,
    createdAt: flashSale.createdAt,
    updatedAt: flashSale.updatedAt,
    product: flashSale.product
      ? {
          id: flashSale.product.id,
          name: flashSale.product.name,
          slug: flashSale.product.slug,
          sku: flashSale.product.sku ?? null,
          price: flashSale.product.price === null ? null : Number(flashSale.product.price),
          imageUrl: flashSale.product.imageUrl ?? null,
          status: flashSale.product.status,
          isAvailable: flashSale.product.isAvailable,
        }
      : null,
  };
}

function parseDate(value, fieldLabel) {
  if (value === undefined || value === null || value === "") {
    return { error: `${fieldLabel} is required.` };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: `${fieldLabel} must be a valid date/time.` };
  return { value: date };
}

function parseSalePrice(value) {
  if (value === undefined || value === null || value === "") return { error: "Sale price is required." };
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0 || price > 100000000) {
    return { error: "Sale price must be a positive number." };
  }
  return { value: Math.round(price * 100) / 100 };
}

function parseDisplayOrder(value, existing = 0) {
  if (value === undefined || value === null || value === "") return { value: existing };
  const order = Number(value);
  if (!Number.isInteger(order) || order < 0 || order > 100000) {
    return { error: "Display order must be a non-negative whole number." };
  }
  return { value: order };
}

async function parseFlashSaleInput(body, existing = null) {
  const productId = hasOwn(body, "productId") ? String(body.productId ?? "") : existing?.productId ?? "";
  if (!productId || !isValidId(productId)) {
    return { error: { message: "Choose a product for this flash sale.", field: "productId" } };
  }
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: { message: "Product not found.", field: "productId" } };
  if (product.price === null) {
    return { error: { message: "This product has no price set and cannot be used for a flash sale.", field: "productId" } };
  }

  const salePrice = parseSalePrice(hasOwn(body, "salePrice") ? body.salePrice : existing?.salePrice);
  if (salePrice.error) return { error: { message: salePrice.error, field: "salePrice" } };
  if (salePrice.value >= Number(product.price)) {
    return {
      error: {
        message: "Sale price must be lower than the product's current price.",
        field: "salePrice",
      },
    };
  }

  const startsAt = parseDate(hasOwn(body, "startsAt") ? body.startsAt : existing?.startsAt, "Start date");
  if (startsAt.error) return { error: { message: startsAt.error, field: "startsAt" } };
  const endsAt = parseDate(hasOwn(body, "endsAt") ? body.endsAt : existing?.endsAt, "End date");
  if (endsAt.error) return { error: { message: endsAt.error, field: "endsAt" } };
  if (endsAt.value.getTime() <= startsAt.value.getTime()) {
    return { error: { message: "End date must be after the start date.", field: "endsAt" } };
  }

  const isActive = hasOwn(body, "isActive") ? body.isActive : existing?.isActive ?? true;
  if (typeof isActive !== "boolean") {
    return { error: { message: "Active must be true or false.", field: "isActive" } };
  }

  const displayOrder = parseDisplayOrder(
    hasOwn(body, "displayOrder") ? body.displayOrder : undefined,
    existing?.displayOrder ?? 0
  );
  if (displayOrder.error) return { error: { message: displayOrder.error, field: "displayOrder" } };

  return {
    value: {
      productId,
      salePrice: salePrice.value,
      startsAt: startsAt.value,
      endsAt: endsAt.value,
      isActive,
      displayOrder: displayOrder.value,
    },
  };
}

export async function getAdminFlashSales(_request, response) {
  const flashSales = await prisma.flashSale.findMany({
    orderBy: [{ isActive: "desc" }, { startsAt: "desc" }],
    include: { product: true },
  });
  return response.json({ flashSales: flashSales.map(serializeFlashSale) });
}

export async function createAdminFlashSale(request, response) {
  const parsed = await parseFlashSaleInput(request.body ?? {});
  if (parsed.error) return response.status(400).json(parsed.error);

  const flashSale = await prisma.flashSale.create({
    data: parsed.value,
    include: { product: true },
  });
  return response.status(201).json({ flashSale: serializeFlashSale(flashSale) });
}

export async function updateAdminFlashSale(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Flash sale not found." });
  const existing = await prisma.flashSale.findUnique({ where: { id: request.params.id } });
  if (!existing) return response.status(404).json({ message: "Flash sale not found." });

  const parsed = await parseFlashSaleInput(request.body ?? {}, existing);
  if (parsed.error) return response.status(400).json(parsed.error);

  const flashSale = await prisma.flashSale.update({
    where: { id: existing.id },
    data: parsed.value,
    include: { product: true },
  });
  return response.json({ flashSale: serializeFlashSale(flashSale) });
}

export async function deleteAdminFlashSale(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Flash sale not found." });
  const existing = await prisma.flashSale.findUnique({ where: { id: request.params.id }, include: { product: true } });
  if (!existing) return response.status(404).json({ message: "Flash sale not found." });

  await prisma.flashSale.delete({ where: { id: existing.id } });
  return response.json({ message: "Flash sale deleted successfully.", flashSale: serializeFlashSale(existing) });
}
