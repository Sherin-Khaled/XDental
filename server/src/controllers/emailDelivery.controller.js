import { getEmailDeliveries, retryEmailDelivery } from "../services/email.service.js";
import { cleanText, isValidId } from "../utils/records.js";

const CATEGORIES = new Set([
  "CONTACT",
  "NEWSLETTER",
  "QUOTE",
  "PRODUCT_REQUEST",
  "MACHINE_INQUIRY",
  "SUPPORT",
]);
const STATUSES = new Set(["DISABLED", "PENDING", "SENT", "FAILED"]);

export async function getAdminEmailDeliveries(request, response) {
  const category = cleanText(request.query?.category, 40).toUpperCase();
  const status = cleanText(request.query?.status, 20).toUpperCase();
  const search = cleanText(request.query?.search, 120);

  if (category && !CATEGORIES.has(category)) {
    return response.status(400).json({ message: "Invalid email category." });
  }
  if (status && !STATUSES.has(status)) {
    return response.status(400).json({ message: "Invalid email delivery status." });
  }

  const deliveries = await getEmailDeliveries({
    category: category || undefined,
    status: status || undefined,
    search: search || undefined,
  });
  return response.json({ emailDeliveries: deliveries });
}

export async function retryAdminEmailDelivery(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Email delivery record not found." });
  }

  try {
    const result = await retryEmailDelivery(request.params.id);
    if (result.reason === "disabled") {
      return response.status(409).json({
        code: "MAIL_NOT_CONFIGURED",
        message: "Company email notifications are not configured yet.",
        emailDelivery: result.delivery,
      });
    }
    return response.json({ emailDelivery: result.delivery });
  } catch (error) {
    if (error?.code === "EMAIL_DELIVERY_NOT_FOUND") {
      return response.status(404).json({ message: error.message });
    }
    if (error?.code === "EMAIL_RETRY_THROTTLED") {
      return response.status(429).json({ code: error.code, message: error.message });
    }
    throw error;
  }
}

