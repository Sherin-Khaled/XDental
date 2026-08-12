import { randomUUID } from "node:crypto";

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "off",
  "X-Download-Options": "noopen",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-XSS-Protection": "0",
};

export function addRequestId(request, response, next) {
  request.id = randomUUID();
  response.setHeader("X-Request-ID", request.id);
  return next();
}

export function addSecurityHeaders(_request, response, next) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.setHeader(name, value);
  }

  if (process.env.NODE_ENV === "production") {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return next();
}

export function preventPrivateCaching(_request, response, next) {
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
  return next();
}

export function logServerError(error, request, statusCode) {
  const event = {
    timestamp: new Date().toISOString(),
    level: "error",
    requestId: request.id,
    method: request.method,
    path: request.path,
    statusCode,
    errorName: error?.name ?? "Error",
    errorCode: typeof error?.code === "string" ? error.code : undefined,
  };

  if (process.env.NODE_ENV === "production") {
    console.error(JSON.stringify(event));
    return;
  }

  console.error(`[${request.id}] ${request.method} ${request.path} -> ${statusCode}`, error);
}
