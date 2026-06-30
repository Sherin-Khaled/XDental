import type { AuthUser } from "@/context/StoreContext";
import type { ProductRequest, ProductRequestStepStatus } from "@/data/productRequests";
import type { ApiProductRequest, ProductRequestStatus } from "@/services/productRequests";

const statusOrder: ProductRequestStatus[] = ["Under Review", "Searching Supplier", "Available"];

function stepStatus(current: ProductRequestStatus, step: ProductRequestStatus): ProductRequestStepStatus {
  if (current === "Canceled" || current === "Not Available") {
    return step === "Under Review" ? "completed" : "pending";
  }
  const currentIndex = statusOrder.indexOf(current);
  const stepIndex = statusOrder.indexOf(step);
  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "current";
  return "pending";
}

export function toProductRequest(api: ApiProductRequest, user?: AuthUser | null): ProductRequest {
  return {
    id: api.id,
    requestNumber: api.requestNumber,
    createdAt: api.createdAt.slice(0, 10),
    lastUpdatedAt: api.updatedAt.slice(0, 10),
    productName: api.productName,
    brand: api.brand || "Brand not specified",
    category: api.category || "General",
    quantity: api.quantity ? String(api.quantity) : "1",
    branch: api.branch || "Main Clinic",
    status: api.status,
    update: api.message || `Product request status: ${api.status}.`,
    notes: api.notes || undefined,
    uploadedFile: api.attachments[0]?.name,
    contact: {
      name: api.user?.name ?? user?.name ?? "Dental Professional",
      phone: user?.phone ?? "",
      email: api.user?.email ?? user?.email ?? "",
      branch: api.branch || "Main Clinic",
    },
    teamUpdates: api.teamUpdates.map((update) => ({ title: update.title, date: update.date.slice(0, 10) })),
    statusSteps: [
      { label: "Submitted", note: api.createdAt.slice(0, 10), status: "completed" },
      { label: "Under Review", note: api.status === "Under Review" ? "Current" : "", status: stepStatus(api.status, "Under Review") },
      { label: "Searching Supplier", note: api.status === "Searching Supplier" ? "Current" : "", status: stepStatus(api.status, "Searching Supplier") },
      { label: "Available", note: api.status === "Available" ? "Current" : "", status: stepStatus(api.status, "Available") },
    ],
    availabilityResult: api.status === "Available" ? `${api.productName} is available.` : undefined,
    chatThreadId: api.chatThread?.id,
  };
}
