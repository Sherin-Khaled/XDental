export type StatusTone = "green" | "amber" | "red" | "blue" | "purple" | "slate";

export const adminMetrics = [
  { label: "Total products", value: "428", detail: "36 added this month", tone: "blue" },
  { label: "Total brands", value: "52", detail: "8 featured brands", tone: "purple" },
  { label: "Total categories", value: "18", detail: "9 active catalog groups", tone: "green" },
  { label: "Pending orders", value: "14", detail: "6 awaiting payment", tone: "amber" },
  { label: "Pending quotes", value: "11", detail: "4 need supplier review", tone: "amber" },
  { label: "Low stock products", value: "23", detail: "Restock follow-up needed", tone: "red" },
] satisfies Array<{
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
}>;

export const adminProducts = [
  {
    id: "prod-001",
    sku: "XD-END-104",
    name: "WK-Flex K-File",
    brand: "Meta Biomed",
    category: "Endodontics",
    price: "EGP 150",
    stock: 42,
    status: "Active",
    tone: "green",
  },
  {
    id: "prod-002",
    sku: "XD-COM-210",
    name: "Filtek Z350 XT",
    brand: "3M",
    category: "Composites",
    price: "EGP 850",
    stock: 18,
    status: "Active",
    tone: "green",
  },
  {
    id: "prod-003",
    sku: "XD-ANE-088",
    name: "Articaine 4%",
    brand: "Septodont",
    category: "Anesthesia",
    price: "EGP 650",
    stock: 5,
    status: "Low stock",
    tone: "amber",
  },
  {
    id: "prod-004",
    sku: "XD-ORT-332",
    name: "Ceramic Brackets Kit",
    brand: "Forestadent",
    category: "Orthodontics",
    price: "EGP 1,450",
    stock: 0,
    status: "Out of stock",
    tone: "red",
  },
] satisfies Array<{
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: string;
  stock: number;
  status: string;
  tone: StatusTone;
}>;

export const adminCategories = [
  { id: "cat-001", name: "Endodontics", slug: "endodontics", products: 124, status: "Active", tone: "green" },
  { id: "cat-002", name: "Composites & Bonding", slug: "composites-bonding", products: 89, status: "Active", tone: "green" },
  { id: "cat-003", name: "Anesthesia", slug: "anesthesia", products: 45, status: "Active", tone: "green" },
  { id: "cat-004", name: "Whitening", slug: "whitening", products: 34, status: "Draft", tone: "slate" },
] satisfies Array<{
  id: string;
  name: string;
  slug: string;
  products: number;
  status: string;
  tone: StatusTone;
}>;

export const adminBrands = [
  { id: "brand-001", name: "3M", country: "USA", products: 45, featured: "Yes", status: "Active", tone: "green" },
  { id: "brand-002", name: "Dentsply Sirona", country: "USA", products: 32, featured: "Yes", status: "Active", tone: "green" },
  { id: "brand-003", name: "Septodont", country: "France", products: 18, featured: "No", status: "Active", tone: "green" },
  { id: "brand-004", name: "Meta Biomed", country: "South Korea", products: 15, featured: "No", status: "Needs logo", tone: "amber" },
] satisfies Array<{
  id: string;
  name: string;
  country: string;
  products: number;
  featured: string;
  status: string;
  tone: StatusTone;
}>;

export const adminOrders = [
  { id: "ORD-1048", customer: "Cairo Dental Center", items: 8, total: "EGP 12,450", status: "Pending payment", tone: "amber", date: "2026-06-13" },
  { id: "ORD-1047", customer: "Smile Clinic", items: 3, total: "EGP 4,120", status: "Processing", tone: "blue", date: "2026-06-13" },
  { id: "ORD-1046", customer: "Ortho Plus", items: 12, total: "EGP 18,900", status: "Ready to ship", tone: "green", date: "2026-06-12" },
] satisfies Array<{
  id: string;
  customer: string;
  items: number;
  total: string;
  status: string;
  tone: StatusTone;
  date: string;
}>;

export const adminQuotes = [
  { id: "QT-224", clinic: "New Cairo Dental Hub", products: 6, owner: "Sales team", status: "Supplier review", tone: "amber", date: "2026-06-14" },
  { id: "QT-223", clinic: "Alex Implant Center", products: 4, owner: "Operations", status: "Draft response", tone: "blue", date: "2026-06-13" },
  { id: "QT-222", clinic: "Mansoura Dental Care", products: 9, owner: "Sales team", status: "Sent", tone: "green", date: "2026-06-12" },
] satisfies Array<{
  id: string;
  clinic: string;
  products: number;
  owner: string;
  status: string;
  tone: StatusTone;
  date: string;
}>;

export const adminProductRequests = [
  { id: "PR-118", clinic: "Heliopolis Dental", request: "Bulk sterilization pouches", priority: "High", status: "Sourcing", tone: "amber" },
  { id: "PR-117", clinic: "X Dental Clinic", request: "Pediatric crowns set", priority: "Medium", status: "Pending review", tone: "blue" },
  { id: "PR-116", clinic: "Giza Smile Studio", request: "Implant torque wrench", priority: "Low", status: "Matched", tone: "green" },
] satisfies Array<{
  id: string;
  clinic: string;
  request: string;
  priority: string;
  status: string;
  tone: StatusTone;
}>;

export const adminUsers = [
  { id: "USR-301", name: "Dr. Sherin Khaled", role: "Clinic owner", email: "sherin@example.com", status: "Verified", tone: "green" },
  { id: "USR-302", name: "Omar Hassan", role: "Purchasing manager", email: "omar@example.com", status: "Invited", tone: "blue" },
  { id: "USR-303", name: "Nour Adel", role: "Dentist", email: "nour@example.com", status: "Needs review", tone: "amber" },
] satisfies Array<{
  id: string;
  name: string;
  role: string;
  email: string;
  status: string;
  tone: StatusTone;
}>;

export const adminSettings = [
  { label: "Store profile", value: "Configured", detail: "Name, support email, and contact channels", tone: "green" },
  { label: "Catalog controls", value: "Mock mode", detail: "Product publishing rules will connect later", tone: "blue" },
  { label: "Order workflow", value: "Draft", detail: "Status automation is not connected yet", tone: "slate" },
  { label: "Team permissions", value: "Not enabled", detail: "Authentication and roles are intentionally out of scope", tone: "amber" },
] satisfies Array<{
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
}>;
