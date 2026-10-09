export interface MediaUsage {
  sceneIds: string[];
  cuePointIds: string[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: unknown[];
  usage?: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown[] = [],
    readonly usage?: MediaUsage,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isApiErrorBody(value: unknown): value is { error: ApiErrorBody } {
  if (typeof value !== "object" || value === null || !("error" in value))
    return false;
  const error = value.error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string" &&
    "details" in error &&
    Array.isArray(error.details)
  );
}

function isMediaUsage(value: unknown): value is MediaUsage {
  if (typeof value !== "object" || value === null) return false;
  return (
    "sceneIds" in value &&
    Array.isArray(value.sceneIds) &&
    value.sceneIds.every((id) => typeof id === "string") &&
    "cuePointIds" in value &&
    Array.isArray(value.cuePointIds) &&
    value.cuePointIds.every((id) => typeof id === "string")
  );
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  json?: unknown;
  formData?: FormData;
}

export function createApiClient(baseUrl = "") {
  async function request<T>(
    path: string,
    { json, formData, headers, ...options }: ApiRequestOptions = {},
  ): Promise<T | undefined> {
    if (json !== undefined && formData !== undefined)
      throw new TypeError(
        "A request cannot contain both JSON and multipart data.",
      );

    const requestHeaders = new Headers(headers);
    if (json !== undefined)
      requestHeaders.set("Content-Type", "application/json");
    // The browser sets the multipart boundary when FormData is the body.
    if (formData !== undefined) requestHeaders.delete("Content-Type");

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: requestHeaders,
      body: formData ?? (json === undefined ? undefined : JSON.stringify(json)),
    });
    const text = await response.text();
    const data = text ? parseJson(text) : undefined;

    if (!response.ok) {
      if (isApiErrorBody(data)) {
        const { code, message, details, usage } = data.error;
        throw new ApiError(
          response.status,
          code,
          message,
          details,
          response.status === 409 && code === "CONFLICT" && isMediaUsage(usage)
            ? usage
            : undefined,
        );
      }
      throw new ApiError(
        response.status,
        "HTTP_ERROR",
        `Request failed with status ${response.status}.`,
      );
    }
    if (!text) return undefined;
    if (data === undefined) {
      throw new ApiError(
        response.status,
        "INVALID_RESPONSE",
        "The server returned an invalid JSON response.",
      );
    }
    // The caller specifies the response contract; endpoint schemas can validate it at the call site.
    return data as T;
  }

  return { request };
}

export const apiClient = createApiClient();
