export interface Product {
  id: string;
  name: string;
  nameAr?: string | null;
  brand: string;
  category: string;
  image?: string;
  currentPrice: number;
  oldPrice?: number | null;
  discountPercentage?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  stockStatus: string;
  deliveryLabel?: string | null;
  options?: string[];
  isWeeklyOffer?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isHotDeal?: boolean;
  isRecommended?: boolean;
  isFastDelivery?: boolean;
  isNew?: boolean;
  purchaseMode?: "STANDARD" | "INQUIRY" | "QUOTE";
  isFavorite?: boolean;
  description?: string | null;
  descriptionAr?: string | null;
  shortDescription?: string | null;
  shortDescriptionAr?: string | null;
  sku?: string | null;
  slug?: string | null;
  stockQuantity?: number | null;
  status?: "ACTIVE" | "LOW_STOCK" | "OUT_OF_STOCK";
  available?: boolean;
}

export interface CartItem {
  id?: string;
  product: Product;
  quantity: number;
  selectedOptions?: string | null;
  stockIssue?: {
    code: "PRODUCT_UNAVAILABLE" | "INSUFFICIENT_STOCK";
    requestedQuantity: number;
    availableQuantity: number | null;
    productId: string;
    productName: string;
  } | null;
}
