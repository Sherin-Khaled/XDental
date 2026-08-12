import "dotenv/config";
import { prisma } from "../src/config/db.js";
import { HERO_SLIDE_SEEDS } from "./heroSlideSeedData.js";

try {
  for (const slide of HERO_SLIDE_SEEDS) {
    await prisma.heroSlide.upsert({
      where: { id: slide.id },
      update: {
        slotNumber: slide.slotNumber,
      },
      create: {
        ...slide,
        isActive: true,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  }
  console.log(`Seeded ${HERO_SLIDE_SEEDS.length} Hero Slider slots.`);
} finally {
  await prisma.$disconnect();
}
