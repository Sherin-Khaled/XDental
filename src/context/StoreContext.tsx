import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { mockProducts } from "@/data/products";
import {
  AuthApiError,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  type AuthApiUser,
} from "@/services/auth";
import type { Product, CartItem } from "@/types/product";

export type AuthUserAddress = {
  id: string;
  name: string;
  line1: string;
  city: string;
  governorate: string;
  country: string;
  phone: string;
  isDefault: boolean;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  clinicName?: string;
  professionalRole?: string | null;
  isDemo?: boolean;
  stats?: {
    totalOrders: number;
    totalSpent: number;
    points: number;
  };
  addresses?: AuthUserAddress[];
};

type SignUpInput = {
  fullName: string;
  phone?: string;
  email: string;
  password: string;
  clinicName?: string;
};

type AuthActionResult =
  | { success: true }
  | { success: false; message: string };

interface StoreContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  currentUser: AuthUser | null;
  cart: CartItem[];
  wishlistIds: string[];
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (input: SignUpInput) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  updateCurrentUser: (updates: Partial<AuthUser>) => void;
  addToCart: (product: Product, quantity: number, selectedOptions?: string) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  removeFromWishlist: (productId: string) => void;
  clearWishlist: () => void;
  isInWishlist: (productId: string) => boolean;
  cartCount: number;
  cartTotal: number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);
const initialWishlistIds = mockProducts
  .filter((product) => product.isFavorite)
  .map((product) => product.id);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function toAuthUser(user: AuthApiUser): AuthUser {
  return user;
}

function getAuthErrorMessage(
  error: unknown,
  fallback: string,
  serviceUnavailableMessage: string
) {
  if (error instanceof AuthApiError) {
    return error.status === 0 ? serviceUnavailableMessage : error.message;
  }

  return fallback;
}

function clearLegacyPreviewAuthStorage() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem("x-dental-auth-session");
    window.localStorage.removeItem("x-dental-demo-auth");
    window.localStorage.removeItem("x-dental-mock-users");
  } catch {
    // Storage access can be unavailable; cookie authentication does not depend on it.
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>(initialWishlistIds);
  const authRequestId = useRef(0);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    clearLegacyPreviewAuthStorage();
    const controller = new AbortController();
    const requestId = ++authRequestId.current;

    getCurrentUser(controller.signal)
      .then((user) => {
        if (authRequestId.current === requestId) {
          setCurrentUser(toAuthUser(user));
        }
      })
      .catch(() => {
        if (authRequestId.current === requestId) {
          setCurrentUser(null);
        }
      })
      .finally(() => {
        if (authRequestId.current === requestId) {
          setIsAuthLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthActionResult> => {
    const requestId = ++authRequestId.current;

    try {
      const user = await loginUser(normalizeEmail(email), password);
      if (authRequestId.current === requestId) {
        setCurrentUser(toAuthUser(user));
        setIsAuthLoading(false);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: getAuthErrorMessage(
          error,
          t("auth.login.invalidDescription"),
          t("auth.serviceUnavailable")
        ),
      };
    }
  };

  const signUp = async ({
    fullName,
    phone,
    email,
    password,
  }: SignUpInput): Promise<AuthActionResult> => {
    const requestId = ++authRequestId.current;
    const normalizedPhone = cleanOptionalText(phone);

    try {
      const user = await registerUser({
        name: fullName.trim(),
        email: normalizeEmail(email),
        password,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      });
      if (authRequestId.current === requestId) {
        setCurrentUser(toAuthUser(user));
        setIsAuthLoading(false);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: getAuthErrorMessage(
          error,
          t("auth.signup.errorDescription", {
            fallback: "Unable to create the account. Please try again.",
          }),
          t("auth.serviceUnavailable")
        ),
      };
    }
  };

  const signOut = async () => {
    ++authRequestId.current;

    try {
      await logoutUser();
    } catch {
      // Local sign-out still completes if the server is temporarily unavailable.
    } finally {
      setCurrentUser(null);
      setIsAuthLoading(false);
    }
  };

  const updateCurrentUser = (updates: Partial<AuthUser>) => {
    setCurrentUser((current) => {
      if (!current) return current;

      const nextUser: AuthUser = {
        ...current,
        ...updates,
        id: current.id,
        isDemo: current.isDemo,
        name: updates.name?.trim() || current.name,
        email: updates.email ? normalizeEmail(updates.email) : current.email,
        phone: "phone" in updates ? cleanOptionalText(updates.phone) : current.phone,
        clinicName: "clinicName" in updates ? cleanOptionalText(updates.clinicName) : current.clinicName,
        professionalRole:
          "professionalRole" in updates
            ? cleanOptionalText(updates.professionalRole)
            : current.professionalRole,
      };

      return nextUser;
    });
  };

  const addToCart = (product: Product, quantity: number, selectedOptions?: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && item.selectedOptions === selectedOptions);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id && item.selectedOptions === selectedOptions
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity, selectedOptions }];
    });
    toast({
      title: "Added to Cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    toast({
      title: "Removed from Cart",
      description: "Item has been removed from your cart.",
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const toggleWishlist = (productId: string) => {
    setWishlistIds((prev) => {
      if (prev.includes(productId)) {
        toast({ title: "Removed from Wishlist", description: "Item removed from your wishlist." });
        return prev.filter((id) => id !== productId);
      }
      toast({ title: "Added to Wishlist", description: "Item added to your wishlist." });
      return [...prev, productId];
    });
  };

  const removeFromWishlist = (productId: string) => {
    setWishlistIds((prev) => prev.filter((id) => id !== productId));
    toast({ title: "Removed from Wishlist", description: "Item removed from your wishlist." });
  };

  const clearWishlist = () => {
    setWishlistIds([]);
    toast({ title: "Wishlist Cleared", description: "All saved products were removed from your wishlist." });
  };

  const isInWishlist = (productId: string) => wishlistIds.includes(productId);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + (item.product.currentPrice * item.quantity), 0);

  return (
    <StoreContext.Provider
      value={{
        isAuthenticated: currentUser !== null,
        isAuthLoading,
        currentUser,
        cart,
        wishlistIds,
        signIn,
        signUp,
        signOut,
        updateCurrentUser,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist,
        isInWishlist,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};
