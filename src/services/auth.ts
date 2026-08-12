import type {
  ClinicLocation,
  ClinicLocationInput,
} from "@/services/delivery";
import { API_BASE_URL } from "./apiConfig";

export type AuthApiUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  customerTier: "standard" | "vip";
  isActive: boolean;
  permissions: string[];
  phone?: string | null;
  professionalRole: string | null;
  clinicSpecialty: string | null;
  clinicName: string | null;
  profileImageUrl: string | null;
  clinicLocations: ClinicLocation[];
};

export type ProfileUpdateRequest = {
  name?: string;
  phone?: string;
  professionalRole?: string;
  clinicSpecialty?: string;
  clinicName?: string;
  clinicLocations?: ClinicLocationInput[];
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  professionalRole?: string;
  clinicSpecialty: string;
  clinicLocations: ClinicLocationInput[];
};

type AuthResponse = {
  user: AuthApiUser;
};

const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  "Authentication service is currently unavailable. Please try again later.";
const TECHNICAL_ERROR_PATTERN =
  /(https?:\/\/|localhost|127\.0\.0\.1|client_url|port\s+\d+|cors|econnrefused|enotfound|network error)/i;

export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

export function resolveAuthAssetUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!/^https?:\/\//i.test(API_BASE_URL)) return value;

  try {
    return new URL(value, new URL(API_BASE_URL).origin).toString();
  } catch {
    return value;
  }
}

async function authRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("Authentication service request failed.", {
        endpoint: `${API_BASE_URL}${path}`,
        error,
      });
    }

    throw new AuthApiError(AUTH_SERVICE_UNAVAILABLE_MESSAGE, 0);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
  } & Partial<T>;

  if (!response.ok) {
    const hasTechnicalMessage = Boolean(
      payload.message && TECHNICAL_ERROR_PATTERN.test(payload.message)
    );
    const isServiceUnavailable = response.status >= 500 || hasTechnicalMessage;

    if (import.meta.env.DEV && isServiceUnavailable) {
      console.error("Authentication service returned an unavailable response.", {
        endpoint: `${API_BASE_URL}${path}`,
        status: response.status,
        message: payload.message,
      });
    }

    throw new AuthApiError(
      isServiceUnavailable
        ? AUTH_SERVICE_UNAVAILABLE_MESSAGE
        : payload.message ?? "Authentication request failed.",
      isServiceUnavailable ? 0 : response.status
    );
  }

  return payload as T;
}

export async function registerUser(input: RegisterRequest) {
  const response = await authRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.user;
}

export async function loginUser(email: string, password: string) {
  const response = await authRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return response.user;
}

export async function logoutUser() {
  await authRequest<{ message: string }>("/auth/logout", { method: "POST" });
}

export async function getCurrentUser(signal?: AbortSignal) {
  const response = await authRequest<AuthResponse>("/auth/me", { signal });
  return response.user;
}

/** Persists profile changes; resolves with the server-confirmed user. */
export async function updateProfile(input: ProfileUpdateRequest) {
  const response = await authRequest<AuthResponse>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return response.user;
}

/** Uploads one validated profile image and resolves with the refreshed user. */
export async function uploadProfileImage(file: File) {
  const response = await authRequest<AuthResponse>("/auth/me/profile-image", {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  return response.user;
}

/** Changes the account password; rejects with AuthApiError(401) when the current password is wrong. */
export async function changePassword(currentPassword: string, newPassword: string) {
  return authRequest<{ message: string; signedOutOtherSessions: number }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
