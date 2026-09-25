/**
 * What a tenant's own systems may call with a bearer token minted from their API
 * key, transcribed from docs/api/swagger-v1.json. Kept static: the Developers
 * page must not depend on parsing the spec at runtime.
 */
export interface IntegrationEndpoint {
  method: "GET" | "POST";
  path: string;
  purpose: string;
}

export const API_PREFIX = "/api/v1";

export const INTEGRATION_ENDPOINTS: IntegrationEndpoint[] = [
  { method: "POST", path: "/auth/token", purpose: "Exchange your API key (X-API-Key header) for a bearer token" },
  { method: "POST", path: "/payments/collection", purpose: "Collect from a mobile wallet" },
  { method: "POST", path: "/payments/disbursement", purpose: "Send a disbursement to a bank account or wallet" },
  { method: "POST", path: "/payments/bulk-disbursements", purpose: "Send up to 1,000 disbursements in one batch (ClientBatchId header)" },
  { method: "GET", path: "/payments/bulk-disbursements/{batchId}", purpose: "Read a batch and its items" },
  { method: "POST", path: "/payments/verify-name", purpose: "Check the name on an account before paying it" },
  { method: "POST", path: "/payments/bulk-name-verify", purpose: "Check many account names at once" },
  { method: "POST", path: "/payments/status-check", purpose: "Where a payment stands, by your clientTransactionId" },
  { method: "GET", path: "/payments/collection-balance", purpose: "Collection wallet balance (?currency=GHS)" },
  { method: "GET", path: "/payments/disbursement-balance", purpose: "Disbursement wallet balance (?currency=GHS)" },
  { method: "GET", path: "/payments/get-all-banks", purpose: "Institution codes for banks" },
  { method: "GET", path: "/payments/get-all-telcos", purpose: "Institution codes for mobile networks" },
  { method: "GET", path: "/transactions", purpose: "Your transactions (?page=&size=)" },
  { method: "POST", path: "/payments/{transactionId}/refunds", purpose: "Request a refund of a collection" },
];

/** Shell samples; placeholders in angle brackets, secrets read from the environment. */
export function integrationSamples(baseUrl: string): { title: string; code: string }[] {
  const api = `${baseUrl}${API_PREFIX}`;
  return [
    {
      title: "1. Get a token",
      code: `curl -sX POST ${api}/auth/token \\
  -H "X-API-Key: $AFRIKOB_API_KEY"`,
    },
    {
      title: "2. Send a disbursement",
      code: `curl -sX POST ${api}/payments/disbursement \\
  -H "Authorization: Bearer $AFRIKOB_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientTransactionId": "DSB-0001",
    "accountNumber": "<account or wallet number>",
    "accountName": "<name on the account>",
    "institutionCode": "<from get-all-banks or get-all-telcos>",
    "amount": 10.00,
    "currency": "GHS",
    "reference": "Invoice 0001"
  }'`,
    },
    {
      title: "3. Check where it stands",
      code: `curl -sX POST ${api}/payments/status-check \\
  -H "Authorization: Bearer $AFRIKOB_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "clientTransactionId": "DSB-0001" }'`,
    },
  ];
}
