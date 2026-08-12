function numericPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) ? price : null;
}

export function validCatalogSalePrice(product) {
  const basePrice = numericPrice(product?.price);
  const salePrice = numericPrice(product?.salePrice);
  return basePrice > 0 && salePrice > 0 && salePrice < basePrice ? salePrice : null;
}

export function selectBestValidFlashSale(product, flashSales, now = new Date()) {
  const originalPrice = numericPrice(product?.price);
  if (!(originalPrice > 0)) return null;

  const nowTime = now.getTime();
  return flashSales
    .filter((flashSale) => {
      const salePrice = numericPrice(flashSale.salePrice);
      return flashSale.productId === product.id
        && flashSale.isActive
        && flashSale.startsAt.getTime() <= nowTime
        && flashSale.endsAt.getTime() > nowTime
        && salePrice > 0
        && salePrice < originalPrice;
    })
    .sort((left, right) => {
      const priceDifference = Number(left.salePrice) - Number(right.salePrice);
      if (priceDifference !== 0) return priceDifference;
      const endDifference = left.endsAt.getTime() - right.endsAt.getTime();
      if (endDifference !== 0) return endDifference;
      return String(left.id).localeCompare(String(right.id));
    })[0] ?? null;
}

export async function resolveEffectiveProductPrices(database, products, { now = new Date() } = {}) {
  const pricedProducts = products.filter((product) => product?.id && numericPrice(product.price) > 0);
  const productIds = [...new Set(pricedProducts.map((product) => product.id))];
  const prices = new Map();

  for (const product of pricedProducts) {
    const basePrice = numericPrice(product.price);
    const salePrice = validCatalogSalePrice(product);
    prices.set(product.id, {
      basePrice,
      salePrice,
      effectivePrice: salePrice ?? basePrice,
      price: salePrice ?? basePrice,
      originalPrice: salePrice === null ? null : basePrice,
      flashSale: null,
    });
  }
  if (productIds.length === 0) return prices;

  const flashSales = await database.flashSale.findMany({
    where: {
      productId: { in: productIds },
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
  });

  for (const product of pricedProducts) {
    const flashSale = selectBestValidFlashSale(product, flashSales, now);
    if (!flashSale) continue;
    prices.set(product.id, {
      basePrice: Number(product.price),
      salePrice: validCatalogSalePrice(product),
      effectivePrice: Number(flashSale.salePrice),
      price: Number(flashSale.salePrice),
      originalPrice: Number(product.price),
      flashSale,
    });
  }

  return prices;
}
