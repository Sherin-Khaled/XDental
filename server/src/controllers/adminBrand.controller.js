import { prisma } from "../config/db.js";
import { cleanText, isValidId } from "../utils/records.js";

const BRAND_STATUSES = new Set(["ACTIVE", "INACTIVE", "NEEDS_LOGO"]);

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source ?? {}, key);
}

function slugify(value) {
  return cleanText(value, 150)
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function validLogoUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function serializeBrand(brand, productCount = 0) {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    country: brand.country ?? null,
    logoUrl: brand.logoUrl ?? null,
    description: brand.description ?? null,
    featured: brand.featured,
    status: brand.status,
    productCount,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}

async function findDuplicate(name, slug, excludeId) {
  return prisma.brand.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        { slug },
      ],
    },
    select: { id: true },
  });
}

async function getProductCounts() {
  const groups = await prisma.product.groupBy({
    by: ["brand"],
    where: { brand: { not: null } },
    _count: { _all: true },
  });
  return groups.reduce((counts, group) => {
    const key = group.brand?.trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + group._count._all);
    return counts;
  }, new Map());
}

async function countLinkedProducts(name, database = prisma) {
  return database.product.count({
    where: { brand: { equals: name, mode: "insensitive" } },
  });
}

export async function getAdminBrands(request, response) {
  const search = cleanText(request.query?.search, 100);
  const status = cleanText(request.query?.status, 50).toUpperCase();
  const featuredQuery = typeof request.query?.featured === "string" ? request.query.featured.toLowerCase() : "";
  if (status && !BRAND_STATUSES.has(status)) {
    return response.status(400).json({ message: "Invalid brand status." });
  }
  if (featuredQuery && featuredQuery !== "true" && featuredQuery !== "false") {
    return response.status(400).json({ message: "Featured filter must be true or false." });
  }

  const [brands, productCounts] = await Promise.all([
    prisma.brand.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(featuredQuery ? { featured: featuredQuery === "true" } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { country: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    }),
    getProductCounts(),
  ]);

  return response.json({
    brands: brands.map((brand) => serializeBrand(brand, productCounts.get(brand.name.toLowerCase()) ?? 0)),
  });
}

export async function createAdminBrand(request, response) {
  const name = cleanText(request.body?.name, 150);
  const country = cleanText(request.body?.country, 100);
  const logoUrl = cleanText(request.body?.logoUrl, 1000);
  const description = cleanText(request.body?.description, 2000);
  const status = cleanText(request.body?.status, 50).toUpperCase() || "ACTIVE";
  const slug = slugify(request.body?.slug) || slugify(name);

  if (!name) return response.status(400).json({ message: "Brand name is required.", field: "name" });
  if (!slug) return response.status(400).json({ message: "Brand name must contain letters or numbers.", field: "name" });
  if (!BRAND_STATUSES.has(status)) return response.status(400).json({ message: "Invalid brand status.", field: "status" });
  if (!validLogoUrl(logoUrl)) return response.status(400).json({ message: "Logo URL must use http or https.", field: "logoUrl" });
  if (hasOwn(request.body, "featured") && typeof request.body.featured !== "boolean") {
    return response.status(400).json({ message: "Featured must be true or false.", field: "featured" });
  }
  if (await findDuplicate(name, slug)) {
    return response.status(409).json({ message: "A brand with this name or slug already exists.", field: "name" });
  }

  try {
    const brand = await prisma.brand.create({
      data: {
        name,
        slug,
        country: country || null,
        logoUrl: logoUrl || null,
        description: description || null,
        featured: request.body?.featured === true,
        status,
      },
    });
    return response.status(201).json({ brand: serializeBrand(brand) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({ message: "A brand with this name or slug already exists.", field: "name" });
    }
    throw error;
  }
}

export async function updateAdminBrand(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Brand not found." });
  const existing = await prisma.brand.findUnique({ where: { id: request.params.id } });
  if (!existing) return response.status(404).json({ message: "Brand not found." });

  const name = hasOwn(request.body, "name") ? cleanText(request.body.name, 150) : existing.name;
  const country = hasOwn(request.body, "country") ? cleanText(request.body.country, 100) : existing.country;
  const logoUrl = hasOwn(request.body, "logoUrl") ? cleanText(request.body.logoUrl, 1000) : existing.logoUrl;
  const description = hasOwn(request.body, "description") ? cleanText(request.body.description, 2000) : existing.description;
  const status = hasOwn(request.body, "status") ? cleanText(request.body.status, 50).toUpperCase() : existing.status;
  const featured = hasOwn(request.body, "featured") ? request.body.featured : existing.featured;
  const slug = name === existing.name ? existing.slug : slugify(name);

  if (!name) return response.status(400).json({ message: "Brand name is required.", field: "name" });
  if (!slug) return response.status(400).json({ message: "Brand name must contain letters or numbers.", field: "name" });
  if (!BRAND_STATUSES.has(status)) return response.status(400).json({ message: "Invalid brand status.", field: "status" });
  if (!validLogoUrl(logoUrl)) return response.status(400).json({ message: "Logo URL must use http or https.", field: "logoUrl" });
  if (typeof featured !== "boolean") return response.status(400).json({ message: "Featured must be true or false.", field: "featured" });
  if (await findDuplicate(name, slug, existing.id)) {
    return response.status(409).json({ message: "A brand with this name or slug already exists.", field: "name" });
  }

  try {
    const brand = await prisma.$transaction(async (database) => {
      if (name !== existing.name) {
        await database.product.updateMany({
          where: { brand: { equals: existing.name, mode: "insensitive" } },
          data: { brand: name },
        });
      }
      return database.brand.update({
        where: { id: existing.id },
        data: {
          name,
          slug,
          country: country || null,
          logoUrl: logoUrl || null,
          description: description || null,
          featured,
          status,
        },
      });
    });
    return response.json({ brand: serializeBrand(brand, await countLinkedProducts(brand.name)) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({ message: "A brand with this name or slug already exists.", field: "name" });
    }
    throw error;
  }
}

export async function deleteAdminBrand(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Brand not found." });
  const existing = await prisma.brand.findUnique({ where: { id: request.params.id } });
  if (!existing) return response.status(404).json({ message: "Brand not found." });
  const productCount = await countLinkedProducts(existing.name);
  if (productCount > 0) {
    return response.status(409).json({
      message: "Brand cannot be deleted because it has linked products.",
      productCount,
    });
  }
  await prisma.brand.delete({ where: { id: existing.id } });
  return response.json({ message: "Brand deleted successfully.", brand: serializeBrand(existing) });
}
