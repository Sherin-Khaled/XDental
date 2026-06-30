import type { Product } from "@/types/product";

export type ProductRequestStatus =
  | "Under Review"
  | "Available"
  | "Searching Supplier"
  | "Not Available"
  | "Canceled";

export type ProductRequestStepStatus = "completed" | "current" | "pending";

export type ProductRequest = {
  id: string;
  requestNumber: string;
  createdAt: string;
  lastUpdatedAt: string;
  productName: string;
  brand: string;
  category: string;
  quantity: string;
  branch: string;
  status: ProductRequestStatus;
  update: string;
  price?: number;
  product?: Product;
  productLinkProvided?: boolean;
  uploadedFile?: string;
  notes?: string;
  contact: {
    name: string;
    phone: string;
    email: string;
    branch: string;
  };
  teamUpdates: {
    title: string;
    date: string;
  }[];
  statusSteps: {
    label: string;
    note: string;
    status: ProductRequestStepStatus;
  }[];
  availabilityResult?: string;
  chatThreadId?: string;
};

export const requestedProduct: Product = {
  id: "requested-sterilization-pouches-200",
  name: "Sterilization Pouches 200 pcs",
  brand: "X Dental",
  category: "Infection Control",
  currentPrice: 240,
  stockStatus: "In Stock",
  image: undefined,
};

const defaultContact = {
  name: "Sherin Khaled",
  phone: "+20 100 123 4567",
  email: "sherin.khaled@example.com",
  branch: "Main Clinic",
};

export const initialProductRequests: ProductRequest[] = [
  {
    id: "request-1024",
    requestNumber: "PR-1024",
    createdAt: "2025-07-24",
    lastUpdatedAt: "2025-07-26",
    productName: "M3-Pro Gold Rotary Files Double",
    brand: "Denta Carts",
    category: "Endodontics",
    quantity: "2 packs",
    branch: "Main Clinic",
    status: "Under Review",
    update:
      "Our team is checking supplier availability and will update you once we receive confirmation.",
    productLinkProvided: true,
    uploadedFile: "product-reference.jpg",
    notes:
      "Looking for the double gold rotary file pack, size 25mm if available.",
    contact: defaultContact,
    teamUpdates: [
      { title: "Request submitted", date: "2025-07-24" },
      { title: "Team started checking suppliers", date: "2025-07-25" },
      { title: "Awaiting supplier response", date: "2025-07-26" },
    ],
    statusSteps: [
      { label: "Submitted", note: "24 Jul", status: "completed" },
      { label: "Under Review", note: "Current", status: "current" },
      { label: "Searching Supplier", note: "Pending", status: "pending" },
      { label: "Available", note: "Pending", status: "pending" },
    ],
  },
  {
    id: "request-1021",
    requestNumber: "PR-1021",
    createdAt: "2025-07-20",
    lastUpdatedAt: "2025-07-22",
    productName: "Sterilization Pouches 200 pcs",
    brand: "X Dental",
    category: "Infection Control",
    quantity: "3 packs",
    branch: "Dokki Branch",
    status: "Available",
    update: "This product is now available in the store.",
    price: 240,
    product: requestedProduct,
    productLinkProvided: false,
    contact: { ...defaultContact, branch: "Dokki Branch" },
    teamUpdates: [
      { title: "Request submitted", date: "2025-07-20" },
      { title: "Supplier confirmed availability", date: "2025-07-22" },
    ],
    statusSteps: [
      { label: "Submitted", note: "20 Jul", status: "completed" },
      { label: "Under Review", note: "Complete", status: "completed" },
      { label: "Searching Supplier", note: "Complete", status: "completed" },
      { label: "Available", note: "Current", status: "current" },
    ],
    availabilityResult: "Available for EGP 240 per pack. Ready to add to cart.",
  },
  {
    id: "request-1019",
    requestNumber: "PR-1019",
    createdAt: "2025-07-15",
    lastUpdatedAt: "2025-07-18",
    productName: "Specific Shade Composite A3.5",
    brand: "Tokuyama Dental",
    category: "Restorative",
    quantity: "5 syringes",
    branch: "General",
    status: "Searching Supplier",
    update: "We are checking availability with suppliers.",
    productLinkProvided: false,
    contact: { ...defaultContact, branch: "General" },
    teamUpdates: [
      { title: "Request submitted", date: "2025-07-15" },
      { title: "Supplier search started", date: "2025-07-18" },
    ],
    statusSteps: [
      { label: "Submitted", note: "15 Jul", status: "completed" },
      { label: "Under Review", note: "Complete", status: "completed" },
      { label: "Searching Supplier", note: "Current", status: "current" },
      { label: "Available", note: "Pending", status: "pending" },
    ],
  },
  {
    id: "request-1008",
    requestNumber: "PR-1008",
    createdAt: "2025-02-02",
    lastUpdatedAt: "2025-02-06",
    productName: "Implant Driver Refill Kit",
    brand: "Osstem",
    category: "Implantology",
    quantity: "1 kit",
    branch: "Main Clinic",
    status: "Not Available",
    update: "Supplier confirmed this item is not available right now.",
    productLinkProvided: false,
    contact: defaultContact,
    teamUpdates: [
      { title: "Request submitted", date: "2025-02-02" },
      { title: "Supplier confirmed unavailable", date: "2025-02-06" },
    ],
    statusSteps: [
      { label: "Submitted", note: "2 Feb", status: "completed" },
      { label: "Under Review", note: "Complete", status: "completed" },
      { label: "Searching Supplier", note: "Complete", status: "completed" },
      { label: "Available", note: "Unavailable", status: "pending" },
    ],
    availabilityResult:
      "Supplier confirmed this exact refill kit is unavailable right now.",
  },
];

export function getProductRequestById(id: string | undefined) {
  return initialProductRequests.find((request) => request.id === id);
}
