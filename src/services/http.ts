import { API_BASE_URL } from "./apiConfig";

export function resolveApiAssetUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!/^https?:\/\//i.test(API_BASE_URL)) return value;

  try {
    return new URL(value, new URL(API_BASE_URL).origin).toString();
  } catch {
    return value;
  }
}

export class ApiError extends Error {
  status: number;
  field?: string;
  code?: string;
  payload?: unknown;

  constructor(message: string, status: number, field?: string, code?: string, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
    this.code = code;
    this.payload = payload;
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

  const payload = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    field?: string;
    code?: string;
  };
  if (!response.ok) {
    throw new ApiError(
      payload.message ?? "The request could not be completed.",
      response.status,
      payload.field,
      payload.code,
      payload
    );
  }
  return payload;
}

export type ApiDownload = {
  blob: Blob;
  filename: string | null;
};

function downloadFilename(header: string | null) {
  if (!header) return null;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }
  return header.match(/filename="?([^";]+)"?/i)?.[1] ?? null;
}

export async function apiDownload(path: string, options: RequestInit = {}): Promise<ApiDownload> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
    });
  } catch {
    throw new ApiError("The service is currently unavailable. Please try again.", 0);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(payload.message ?? "The download could not be completed.", response.status);
  }

  return {
    blob: await response.blob(),
    filename: downloadFilename(response.headers.get("content-disposition")),
  };
}
