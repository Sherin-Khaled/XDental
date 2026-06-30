function hasEmailConfiguration() {
  return Boolean(
    process.env.EMAIL_FROM &&
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

export async function sendEmailIfConfigured({ event }) {
  if (process.env.EMAIL_ENABLED !== "true") {
    return { sent: false, skipped: true, reason: "disabled" };
  }

  if (!hasEmailConfiguration()) {
    return { sent: false, skipped: true, reason: "missing-configuration" };
  }

  // TODO: connect an SMTP/provider adapter before production. Never log recipients or message content.
  return { sent: false, skipped: true, reason: "provider-not-configured", event };
}
