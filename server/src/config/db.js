import { PrismaClient } from "../generated/prisma-client-runtime/index.js";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

let databaseReady = false;

export async function connectDatabase() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  databaseReady = true;
}

export async function disconnectDatabase() {
  databaseReady = false;
  await prisma.$disconnect();
}

export function isDatabaseReady() {
  return databaseReady;
}

export async function getDatabaseHealth() {
  if (!process.env.DATABASE_URL) {
    return { status: "not_configured", message: "DATABASE_URL is not configured." };
  }

  if (!databaseReady) {
    return { status: "disconnected", message: "PostgreSQL is not connected." };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "connected", message: "PostgreSQL is connected." };
  } catch {
    databaseReady = false;
    return { status: "disconnected", message: "PostgreSQL connection check failed." };
  }
}
