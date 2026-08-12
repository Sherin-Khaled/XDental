import "dotenv/config";

import { prisma } from "../config/db.js";
import { deleteUsersAndOwnedData } from "../services/testDataCleanup.service.js";
import { stringifyCsv } from "../utils/csv.js";
import { AUTH_COOKIE_NAME, createToken } from "../utils/createToken.js";

const API_BASE_URL = "http://localhost:5000/api";
const createdUserIds = [];
const createdSyncLogIds = new Set();
let productId = null;
let mappingProductId = null;
let orderId = null;
let brandName = null;
let categoryName = null;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = "GET", body, cookie, contentType } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    signal: AbortSignal.timeout(10000),
    headers: {
      ...(body !== undefined ? { "Content-Type": contentType || "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== undefined
      ? { body: contentType === "text/csv" ? body : JSON.stringify(body) }
      : {}),
  });
  const responseType = response.headers.get("content-type") || "";
  const payload = responseType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text();
  return { response, payload };
}

function requireOk(step, result) {
  if (!result.response.ok) {
    const message = typeof result.payload === "object" ? result.payload?.message : result.payload;
    throw new Error(`${step} failed with HTTP ${result.response.status}: ${message || "Unknown error"}`);
  }
  return result.payload;
}

async function createUser(suffix, role) {
  const user = await prisma.user.create({
    data: {
      name: `Owner Integration ${role}`,
      email: `owner.integration.${role.toLowerCase()}+${suffix}@xdental.local`,
      passwordHash: "smoke-test-session-only",
      role,
    },
  });
  createdUserIds.push(user.id);
  return { ...user, cookie: `${AUTH_COOKIE_NAME}=${createToken(user.id)}` };
}

function productCsv(row) {
  const columns = [
    "sku", "name", "slug", "brand", "category", "price", "stockQuantity", "status",
    "isAvailable", "outOfStock", "imageUrl", "description", "externalProductId", "sourceSystem",
  ];
  return stringifyCsv([row], columns.map((key) => ({ key, header: key })));
}

async function run() {
  const health = requireOk("Health", await request("/health"));
  requireValue(health.database?.status === "connected", "PostgreSQL is not ready.");
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  requireValue(admin?.id, "An admin user is required.");
  const adminCookie = `${AUTH_COOKIE_NAME}=${createToken(admin.id)}`;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const support = await createUser(suffix, "SUPPORT");
  const customer = await createUser(suffix, "CUSTOMER");

  requireValue((await request("/admin/integrations/status", { cookie: customer.cookie })).response.status === 403,
    "Customer accessed integration status.");
  requireOk("Support status access", await request("/admin/integrations/status", { cookie: support.cookie }));
  requireOk("Support log access", await request("/admin/integrations/sync-logs", { cookie: support.cookie }));
  requireValue((await request("/admin/integrations/products/import-template", { cookie: support.cookie })).response.status === 403,
    "Support downloaded the import template.");
  requireValue((await request("/admin/integrations/products/import-csv", {
    method: "POST",
    cookie: support.cookie,
    body: "sku,name,price,stockQuantity\r\nDENIED,Denied,1,1\r\n",
    contentType: "text/csv",
  })).response.status === 403, "Support imported products.");
  requireValue((await request("/admin/integrations/orders/export", { cookie: support.cookie })).response.status === 403,
    "Support exported orders.");

  const template = requireOk(
    "Admin template download",
    await request("/admin/integrations/products/import-template", { cookie: adminCookie })
  );
  requireValue(template.includes("sku,name,slug"), "Import template headers are missing.");

  const sku = `OWNER-SMOKE-${suffix}`;
  const slug = `owner-smoke-${suffix}`;
  brandName = `Owner Smoke Brand ${suffix}`;
  categoryName = `Owner Smoke Category ${suffix}`;
  const sourceSystem = `SMOKE_OWNER_${suffix}`;
  const csv = productCsv({
    sku,
    name: `Owner Imported Product ${suffix}`,
    slug,
    brand: brandName,
    category: categoryName,
    price: 210.25,
    stockQuantity: 5,
    status: "ACTIVE",
    isAvailable: true,
    outOfStock: false,
    imageUrl: "",
    description: "Owner integration smoke product",
    externalProductId: `EXT-${suffix}`,
    sourceSystem,
  });
  const imported = requireOk(
    "Product import",
    await request(
      `/admin/integrations/products/import-csv?sourceSystem=${encodeURIComponent(sourceSystem)}&createMissingLookups=true`,
      { method: "POST", cookie: adminCookie, body: csv, contentType: "text/csv" }
    )
  ).import;
  createdSyncLogIds.add(imported.syncLogId);
  requireValue(imported.recordsCreated === 1 && imported.recordsFailed === 0, "Product import summary is incorrect.");
  const importStatus = requireOk(
    "Product import status",
    await request("/admin/integrations/status", { cookie: support.cookie })
  ).integration.lastProductImport;
  requireValue(
    importStatus?.id === imported.syncLogId && importStatus.status === "SUCCESS" &&
      importStatus.details?.recordsCreated === 1 && importStatus.details?.completedAt,
    "Product import SyncLog summary is incomplete."
  );
  const product = await prisma.product.findFirst({ where: { sku: { equals: sku, mode: "insensitive" } } });
  requireValue(product?.price.toString() === "210.25", "Imported backend price is incorrect.");
  requireValue(product.stockQuantity === 5 && product.isAvailable, "Imported stock is incorrect.");
  productId = product.id;

  const publicCatalog = requireOk(
    "Public product catalog",
    await request(`/products?search=${encodeURIComponent(sku)}`)
  );
  const publicProduct = publicCatalog.products?.find((item) => item.id === product.id);
  requireValue(publicProduct?.sku === sku && publicProduct.price === 210.25 && publicProduct.stockQuantity === 5,
    "Imported product is missing from the public catalog.");
  requireValue(
    !("externalProductId" in publicProduct) && !("sourceSystem" in publicProduct) &&
      !("syncStatus" in publicProduct) && !("lastSyncedAt" in publicProduct),
    "Public catalog exposed internal integration fields."
  );
  requireValue(
    requireOk("Public product detail", await request(`/products/${encodeURIComponent(slug)}`)).product?.id === product.id,
    "Public product detail did not resolve the imported slug."
  );
  requireValue(
    requireOk("Public categories", await request("/categories")).categories?.some((item) => item.name === categoryName),
    "Imported category is missing from the public catalog."
  );
  requireValue(
    requireOk("Public brands", await request("/brands")).brands?.some((item) => item.name === brandName),
    "Imported brand is missing from the public catalog."
  );

  const mappingSku = `OWNER-SMOKE-MAP-${suffix}`;
  const unknownBrand = `Unknown Owner Brand ${suffix}`;
  const unknownCategory = `Unknown Owner Category ${suffix}`;
  const mappingRow = {
    sku: mappingSku,
    name: `Owner Mapping Product ${suffix}`,
    slug: "",
    brand: unknownBrand,
    category: unknownCategory,
    price: 99.99,
    stockQuantity: 3,
    status: "ACTIVE",
    isAvailable: true,
    outOfStock: false,
    imageUrl: "",
    description: "Owner mapping smoke product",
    externalProductId: "",
    sourceSystem,
  };
  const importDefault = (row) => request(
    `/admin/integrations/products/import-csv?sourceSystem=${encodeURIComponent(sourceSystem)}`,
    { method: "POST", cookie: adminCookie, body: productCsv(row), contentType: "text/csv" }
  );

  const unknownImport = requireOk("Default import with unknown brand/category", await importDefault(mappingRow)).import;
  createdSyncLogIds.add(unknownImport.syncLogId);
  requireValue(unknownImport.recordsCreated === 1 && unknownImport.recordsFailed === 0,
    "Unknown-mapping import did not import the product.");
  requireValue(
    unknownImport.warnings.some((warning) => warning.message?.includes("without brand mapping")) &&
      unknownImport.warnings.some((warning) => warning.message?.includes("without category mapping")),
    "Unknown brand/category import did not return mapping warnings."
  );
  requireValue(!(await prisma.brand.findFirst({ where: { name: unknownBrand } })),
    "Default import auto-created a brand.");
  requireValue(!(await prisma.category.findFirst({ where: { name: unknownCategory } })),
    "Default import auto-created a category.");
  let mappingProduct = await prisma.product.findFirst({ where: { sku: mappingSku } });
  mappingProductId = mappingProduct?.id ?? null;
  requireValue(mappingProduct && mappingProduct.brand === null && mappingProduct.category === null,
    "Unknown brand/category text was stored on the product.");

  const linkImport = requireOk(
    "Default import linking existing brand/category",
    await importDefault({ ...mappingRow, brand: brandName.toUpperCase(), category: categoryName.toUpperCase() })
  ).import;
  createdSyncLogIds.add(linkImport.syncLogId);
  requireValue(linkImport.recordsUpdated === 1 && linkImport.warnings.length === 0,
    "Existing-mapping import reported warnings or did not update.");
  mappingProduct = await prisma.product.findUnique({ where: { id: mappingProduct.id } });
  requireValue(mappingProduct.brand === brandName && mappingProduct.category === categoryName,
    "Existing website brand/category was not linked to the imported product.");

  const retainImport = requireOk("Default import retaining mapping", await importDefault(mappingRow)).import;
  createdSyncLogIds.add(retainImport.syncLogId);
  mappingProduct = await prisma.product.findUnique({ where: { id: mappingProduct.id } });
  requireValue(mappingProduct.brand === brandName && mappingProduct.category === categoryName,
    "Unmatched import text overwrote the website brand/category mapping.");

  const order = requireOk(
    "Secure checkout",
    await request("/orders", {
      method: "POST",
      cookie: customer.cookie,
      body: {
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: "+201000000000",
        country: "Egypt",
        governorate: "Cairo",
        cityArea: "Nasr City",
        streetAddress: "Owner Integration Street",
        buildingNumber: "10",
        deliveryMethod: "standard",
        paymentMethod: "cash",
        items: [{ sku, slug, quantity: 2, unitPrice: 0 }],
      },
    })
  ).order;
  orderId = order.id;
  requireValue(order.items[0]?.unitPrice === 210.25, "Checkout did not use imported backend price.");
  const orderLog = await prisma.syncLog.findFirst({ where: { entityType: "Order", entityId: order.id } });
  if (orderLog) createdSyncLogIds.add(orderLog.id);

  requireOk(
    "Order confirmation",
    await request(`/admin/orders/${order.id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "CONFIRMED" },
    })
  );
  requireValue((await prisma.product.findUnique({ where: { id: product.id } })).stockQuantity === 3,
    "Confirmation did not decrement imported stock.");

  const exportedResult = await request("/admin/integrations/orders/export?status=CONFIRMED", { cookie: adminCookie });
  const exported = requireOk("Confirmed order export", exportedResult);
  const exportLogId = exportedResult.response.headers.get("x-sync-log-id");
  if (exportLogId) createdSyncLogIds.add(exportLogId);
  requireValue(exported.includes(order.orderNumber), "Export is missing the order number.");
  requireValue(exported.includes(sku), "Export is missing the item SKU.");
  requireValue(exported.includes(customer.email), "Export is missing customer data.");
  requireValue(exported.includes("210.25"), "Export is missing authoritative item price.");
  const exportStatus = requireOk(
    "Order export status",
    await request("/admin/integrations/status", { cookie: support.cookie })
  ).integration.lastOrderExport;
  requireValue(
    exportStatus?.id === exportLogId && exportStatus.status === "SUCCESS" &&
      exportStatus.details?.ordersExported >= 1 && exportStatus.details?.completedAt,
    "Order export SyncLog summary is incomplete."
  );

  const updateCsv = productCsv({
    sku,
    name: product.name,
    slug,
    brand: brandName,
    category: categoryName,
    price: 220,
    stockQuantity: 0,
    status: "OUT_OF_STOCK",
    isAvailable: false,
    outOfStock: true,
    imageUrl: "",
    description: product.description,
    externalProductId: product.externalProductId,
    sourceSystem,
  });
  const updated = requireOk(
    "Product stock update",
    await request(`/admin/integrations/products/import-csv?sourceSystem=${encodeURIComponent(sourceSystem)}`, {
      method: "POST",
      cookie: adminCookie,
      body: updateCsv,
      contentType: "text/csv",
    })
  ).import;
  createdSyncLogIds.add(updated.syncLogId);
  requireValue(updated.recordsUpdated === 1, "Product update was not reported.");
  const unavailable = await prisma.product.findUnique({ where: { id: product.id } });
  requireValue(
    unavailable.price.toString() === "220" && unavailable.stockQuantity === 0 &&
      unavailable.status === "OUT_OF_STOCK" && unavailable.isAvailable === false,
    "Price/stock/out-of-stock update was not applied."
  );
  const unavailablePublicProduct = requireOk(
    "Public out-of-stock product",
    await request(`/products/${encodeURIComponent(sku)}`)
  ).product;
  requireValue(
    unavailablePublicProduct.status === "OUT_OF_STOCK" && unavailablePublicProduct.available === false,
    "Public catalog did not expose the updated out-of-stock state."
  );
  console.log("Owner integration import, secure checkout, export, and authorization checks passed.");
}

let failure = null;
try {
  await run();
} catch (error) {
  failure = error;
} finally {
  try {
    await deleteUsersAndOwnedData(prisma, createdUserIds);
    if (orderId) await prisma.syncLog.deleteMany({ where: { entityType: "Order", entityId: orderId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (mappingProductId) await prisma.product.deleteMany({ where: { id: mappingProductId } });
    if (brandName) await prisma.brand.deleteMany({ where: { name: brandName } });
    if (categoryName) await prisma.category.deleteMany({ where: { name: categoryName } });
    if (createdSyncLogIds.size) await prisma.syncLog.deleteMany({ where: { id: { in: [...createdSyncLogIds] } } });
  } catch (cleanupError) {
    failure ??= cleanupError;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

if (failure) {
  console.error(`Owner integration smoke failed: ${failure instanceof Error ? failure.message : "Unknown error"}`);
  process.exitCode = 1;
} else {
  console.log("Owner integration smoke passed; generated data removed.");
}
