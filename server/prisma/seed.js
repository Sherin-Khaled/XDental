import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/config/db.js";

const isProduction = process.env.NODE_ENV === "production";
const name = process.env.SEED_ADMIN_NAME?.trim() || (isProduction ? "" : "X Dental Admin");
const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || (isProduction ? "" : "admin@xdental.local");
const password = process.env.SEED_ADMIN_PASSWORD || (isProduction ? "" : "Admin123456");
const role = process.env.SEED_ADMIN_ROLE?.trim().toUpperCase() || "ADMIN";

if (!name || !email || !password) {
  throw new Error("SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD are required in production.");
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("SEED_ADMIN_EMAIL must be a valid email address.");
}

if (password.length < 8 || password.length > 128) {
  throw new Error("SEED_ADMIN_PASSWORD must be between 8 and 128 characters.");
}

if (!["ADMIN", "SUPPORT"].includes(role)) {
  throw new Error("SEED_ADMIN_ROLE must be ADMIN or SUPPORT.");
}

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role },
    create: { name, email, passwordHash, role },
    select: { email: true },
  });
  console.log(`Seeded local staff user: ${user.email}`);
} finally {
  await prisma.$disconnect();
}
