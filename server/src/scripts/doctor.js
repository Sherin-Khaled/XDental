import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = join(serverRoot, ".env");
const envExists = existsSync(envPath);

if (envExists) dotenv.config({ path: envPath });

let readinessFailed = false;

function ok(message) {
  console.log(`✅ OK: ${message}`);
}

function warning(message, blocksReadiness = false) {
  console.log(`⚠️ Warning: ${message}`);
  if (blocksReadiness) readinessFailed = true;
}

function failure(message) {
  console.log(`❌ Error: ${message}`);
  readinessFailed = true;
}

if (envExists) ok("server/.env exists.");
else failure("server/.env does not exist.");

const databaseUrl = process.env.DATABASE_URL?.trim();
const jwtSecret = process.env.JWT_SECRET?.trim();
const clientUrl = process.env.CLIENT_URL?.trim();
const configuredPort = process.env.PORT?.trim();
const emailEnabled = process.env.EMAIL_ENABLED?.trim().toLowerCase();

if (databaseUrl) ok("DATABASE_URL is configured.");
else failure("DATABASE_URL is missing.");

if (!jwtSecret) failure("JWT_SECRET is missing.");
else if (jwtSecret.length < 32) failure("JWT_SECRET must contain at least 32 characters.");
else ok("JWT_SECRET is configured and long enough.");

if (clientUrl) ok("CLIENT_URL is configured.");
else failure("CLIENT_URL is missing.");

if (!configuredPort) ok("PORT defaults to 5000.");
else if (/^\d+$/.test(configuredPort) && Number(configuredPort) > 0 && Number(configuredPort) <= 65535) {
  ok(`PORT is configured as ${configuredPort}.`);
} else {
  failure("PORT must be a number between 1 and 65535.");
}

if (!emailEnabled) ok("EMAIL_ENABLED defaults safely to false.");
else if (["true", "false"].includes(emailEnabled)) ok("EMAIL_ENABLED is configured.");
else warning("EMAIL_ENABLED is invalid and will behave as false.");

let prisma;
try {
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient({ log: [] });
  ok("Prisma Client can be imported.");
} catch {
  failure("Prisma Client could not be imported. Run npm --prefix server run prisma:generate");
}

let databaseConnected = false;
if (prisma && databaseUrl) {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
    ok("PostgreSQL is reachable.");
  } catch {
    failure(
      "PostgreSQL is not reachable. Check pgAdmin, database name, username, password, port 5432, and server/.env."
    );
  }
}

if (databaseConnected) {
  let tablesReady = false;
  try {
    await Promise.all([
      prisma.user.count(),
      prisma.productRequest.count(),
      prisma.supportThread.count(),
      prisma.supportMessage.count(),
      prisma.notification.count(),
    ]);
    tablesReady = true;
    ok("Core Prisma tables are accessible.");
  } catch (error) {
    if (["P2021", "P2022"].includes(error?.code)) {
      failure("Run npm --prefix server run prisma:deploy");
    } else {
      failure("Core Prisma tables could not be queried.");
    }
  }

  if (tablesReady) {
    try {
      const staffCount = await prisma.user.count({
        where: { role: { in: ["ADMIN", "SUPPORT"] } },
      });
      if (staffCount > 0) ok(`${staffCount} ADMIN/SUPPORT user(s) found.`);
      else warning("Run npm --prefix server run seed:admin", true);
    } catch {
      failure("Admin seed status could not be checked.");
    }
  }
}

if (prisma) await prisma.$disconnect().catch(() => {});

if (readinessFailed) {
  failure("Backend setup is not ready.");
  process.exitCode = 1;
} else {
  ok("Backend setup is ready.");
}
