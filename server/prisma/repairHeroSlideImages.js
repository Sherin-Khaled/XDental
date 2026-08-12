import "dotenv/config";
import { prisma } from "../src/config/db.js";
import { HERO_SLIDE_SEEDS } from "./heroSlideSeedData.js";

const legacyImageSources = {
  "hero-brand": new Set(["/toothtools.png"]),
  "hero-offer": new Set(["/toothtools.png"]),
  "hero-equipment": new Set(["/trusted-brand-implant.png"]),
};

try {
  for (const seed of HERO_SLIDE_SEEDS) {
    const record = await prisma.heroSlide.findUnique({ where: { id: seed.id } });
    if (!record) {
      console.log(`Skipped missing Hero slot: ${seed.id}`);
      continue;
    }

    const currentSource = record.content?.image?.src;
    if (!legacyImageSources[seed.id]?.has(currentSource)) {
      console.log(`Preserved owner-managed Hero image: ${seed.id}`);
      continue;
    }

    const image = {
      ...record.content.image,
      src: seed.content.image.src,
    };
    await prisma.heroSlide.update({
      where: { id: seed.id },
      data: {
        content: {
          ...record.content,
          image,
        },
      },
    });
    console.log(`Repaired published Hero image: ${seed.id} -> ${image.src}`);
  }
} finally {
  await prisma.$disconnect();
}
