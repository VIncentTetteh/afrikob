import { http, HttpResponse } from "msw";
import * as f from "./fixtures";

const base = "*/api/afrikob";

/** Default happy-path handlers for the BFF proxy surface. */
export const handlers = [
  http.get(`${base}/tenant/transactions`, () => HttpResponse.json(f.envelope(f.transactions))),
  http.get(`${base}/tenant/transactions/:id`, ({ params }) =>
    HttpResponse.json(f.envelope(f.transactions.find((t) => t.id === params.id) ?? f.transactions[0])),
  ),
  http.get(`${base}/payments/:txId/refunds`, () => HttpResponse.json(f.envelope([]))),
  http.get(`${base}/tenant/payments/get-all-banks`, () => HttpResponse.json(f.envelope(f.banks))),
  http.get(`${base}/tenant/payments/get-all-telcos`, () => HttpResponse.json(f.envelope(f.telcos))),
  http.get(`${base}/tenant/payments/disbursement-balance`, () => HttpResponse.json(f.envelope(f.wallet))),
  http.get(`${base}/tenant/payments/collection-balance`, () => HttpResponse.json(f.envelope(f.wallet))),
  http.get(`${base}/tenant/payments/bulk-disbursements`, () => HttpResponse.json(f.envelope([f.batch]))),
  http.post(`${base}/tenant/payments/verify-name`, () =>
    HttpResponse.json(f.envelope({ accountName: "KOFI BOATENG", accountNumber: "851274680", status: "Verified", message: null })),
  ),
  http.post(`${base}/tenant/payments/disbursement`, () =>
    HttpResponse.json(
      f.envelope({ transactionId: "tx-new", status: "Pending", code: "000", message: "Accepted", providerTransactionId: null }),
      {},
    ),
  ),
  http.get(`${base}/admin/tenants`, () => HttpResponse.json(f.envelope(f.tenants))),
  http.get(`${base}/admin/refunds`, () => HttpResponse.json(f.envelope(f.refunds))),
  http.get(`${base}/admin/users`, () => HttpResponse.json(f.envelope(f.users))),
  http.get(`${base}/admin/approval-policies`, () => HttpResponse.json(f.envelope([]))),
  http.get(`${base}/admin/approvals`, () => HttpResponse.json(f.envelope(f.approvals))),
  http.get(`${base}/admin/approvals/:id`, ({ params }) =>
    HttpResponse.json(f.envelope(f.approvals.find((r) => r.id === params.id) ?? f.approvals[0])),
  ),
  http.get(`${base}/tenant-admin/approvals/:id`, ({ params }) =>
    HttpResponse.json(f.envelope(f.approvals.find((r) => r.id === params.id) ?? f.approvals[0])),
  ),
  http.get(`${base}/admin/users/:id`, ({ params }) =>
    HttpResponse.json(f.envelope(f.users.find((u) => u.id === params.id) ?? f.users[0])),
  ),
  http.get(`${base}/tenant-admin/users/:id`, ({ params }) =>
    HttpResponse.json(f.envelope(f.users.find((u) => u.id === params.id) ?? f.users[0])),
  ),
  http.post(`${base}/admin/approvals/:id/decide`, () => HttpResponse.json(f.envelope({ ...f.approvals[0], status: "Approved" }))),
  http.get(`${base}/tenant-admin/approvals`, () => HttpResponse.json(f.envelope(f.approvals))),
  http.get(`${base}/tenant-admin/tenant`, () => HttpResponse.json(f.envelope(f.tenantDetail))),
  http.get(`${base}/tenant-admin/users`, () => HttpResponse.json(f.envelope(f.users))),
  http.get(`${base}/admin/reports/collections/list`, () => HttpResponse.json(f.envelope(f.collectionReportRows))),
  http.get(`${base}/admin/reports/disbursements/list`, () => HttpResponse.json(f.envelope([]))),
];
