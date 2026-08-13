const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === "production";

function getLimit(name, productionDefault, developmentDefault) {
  const configured = Number.parseInt(process.env[name] ?? "", 10);
  if (Number.isSafeInteger(configured) && configured > 0) return configured;
  return isProduction ? productionDefault : developmentDefault;
}

function clientKey(request) {
  return request.user?.id ?? request.ip ?? request.socket?.remoteAddress ?? "unknown";
}

function createRateLimiter({ name, windowMs, max, message, key = clientKey }) {
  const buckets = new Map();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }, Math.min(windowMs, 60_000));
  cleanupTimer.unref();

  return function rateLimit(request, response, next) {
    const now = Date.now();
    const bucketKey = `${name}:${key(request)}`;
    let bucket = buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    const remaining = Math.max(0, max - bucket.count);

    response.setHeader("RateLimit-Limit", String(max));
    response.setHeader("RateLimit-Remaining", String(remaining));
    response.setHeader("RateLimit-Reset", String(resetSeconds));
    response.setHeader("RateLimit-Policy", `${max};w=${Math.ceil(windowMs / 1000)}`);

    if (bucket.count > max) {
      response.setHeader("Retry-After", String(resetSeconds));
      return response.status(429).json({
        code: "RATE_LIMITED",
        message,
        retryAfterSeconds: resetSeconds,
      });
    }

    return next();
  };
}

export const loginRateLimit = createRateLimiter({
  name: "auth-login",
  windowMs: FIFTEEN_MINUTES_MS,
  max: getLimit("RATE_LIMIT_LOGIN_MAX", 10, 50),
  message: "Too many login attempts. Please wait and try again.",
  key: (request) => request.ip ?? request.socket?.remoteAddress ?? "unknown",
});

export const registerRateLimit = createRateLimiter({
  name: "auth-register",
  windowMs: ONE_HOUR_MS,
  max: getLimit("RATE_LIMIT_REGISTER_MAX", 5, 25),
  message: "Too many registration attempts. Please wait and try again.",
  key: (request) => request.ip ?? request.socket?.remoteAddress ?? "unknown",
});

export const passwordActionRateLimit = createRateLimiter({
  name: "password-action",
  windowMs: ONE_HOUR_MS,
  max: getLimit("RATE_LIMIT_PASSWORD_MAX", 10, 50),
  message: "Too many password-sensitive requests. Please wait and try again.",
});

export const supportMessageRateLimit = createRateLimiter({
  name: "support-message",
  windowMs: FIFTEEN_MINUTES_MS,
  max: getLimit("RATE_LIMIT_SUPPORT_MAX", 30, 120),
  message: "Too many support messages. Please wait before sending another message.",
});

export const quoteCreationRateLimit = createRateLimiter({
  name: "quote-create",
  windowMs: ONE_HOUR_MS,
  max: getLimit("RATE_LIMIT_QUOTE_MAX", 10, 50),
  message: "Too many quote requests. Please wait before creating another quote.",
});

export const productRequestCreationRateLimit = createRateLimiter({
  name: "product-request-create",
  windowMs: ONE_HOUR_MS,
  max: getLimit("RATE_LIMIT_PRODUCT_REQUEST_MAX", 10, 50),
  message: "Too many product requests. Please wait before creating another request.",
});

export const orderCreationRateLimit = createRateLimiter({
  name: "order-create",
  windowMs: FIFTEEN_MINUTES_MS,
  max: getLimit("RATE_LIMIT_ORDER_MAX", 20, 100),
  message: "Too many order attempts. Please wait before creating another order.",
});

export const cartMutationRateLimit = createRateLimiter({
  name: "cart-mutation",
  windowMs: FIFTEEN_MINUTES_MS,
  max: getLimit("RATE_LIMIT_CART_MAX", 300, 1_000),
  message: "Too many cart updates. Please wait and try again.",
});

export const wishlistMutationRateLimit = createRateLimiter({
  name: "wishlist-mutation",
  windowMs: FIFTEEN_MINUTES_MS,
  max: getLimit("RATE_LIMIT_WISHLIST_MAX", 300, 1_000),
  message: "Too many wishlist updates. Please wait and try again.",
});

export const supplyListMutationRateLimit = createRateLimiter({
  name: "supply-list-mutation",
  windowMs: FIFTEEN_MINUTES_MS,
  max: getLimit("RATE_LIMIT_SUPPLY_LIST_MAX", 200, 1_000),
  message: "Too many supply list updates. Please wait and try again.",
});

export const pushSubscriptionMutationRateLimit = createRateLimiter({
  name: "push-subscription-mutation",
  windowMs: FIFTEEN_MINUTES_MS,
  max: getLimit("RATE_LIMIT_PUSH_SUBSCRIPTION_MAX", 30, 100),
  message: "Too many notification subscription updates. Please wait and try again.",
});

export const publicOrderTrackingRateLimit = createRateLimiter({
  name: "order-public-track",
  windowMs: TEN_MINUTES_MS,
  max: getLimit("RATE_LIMIT_ORDER_TRACKING_MAX", 5, 5),
  message: "Too many tracking attempts. Please wait and try again.",
  key: (request) => request.ip ?? request.socket?.remoteAddress ?? "unknown",
});

export const couponValidationRateLimit = createRateLimiter({
  name: "coupon-validation",
  windowMs: TEN_MINUTES_MS,
  max: getLimit("RATE_LIMIT_COUPON_MAX", 20, 100),
  message: "Too many coupon attempts. Please wait and try again.",
  key: (request) => request.ip ?? request.socket?.remoteAddress ?? "unknown",
});

export const contactMessageRateLimit = createRateLimiter({
  name: "contact-message",
  windowMs: FIFTEEN_MINUTES_MS,
  max: getLimit("RATE_LIMIT_CONTACT_MAX", 5, 50),
  message: "Too many contact messages. Please wait before sending another message.",
  key: (request) => request.ip ?? request.socket?.remoteAddress ?? "unknown",
});

export const newsletterSubscribeRateLimit = createRateLimiter({
  name: "newsletter-subscribe",
  windowMs: ONE_HOUR_MS,
  max: getLimit("RATE_LIMIT_NEWSLETTER_MAX", 10, 50),
  message: "Too many subscription attempts. Please wait and try again.",
  key: (request) => request.ip ?? request.socket?.remoteAddress ?? "unknown",
});

export const emailRetryRateLimit = createRateLimiter({
  name: "email-retry",
  windowMs: FIFTEEN_MINUTES_MS,
  max: getLimit("RATE_LIMIT_EMAIL_RETRY_MAX", 10, 50),
  message: "Too many email retry attempts. Please wait and try again.",
});
