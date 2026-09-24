import { z } from "zod";

/**
 * Standard gateway response wrapper (Swagger: *ApiResponse). Every endpoint,
 * success or failure, returns this shape; `data` is endpoint-specific.
 */
export const envelopeSchema = z
  .object({
    statusCode: z.union([z.number(), z.string()]).nullish(),
    message: z.string().nullish(),
    data: z.unknown().optional(),
    transactionReference: z.string().nullish(),
    timestamp: z.string().nullish(),
    errors: z.array(z.unknown()).nullish(),
    validationErrors: z.unknown().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .loose();

export type Envelope = z.infer<typeof envelopeSchema>;

/** StatusCode enum from the spec; 0 is success, 1 was observed on "Access denied". */
export const STATUS_CODE_SUCCESS = 0;

export function isEnvelope(body: unknown): body is Envelope {
  return (
    !!body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    ("statusCode" in body || "data" in body) &&
    envelopeSchema.safeParse(body).success
  );
}

/** Flattens ASP.NET style validation errors ({ field: [msg] }) into field → message. */
export function flattenValidationErrors(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [field, detail] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(detail)) out[field] = detail.map(String).join(" ");
    else if (detail != null) out[field] = String(detail);
  }
  return out;
}
