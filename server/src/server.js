import "dotenv/config";
import { startBackend, stopBackend } from "./serverRuntime.js";

let runtime;
let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopBackend(runtime?.server).catch(() => {});
  process.exit(0);
}

try {
  runtime = await startBackend();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  console.error(
    `Backend startup failed: ${
      error instanceof Error ? error.message : "Unknown startup error."
    }`
  );
  process.exitCode = 1;
}
