export interface Product {
  id: string;
  name: string;
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
  isRecommended?: boolean;
  isFastDelivery?: boolean;
  isNew?: boolean;
  isFavorite?: boolean;
  description?: string | null;
  sku?: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedOptions?: string | null;
}
