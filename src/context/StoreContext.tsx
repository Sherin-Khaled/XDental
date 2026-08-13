import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import type { Language } from "@/context/LanguageContext";
import {
  AuthApiError,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  type AuthApiUser,
} from "@/services/auth";
import {
  normalizeClinicSpecialty,
} from "@/lib/clinicSpecialties";
import type { Product, CartItem } from "@/types/product";
import type {
  ClinicLocation,
  ClinicLocationInput,
} from "@/services/delivery";
import {
  addMyCartItem,
  clearMyCart,
  fetchMyCart,
  mergeMyCart,
  removeMyCartItem,
  updateMyCartItem,
  type CartItemInput,
} from "@/services/cart";
import { disconnectBrowserPushForCustomer } from "@/services/pushNotifications";
import {
  getAccountPreferences,
  updateAccountPreferences,
} from "@/services/account";
import { ApiError } from "@/services/http";
import {
  cartProductQuantity,
  guardProductQuantity,
  quantityAfterLineUpdate,
  type CartQuantityGuardResult,
} from "@/lib/cartStock";

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
  customerTier?: "standard" | "vip";
  isActive?: boolean;
  permissions?: string[];
  phone?: string;
  clinicName?: string;
  profileImageUrl?: string;
  professionalRole?: string | null;
  clinicSpecialty?: string | null;
  clinicLocations: ClinicLocation[];
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
  clinicSpecialty: string;
  clinicLocations: ClinicLocationInput[];
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
  changeLanguage: (language: Language) => Promise<boolean>;
  updateCurrentUser: (updates: Partial<AuthUser>) => void;
  addToCart: (product: Product, quantity: number, selectedOptions?: string) => CartQuantityGuardResult;
  removeFromCart: (productId: string, selectedOptions?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, selectedOptions?: string | null) => CartQuantityGuardResult | null;
  clearCart: () => void;
  waitForCartSync: () => Promise<void>;
  toggleWishlist: (productId: string) => void;
  removeFromWishlist: (productId: string) => void;
  clearWishlist: () => void;
  isInWishlist: (productId: string) => boolean;
  cartCount: number;
  cartTotal: number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);
const initialWishlistIds: string[] = [];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function toAuthUser(user: AuthApiUser): AuthUser {
  return {
    ...user,
    phone: cleanOptionalText(user.phone),
    clinicName: cleanOptionalText(user.clinicName),
    profileImageUrl: cleanOptionalText(user.profileImageUrl),
    clinicSpecialty: user.clinicSpecialty
      ? normalizeClinicSpecialty(user.clinicSpecialty)
      : null,
    clinicLocations: user.clinicLocations ?? [],
  };
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
  const currentUserRef = useRef<AuthUser | null>(null);
  const cartRef = useRef<CartItem[]>([]);
  const cartSyncQueue = useRef<Promise<void>>(Promise.resolve());
  const cartMutationRevision = useRef(0);
  const languageSaveRequestId = useRef(0);
  const languageSaveInFlight = useRef<{
    language: Language;
    promise: Promise<boolean>;
  } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();

  const loadAuthenticatedLanguage = async (
    user: AuthUser,
    browserLanguage: Language,
    signal?: AbortSignal
  ) => {
    if (user.role.toLowerCase() !== "customer") return;
    const result = await getAccountPreferences(signal);
    if (result.persisted) {
      setLanguage(result.preferences.language);
      return;
    }
    await updateAccountPreferences(
      { language: browserLanguage },
      signal
    );
  };

  const replaceCart = (items: CartItem[]) => {
    cartRef.current = items;
    setCart(items);
  };

  const updateCart = (updater: (items: CartItem[]) => CartItem[]) => {
    const nextItems = updater(cartRef.current);
    cartRef.current = nextItems;
    setCart(nextItems);
  };

  const toCartItemInputs = (items: CartItem[]): CartItemInput[] =>
    items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions,
    }));

  const loadAuthenticatedCart = async (
    guestItems: CartItem[],
    signal?: AbortSignal
  ) => guestItems.length > 0
    ? mergeMyCart(toCartItemInputs(guestItems))
    : fetchMyCart(signal);

  const showCartSyncError = (error?: unknown) => {
    if (
      error instanceof ApiError &&
      (error.code === "INSUFFICIENT_STOCK" || error.code === "PRODUCT_UNAVAILABLE")
    ) {
      const payload = error.payload as { availableQuantity?: number | null } | undefined;
      const availableQuantity = payload?.availableQuantity;
      toast({
        title: t("cart.stockChangedTitle", { fallback: "Available quantity changed" }),
        description:
          typeof availableQuantity === "number"
            ? t("cart.onlyCurrentlyAvailable", {
                fallback: "Only {count} currently available.",
                values: { count: availableQuantity },
              })
            : t("cart.availableQuantityChanged", {
                fallback: "The available quantity changed. Update this item before checkout.",
              }),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: t("cart.syncErrorTitle", { fallback: "Cart not saved" }),
      description: t("cart.syncErrorBody", {
        fallback: "Your cart is still visible here, but it could not be saved to your account. Please try again.",
      }),
      variant: "destructive",
    });
  };

  const enqueueCartMutation = (
    mutation: () => Promise<CartItem[]>,
    revision: number
  ) => {
    cartSyncQueue.current = cartSyncQueue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const serverCart = await mutation();
          if (cartMutationRevision.current === revision) replaceCart(serverCart);
        } catch (error) {
          showCartSyncError(error);
          try {
            const serverCart = await fetchMyCart();
            if (cartMutationRevision.current === revision) replaceCart(serverCart);
          } catch {
            // Preserve the visible local cart when the authoritative refresh is unavailable.
          }
        }
      });
  };

  useEffect(() => {
    clearLegacyPreviewAuthStorage();
    const controller = new AbortController();
    const requestId = ++authRequestId.current;

    void (async () => {
      try {
        const user = toAuthUser(await getCurrentUser(controller.signal));
        if (authRequestId.current !== requestId) return;
        currentUserRef.current = user;
        setCurrentUser(user);

        try {
          await loadAuthenticatedLanguage(user, language, controller.signal);
        } catch {
          // Authentication remains usable if preference loading is temporarily unavailable.
        }

        try {
          const authenticatedCart = await loadAuthenticatedCart(
            cartRef.current,
            controller.signal
          );
          if (authRequestId.current === requestId) replaceCart(authenticatedCart);
        } catch {
          if (!controller.signal.aborted) showCartSyncError();
        }
      } catch {
        if (authRequestId.current === requestId) {
          currentUserRef.current = null;
          setCurrentUser(null);
        }
      } finally {
        if (authRequestId.current === requestId) setIsAuthLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthActionResult> => {
    const requestId = ++authRequestId.current;
    const guestItems = cartRef.current;
    clearLegacyPreviewAuthStorage();
    queryClient.clear();
    currentUserRef.current = null;
    setCurrentUser(null);
    setWishlistIds([]);
    setIsAuthLoading(true);

    try {
      const user = await loginUser(normalizeEmail(email), password);
      if (authRequestId.current === requestId) {
        const authenticatedUser = toAuthUser(user);
        currentUserRef.current = authenticatedUser;
        setCurrentUser(authenticatedUser);
        try {
          await loadAuthenticatedLanguage(authenticatedUser, language);
        } catch {
          // Settings exposes a retry state; authentication must still succeed.
        }
        try {
          const authenticatedCart = await loadAuthenticatedCart(guestItems);
          if (authRequestId.current === requestId) replaceCart(authenticatedCart);
        } catch {
          if (authRequestId.current === requestId) showCartSyncError();
        }
        if (authRequestId.current === requestId) setIsAuthLoading(false);
      }
      return { success: true };
    } catch (error) {
      if (authRequestId.current === requestId) {
        currentUserRef.current = null;
        setCurrentUser(null);
        setIsAuthLoading(false);
      }
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
    clinicSpecialty,
    clinicLocations,
  }: SignUpInput): Promise<AuthActionResult> => {
    const requestId = ++authRequestId.current;
    const guestItems = cartRef.current;
    const normalizedPhone = cleanOptionalText(phone);
    clearLegacyPreviewAuthStorage();
    queryClient.clear();
    currentUserRef.current = null;
    setCurrentUser(null);
    setWishlistIds([]);
    setIsAuthLoading(true);

    try {
      const user = await registerUser({
        name: fullName.trim(),
        email: normalizeEmail(email),
        password,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
        clinicSpecialty: normalizeClinicSpecialty(clinicSpecialty),
        clinicLocations,
      });
      if (authRequestId.current === requestId) {
        const authenticatedUser = toAuthUser(user);
        currentUserRef.current = authenticatedUser;
        setCurrentUser(authenticatedUser);
        try {
          await loadAuthenticatedLanguage(authenticatedUser, language);
        } catch {
          // Settings exposes a retry state; account creation must still succeed.
        }
        try {
          const authenticatedCart = await loadAuthenticatedCart(guestItems);
          if (authRequestId.current === requestId) replaceCart(authenticatedCart);
        } catch {
          if (authRequestId.current === requestId) showCartSyncError();
        }
        if (authRequestId.current === requestId) setIsAuthLoading(false);
      }
      return { success: true };
    } catch (error) {
      if (authRequestId.current === requestId) {
        currentUserRef.current = null;
        setCurrentUser(null);
        setIsAuthLoading(false);
      }
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
    const signedOutUser = currentUserRef.current;
    ++authRequestId.current;
    clearLegacyPreviewAuthStorage();
    queryClient.clear();
    currentUserRef.current = null;
    setCurrentUser(null);
    replaceCart([]);
    setWishlistIds([]);
    setIsAuthLoading(false);
    languageSaveRequestId.current += 1;
    languageSaveInFlight.current = null;
    setLanguage("en");

    try {
      await cartSyncQueue.current;
    } catch {
      // Local sign-out still completes if cart synchronization is unavailable.
    }

    if (signedOutUser?.role.toUpperCase() === "CUSTOMER") {
      try {
        await disconnectBrowserPushForCustomer();
      } catch {
        // The browser subscription is best-effort cleanup; logout must continue.
      }
    }

    try {
      await logoutUser();
    } catch {
      // Local sign-out still completes if the server is temporarily unavailable.
    }
  };

  const changeLanguage = (nextLanguage: Language): Promise<boolean> => {
    if (nextLanguage === language) return Promise.resolve(true);
    if (languageSaveInFlight.current?.language === nextLanguage) {
      return languageSaveInFlight.current.promise;
    }

    const previousLanguage = language;
    const requestId = ++languageSaveRequestId.current;
    const userAtStart = currentUserRef.current;
    setLanguage(nextLanguage);

    if (!userAtStart || userAtStart.role.toLowerCase() !== "customer") {
      return Promise.resolve(true);
    }

    const promise = updateAccountPreferences({ language: nextLanguage })
      .then(() => true)
      .catch(() => {
        if (
          languageSaveRequestId.current === requestId
          && currentUserRef.current?.id === userAtStart.id
        ) {
          setLanguage(previousLanguage);
          toast({
            title: t("accountPages.settings.saveFailedTitle", {
              fallback: "Preference not saved",
            }),
            description: t("accountPages.settings.saveFailed", {
              fallback: "Your preference could not be saved. Please try again.",
            }),
            variant: "destructive",
          });
        }
        return false;
      })
      .finally(() => {
        if (languageSaveInFlight.current?.promise === promise) {
          languageSaveInFlight.current = null;
        }
      });
    languageSaveInFlight.current = { language: nextLanguage, promise };
    return promise;
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
        clinicSpecialty:
          "clinicSpecialty" in updates
            ? updates.clinicSpecialty
              ? normalizeClinicSpecialty(updates.clinicSpecialty)
              : null
            : current.clinicSpecialty,
      };

      currentUserRef.current = nextUser;
      return nextUser;
    });
  };

  const addToCart = (product: Product, quantity: number, selectedOptions?: string) => {
    if ((product.purchaseMode ?? "STANDARD") !== "STANDARD") {
      const blocked = {
        ok: false as const,
        code: "PRODUCT_UNAVAILABLE" as const,
        requestedQuantity: quantity,
        availableQuantity: 0,
        productId: product.id,
        productName: product.name,
      };
      toast({
        title: t("cart.productRequiresRequestTitle", { fallback: "Request required" }),
        description: t("cart.productRequiresRequest", { fallback: "This product must be requested directly and cannot be added to the cart." }),
        variant: "destructive",
      });
      return blocked;
    }
    const normalizedOptions = selectedOptions?.trim() || undefined;
    const requestedTotal = cartProductQuantity(cartRef.current, product.id) + quantity;
    const guard = guardProductQuantity(product, requestedTotal);
    if (!guard.ok) {
      toast({
        title: t("cart.quantityLimitTitle", { fallback: "Quantity limit reached" }),
        description:
          guard.code === "PRODUCT_UNAVAILABLE"
            ? t("cart.productUnavailable", {
                fallback: "This product is not currently available.",
              })
            : t("cart.maximumAlreadyInCart", {
                fallback: "You already have the maximum available quantity in your cart.",
              }),
        variant: "destructive",
      });
      return guard;
    }

    updateCart((prev) => {
      const existing = prev.find(
        (item) =>
          item.product.id === product.id &&
          (item.selectedOptions ?? undefined) === normalizedOptions
      );
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id &&
          (item.selectedOptions ?? undefined) === normalizedOptions
            ? { ...item, product, quantity: item.quantity + quantity, stockIssue: null }
            : item
        );
      }
      return [...prev, { product, quantity, selectedOptions: normalizedOptions }];
    });
    if (currentUserRef.current) {
      const revision = ++cartMutationRevision.current;
      enqueueCartMutation(() => addMyCartItem({
        productId: product.id,
        quantity,
        selectedOptions: normalizedOptions,
      }), revision);
    }
    toast({
      title: t("cart.addedTitle", { fallback: "Added to Cart" }),
      description: t("cart.addedDescription", {
        fallback: "{name} has been added to your cart.",
        values: { name: product.name },
      }),
    });
    return guard;
  };

  const removeFromCart = (productId: string, selectedOptions?: string | null) => {
    const normalizedOptions = selectedOptions?.trim() || undefined;
    updateCart((prev) =>
      prev.filter(
        (item) =>
          item.product.id !== productId ||
          (item.selectedOptions ?? undefined) !== normalizedOptions
      )
    );
    if (currentUserRef.current) {
      const revision = ++cartMutationRevision.current;
      enqueueCartMutation(
        () => removeMyCartItem(productId, normalizedOptions),
        revision
      );
    }
    toast({
      title: "Removed from Cart",
      description: "Item has been removed from your cart.",
    });
  };

  const updateQuantity = (
    productId: string,
    quantity: number,
    selectedOptions?: string | null
  ) => {
    const normalizedOptions = selectedOptions?.trim() || undefined;
    if (quantity <= 0) {
      removeFromCart(productId, normalizedOptions);
      return null;
    }

    const currentItem = cartRef.current.find(
      (item) =>
        item.product.id === productId &&
        (item.selectedOptions ?? undefined) === normalizedOptions
    );
    if (!currentItem) return null;
    const requestedTotal = quantityAfterLineUpdate(
      cartRef.current,
      productId,
      currentItem.quantity,
      quantity
    );
    const guard = guardProductQuantity(currentItem.product, requestedTotal);
    if (!guard.ok) {
      toast({
        title: t("cart.quantityLimitTitle", { fallback: "Quantity limit reached" }),
        description:
          typeof guard.availableQuantity === "number"
            ? t("cart.onlyCurrentlyAvailable", {
                fallback: "Only {count} currently available.",
                values: { count: guard.availableQuantity },
              })
            : t("cart.availableQuantityChanged", {
                fallback: "The available quantity changed. Update this item before checkout.",
              }),
        variant: "destructive",
      });
      return guard;
    }
    updateCart((prev) =>
      prev.map((item) =>
        item.product.id === productId &&
        (item.selectedOptions ?? undefined) === normalizedOptions
          ? { ...item, quantity, stockIssue: null }
          : item
      )
    );
    if (currentUserRef.current) {
      const revision = ++cartMutationRevision.current;
      enqueueCartMutation(() => updateMyCartItem({
        productId,
        quantity,
        selectedOptions: normalizedOptions,
      }), revision);
    }
    return guard;
  };

  const clearCart = () => {
    replaceCart([]);
    if (currentUserRef.current) {
      const revision = ++cartMutationRevision.current;
      enqueueCartMutation(clearMyCart, revision);
    }
  };

  const waitForCartSync = () => cartSyncQueue.current;

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
        changeLanguage,
        updateCurrentUser,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        waitForCartSync,
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
