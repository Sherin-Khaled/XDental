import "dotenv/config";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";

const port = Number(process.env.PORT) || 5000;

function getConfigurationError() {
  if (!process.env.DATABASE_URL) return "DATABASE_URL is required.";
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return "JWT_SECRET must contain at least 32 characters.";
  }
  return null;
}

const app = createApp();

const server = app.listen(port, () => {
  console.log(`X Dental Store API is listening on port ${port}.`);
});

const configurationError = getConfigurationError();
if (configurationError) {
  console.error(`${configurationError} Database-backed endpoints will return 503.`);
} else {
  connectDatabase()
    .then(() => {
      console.log("PostgreSQL connection established through Prisma.");
    })
    .catch(() => {
      console.error(
        "PostgreSQL connection failed. Database-backed endpoints will return 503; check DATABASE_URL and restart the backend."
      );
    });
}

async function shutdown() {
  server.close(async () => {
    await disconnectDatabase().catch(() => {});
    process.exit(0);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
