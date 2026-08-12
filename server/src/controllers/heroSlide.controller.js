import { prisma } from "../config/db.js";

function publicSlide(record) {
  return {
    id: record.id,
    order: record.order,
    isActive: record.isActive,
    countdownTo: record.countdownTo?.toISOString() ?? null,
    ...record.content,
  };
}

/** Public contract: only the last published, active version is exposed. */
export async function getPublicHeroSlides(_request, response) {
  const records = await prisma.heroSlide.findMany({
    where: {
      publishedAt: { not: null },
      isActive: true,
      OR: [{ countdownTo: null }, { countdownTo: { gt: new Date() } }],
    },
    orderBy: { order: "asc" },
    select: {
      id: true,
      order: true,
      isActive: true,
      countdownTo: true,
      content: true,
    },
  });

  return response.json({ slides: records.map(publicSlide) });
}
