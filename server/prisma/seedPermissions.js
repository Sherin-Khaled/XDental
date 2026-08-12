import "dotenv/config";
import { prisma } from "../src/config/db.js";
import { PERMISSION_GROUPS } from "../src/services/permission.service.js";

try {
  for (const [group, keys] of Object.entries(PERMISSION_GROUPS)) {
    for (const key of keys) {
      await prisma.permission.upsert({
        where: { key },
        update: { group },
        create: { key, group },
      });
    }
  }
  console.log(`Seeded ${Object.values(PERMISSION_GROUPS).flat().length} support permissions.`);
} finally {
  await prisma.$disconnect();
}

