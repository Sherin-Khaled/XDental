const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:5000/api").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
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
  } catch {
    throw new ApiError("The service is currently unavailable. Please try again.", 0);
  }

  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    throw new ApiError(payload.message ?? "The request could not be completed.", response.status);
  }
  return payload;
}
