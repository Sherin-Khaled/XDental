import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getMailConfigurationErrors,
  readMailConfiguration,
} from "../config/mail.js";
import { readPushConfiguration } from "../config/push.js";
import { readServerConfiguration } from "../config/server.js";

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
try {
  const serverConfiguration = readServerConfiguration();
  ok(
    `Core startup configuration is valid for ${serverConfiguration.nodeEnvironment} on port ${serverConfiguration.port}.`
  );
} catch (error) {
  failure(
    error instanceof Error
      ? `Core startup configuration is invalid: ${error.message}`
      : "Core startup configuration is invalid."
  );
}

const mailErrors = getMailConfigurationErrors();
if (mailErrors.length > 0) {
  failure(`Mail configuration is invalid or incomplete: ${mailErrors.join(", ")}.`);
} else {
  const mailConfiguration = readMailConfiguration();
  if (mailConfiguration.enabled) ok("MAIL_ENABLED is true and required mail variables are configured.");
  else ok("MAIL_ENABLED is false; SMTP is intentionally disabled.");
}

try {
  const pushConfiguration = readPushConfiguration();
  if (pushConfiguration.enabled) {
    ok("Authenticated browser push notifications are enabled and VAPID keys are valid.");
  } else {
    ok("WEB_PUSH_ENABLED is false; browser push is intentionally disabled.");
  }
} catch (error) {
  failure(
    error instanceof Error
      ? `Browser push configuration is invalid: ${error.message}`
      : "Browser push configuration is invalid."
  );
}

let prisma;
try {
  const { PrismaClient } = await import("../generated/prisma-client/index.js");
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
      prisma.pushSubscription.count(),
      prisma.emailDelivery.count(),
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
