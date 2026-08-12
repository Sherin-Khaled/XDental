import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { validateMailConfiguration } from "./config/mail.js";
import { validatePushConfiguration } from "./config/push.js";
import { readServerConfiguration } from "./config/server.js";
import { validateUploadStorageConfiguration } from "./config/uploadStorage.js";

export class BackendStartupError extends Error {
  constructor(message) {
    super(message);
    this.name = "BackendStartupError";
  }
}

export function listenForRequests(app, port) {
  return new Promise((resolve, reject) => {
    let server;
    const handleError = () => {
      reject(
        new BackendStartupError(
          "The backend could not listen on PORT. Confirm that the configured port is available."
        )
      );
    };

    try {
      server = app.listen(port, () => {
        server.off("error", handleError);
        resolve(server);
      });
      server.once("error", handleError);
    } catch {
      handleError();
    }
  });
}

export async function startBackend({
  environment = process.env,
  connect = connectDatabase,
  disconnect = disconnectDatabase,
  buildApp = createApp,
  listen = listenForRequests,
  validateMail = validateMailConfiguration,
  validatePush = validatePushConfiguration,
  validateUploadStorage = validateUploadStorageConfiguration,
  logger = console,
} = {}) {
  const configuration = readServerConfiguration(environment);
  const mailConfiguration = validateMail(environment);
  const pushConfiguration = validatePush(environment);
  const uploadStorageConfiguration = validateUploadStorage(environment);

  logger.log(
    mailConfiguration.enabled
      ? "Company email notifications are enabled."
      : "Company email notifications are intentionally disabled."
  );
  logger.log(
    pushConfiguration.enabled
      ? "Authenticated browser push notifications are enabled."
      : "Browser push notifications are intentionally disabled."
  );
  logger.log(
    uploadStorageConfiguration.driver === "s3"
      ? "Durable object storage is enabled for uploaded images."
      : "Local image storage is enabled for development."
  );

  try {
    await connect();
  } catch {
    await disconnect().catch(() => {});
    throw new BackendStartupError(
      "PostgreSQL connection failed. Verify DATABASE_URL and database availability."
    );
  }

  let server;
  try {
    const app = buildApp({
      allowedOrigins: configuration.clientOrigins,
      production: configuration.production,
    });
    server = await listen(app, configuration.port);
  } catch (error) {
    await disconnect().catch(() => {});
    if (error instanceof BackendStartupError) throw error;
    throw new BackendStartupError(
      "The backend application could not be initialized."
    );
  }

  logger.log("PostgreSQL connection established through Prisma.");
  logger.log(`X Dental Store API is listening on port ${configuration.port}.`);

  return {
    configuration,
    mailConfiguration,
    pushConfiguration,
    uploadStorageConfiguration,
    server,
  };
}

export async function stopBackend(
  server,
  { disconnect = disconnectDatabase } = {}
) {
  await new Promise((resolve) => {
    if (!server?.listening) return resolve();
    server.close(() => resolve());
  });
  await disconnect();
}
