export type AuthApiUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  professionalRole: string | null;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  professionalRole?: string;
};

type AuthResponse = {
  user: AuthApiUser;
};

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:5000/api"
).replace(/\/$/, "");

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
