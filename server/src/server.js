import "dotenv/config";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/db.js";

const port = Number(process.env.PORT) || 5000;

function getConfigurationError() {
  if (!process.env.MONGO_URI) return "MONGO_URI is required.";
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return "JWT_SECRET must contain at least 32 characters.";
  }
  return null;
}

const app = createApp();

app.listen(port, () => {
  console.log(`X Dental Store auth server is listening on port ${port}.`);
});

const configurationError = getConfigurationError();
if (configurationError) {
  console.error(`${configurationError} Authentication endpoints will return 503.`);
} else {
  connectDatabase(process.env.MONGO_URI)
    .then(() => {
      console.log("MongoDB connection established.");
    })
    .catch(() => {
      console.error(
        "MongoDB connection failed. Authentication endpoints will return 503; check MONGO_URI and restart the backend."
      );
    });
}
