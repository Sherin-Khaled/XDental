import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import webpush from "web-push";
import { readPushConfiguration } from "../config/push.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const environmentPath = path.resolve(scriptDirectory, "../../.env");
const original = fs.existsSync(environmentPath)
  ? fs.readFileSync(environmentPath, "utf8")
  : "";
const current = dotenv.parse(original);

function replaceEnvironmentValue(source, name, value) {
  const line = `${name}="${value}"`;
  const pattern = new RegExp(`^\\s*${name}\\s*=.*$`, "m");
  if (pattern.test(source)) return source.replace(pattern, line);

  const separator = source.length === 0 || source.endsWith("\n") ? "" : "\n";
  return `${source}${separator}${line}\n`;
}

const hasPublicKey = Boolean(current.WEB_PUSH_VAPID_PUBLIC_KEY?.trim());
const hasPrivateKey = Boolean(current.WEB_PUSH_VAPID_PRIVATE_KEY?.trim());
if (hasPublicKey !== hasPrivateKey) {
  throw new Error(
    "Local push setup stopped because only one VAPID key exists. Complete or remove that pair before retrying."
  );
}

const generated = hasPublicKey
  ? {
      publicKey: current.WEB_PUSH_VAPID_PUBLIC_KEY.trim(),
      privateKey: current.WEB_PUSH_VAPID_PRIVATE_KEY.trim(),
    }
  : webpush.generateVAPIDKeys();
const subject =
  current.WEB_PUSH_VAPID_SUBJECT?.trim() ||
  "mailto:notifications@xdental.local";

readPushConfiguration({
  WEB_PUSH_ENABLED: "true",
  WEB_PUSH_VAPID_SUBJECT: subject,
  WEB_PUSH_VAPID_PUBLIC_KEY: generated.publicKey,
  WEB_PUSH_VAPID_PRIVATE_KEY: generated.privateKey,
});

let next = original;
next = replaceEnvironmentValue(next, "WEB_PUSH_ENABLED", "true");
next = replaceEnvironmentValue(next, "WEB_PUSH_VAPID_SUBJECT", subject);
next = replaceEnvironmentValue(
  next,
  "WEB_PUSH_VAPID_PUBLIC_KEY",
  generated.publicKey
);
next = replaceEnvironmentValue(
  next,
  "WEB_PUSH_VAPID_PRIVATE_KEY",
  generated.privateKey
);

fs.writeFileSync(environmentPath, next, { encoding: "utf8", mode: 0o600 });
console.log(
  hasPublicKey
    ? "Existing local browser-push keys were validated and enabled."
    : "New local browser-push keys were generated, validated, and enabled."
);
console.log("The private VAPID key was not displayed.");
