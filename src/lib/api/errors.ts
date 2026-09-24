/** Normalised error thrown by the API client for any non-success response. */
export class ApiError extends Error {
  readonly status: number;
  readonly statusCode: number | string | null;
  readonly errors: string[];
  readonly fieldErrors: Record<string, string>;
  readonly requestId: string | null;

  constructor(init: {
    message: string;
    status: number;
    statusCode?: number | string | null;
    errors?: string[];
    fieldErrors?: Record<string, string>;
    requestId?: string | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.statusCode = init.statusCode ?? null;
    this.errors = init.errors ?? [];
    this.fieldErrors = init.fieldErrors ?? {};
    this.requestId = init.requestId ?? null;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

/** Human readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const details = [...error.errors, ...Object.values(error.fieldErrors)].filter(Boolean);
    return details.length > 0 ? `${error.message} ${details.join(" ")}`.trim() : error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
