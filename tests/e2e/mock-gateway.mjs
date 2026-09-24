// Stateful stand-in for the Afrikob gateway used by Playwright runs.
// Mirrors Swagger v1: session-cookie portal auth for staff, API-key + JWT for tenants.
import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_GATEWAY_PORT ?? 4010);
const API_KEYS = { "e2e-tenant-key-0001": "ten-1" };
const SESSION_COOKIE = "afk.portal";
/** Fixed one-time code, so tests can sign in without reading email. */
const LOGIN_CODE = "654321";

const publicUser = ({ password: _password, ...user }) => user;

function createUser(body, tenantId) {
  if (state.users.some((u) => u.email === body.email)) return [409, problem("Conflict", "That email already has an account.")];
  const user = {
    id: `usr-${state.users.length + 1}`,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    preferredNotificationChannel: "Email",
    isTenantAdmin: false,
    isPlatformAdmin: false,
    ...body,
    tenantId,
  };
  state.users.push(user);
  return [200, ok(publicUser(user))];
}

/** Approving runs the held action; this mock only has wallet top-ups. */
function decide(id, body) {
  const request = state.approvals.find((a) => a.id === id);
  if (!request) return [404, problem("Not Found", "No such request.")];
  if (request.status !== "Pending") return [400, problem("Bad Request", "That request was already decided.")];
  request.status = body.approve ? "Approved" : "Rejected";
  request.decidedAt = new Date().toISOString();
  request.decidedSummary = body.comment || (body.approve ? "Approved" : "Rejected");
  if (body.approve && request.actionKey === "WALLET_TOPUP") {
    const payload = JSON.parse(request.rawPayloadJson);
    const wallet = state.tenantDetail.wallets.find((w) => w.walletType === payload.walletType) ?? state.tenantDetail.wallets[0];
    wallet.availableBalance += Number(payload.amount);
    wallet.totalBalance += Number(payload.amount);
  }
  return [200, ok(request)];
}

function maskEmail(email) {
  const [name, domain] = String(email).split("@");
  return `${(name ?? "").slice(0, 1)}***@${domain ?? ""}`;
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const tenantJwt = (tenantId) =>
  `${b64({ alg: "none", typ: "JWT" })}.${b64({ role: "merchant", tenantId, name: "Afikob Limited Company", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

const initialState = () => ({
  users: [
    {
      id: "usr-1",
      email: "ops@afrikob.com",
      password: "correct-horse",
      displayName: "Doris Bosompem",
      userType: "Admin",
      tenantId: null,
      canMake: true,
      canCheck: true,
      isTenantAdmin: false,
      isPlatformAdmin: true,
      phoneNumber: null,
      preferredNotificationChannel: "Email",
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-01-02T08:00:00Z",
    },
    {
      id: "usr-2",
      email: "owner@afikob.com",
      password: "tenant-horse",
      displayName: "Kwame Owner",
      userType: "TenantAdmin",
      tenantId: "ten-1",
      canMake: true,
      canCheck: true,
      isTenantAdmin: true,
      isPlatformAdmin: false,
      phoneNumber: "0241234567",
      preferredNotificationChannel: "Email",
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-02-02T08:00:00Z",
    },
  ],
  approvals: [
    {
      id: "apr-1",
      actionKey: "WALLET_TOPUP",
      tenantId: "ten-1",
      resourceType: "Wallet",
      resourceId: "ten-1",
      rawPayloadJson: JSON.stringify({ currency: "GHS", amount: 2500, reference: "DEP-771", walletType: "DISBURSEMENT" }),
      status: "Pending",
      requiredApprovals: 1,
      requestedBy: "owner@afikob.com",
      decidedSummary: null,
      decidedAt: null,
      createdAt: "2026-09-23T10:00:00Z",
    },
  ],
  sessions: new Map(),
  resetCodes: new Map(),
  loginCodes: new Map(),
  tenants: [{ id: "ten-1", code: "AFIKOB", displayName: "Afikob", status: "Active", createdAt: "2026-01-04T10:00:00Z" }],
  wallets: { "ten-1": { availableBalance: 9958.6, reservedBalance: 41.4, totalBalance: 10000, currency: "GHS" } },
  tenantDetail: {
    id: "ten-1",
    code: "AFIKOB",
    legalName: "Afikob Limited Company",
    displayName: "Afikob",
    status: "Active",
    currency: "GHS",
    dailyLimit: 50000,
    perTransactionLimit: 5000,
    requestsPerMinute: 60,
    requireNameVerification: true,
    wallets: [
      { walletType: "DISBURSEMENT", currency: "GHS", availableBalance: 9958.6, reservedBalance: 41.4, totalBalance: 10000 },
      { walletType: "COLLECTION", currency: "GHS", availableBalance: 1200, reservedBalance: 0, totalBalance: 1200 },
    ],
  },
  refunds: [
    {
      id: "ref-1",
      tenantId: "ten-1",
      transactionId: "TX-1",
      amount: 10,
      currency: "GHS",
      reason: "Duplicate charge",
      status: "Pending",
      requestedBy: "ops@afikob.com",
      createdAt: "2026-09-17T09:00:00Z",
    },
  ],
  transactions: [
    {
      id: "TX-1",
      clientTransactionId: "COL-1",
      providerTransactionId: "P-1",
      type: "Collection",
      status: "Successful",
      amount: 10,
      currency: "GHS",
      fee: 0.2,
      netAmount: 9.8,
      platformFee: 0.1,
      accountName: "Ama Mensah",
      accountNumberMasked: "024****567",
      institutionCode: "MTN",
      reference: "test 1",
      providerMessage: "Approved",
      completedAt: "2026-09-16T15:58:00Z",
      refundedAmount: 0,
      createdAt: "2026-09-16T15:39:00Z",
      updatedAt: "2026-09-16T15:58:00Z",
    },
    {
      id: "TX-2",
      clientTransactionId: "COL-2",
      providerTransactionId: "P-2",
      type: "Collection",
      status: "Failed",
      amount: 4,
      currency: "GHS",
      fee: 0,
      netAmount: 4,
      platformFee: 0,
      accountName: "Kojo Antwi",
      accountNumberMasked: "055****111",
      institutionCode: "VOD",
      reference: "QW12",
      providerMessage: "Insufficient funds",
      completedAt: null,
      refundedAmount: 0,
      createdAt: "2026-09-15T19:24:00Z",
      updatedAt: "2026-09-15T19:25:00Z",
    },
  ],
});

let state = initialState();

const ok = (data) => ({
  statusCode: 0,
  message: "Success",
  data,
  transactionReference: null,
  timestamp: new Date().toISOString(),
  errors: [],
  validationErrors: null,
  metadata: {},
});
const fail = (message) => ({ ...ok(null), statusCode: 1, message });
const problem = (title, detail) => ({ type: "about:blank", title, status: 400, detail, instance: null });

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/** Who is calling: a portal session cookie, or a tenant bearer token. */
function identify(req) {
  const cookie = req.headers.cookie ?? "";
  const match = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(cookie);
  if (match) {
    const user = state.sessions.get(match[1]);
    if (user) {
      return {
        kind: "portal",
        user,
        role: user.isPlatformAdmin ? "admin" : "tenant",
        isTenantAdmin: Boolean(user.isTenantAdmin),
      };
    }
  }
  const auth = req.headers.authorization ?? "";
  if (auth.startsWith("Bearer ")) {
    try {
      const claims = JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64url").toString());
      return { kind: "apikey", tenantId: claims.tenantId, role: "tenant", isTenantAdmin: false };
    } catch {
      return null;
    }
  }
  return null;
}

const csvFor = (kind) =>
  `date,type,amount,currency,status\n2026-09-16,${kind},10.00,GHS,Successful\n2026-09-15,${kind},4.00,GHS,Failed\n`;

const routes = [
  // Portal auth: the password earns an emailed code, not a session.
  ["POST", /^portal\/auth\/login$/, (_r, _m, body) => {
    const user = state.users.find((u) => u.email === body.email && u.password === body.password && u.isActive);
    if (!user) return [401, problem("Unauthorized", "Incorrect email or password.")];
    state.loginCodes.set(user.email, LOGIN_CODE);
    return [200, ok({ requiresVerification: true, maskedEmail: maskEmail(user.email) })];
  }],
  ["POST", /^portal\/auth\/verify-login-code$/, (_r, _m, body) => {
    if (!body.code || state.loginCodes.get(body.email) !== body.code) {
      return [401, problem("Unauthorized", "That code is not valid.")];
    }
    const user = state.users.find((u) => u.email === body.email && u.isActive);
    if (!user) return [401, problem("Unauthorized", "That code is not valid.")];
    state.loginCodes.delete(user.email);
    const sid = randomUUID();
    state.sessions.set(sid, user);
    user.lastLoginAt = new Date().toISOString();
    return [
      200,
      ok({
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        userType: user.userType,
        tenantId: user.tenantId,
        canMake: user.canMake,
        canCheck: user.canCheck,
      }),
      { "set-cookie": `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax` },
    ];
  }],
  ["POST", /^portal\/auth\/logout$/, (req) => {
    const cookie = req.headers.cookie ?? "";
    const match = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(cookie);
    if (match) state.sessions.delete(match[1]);
    return [200, ok({ loggedOut: true })];
  }],
  ["POST", /^portal\/auth\/forgot-password$/, (_r, _m, body) => {
    const user = state.users.find((u) => u.email === body.email);
    if (user) state.resetCodes.set(body.email, "123456");
    return [200, ok({ maskedEmail: maskEmail(body.email ?? "") })];
  }],
  ["POST", /^portal\/auth\/verify-code$/, (_r, _m, body) => [200, ok({ valid: state.resetCodes.get(body.email) === body.code })]],
  ["POST", /^portal\/auth\/reset-password$/, (_r, _m, body) => {
    if (state.resetCodes.get(body.email) !== body.code) return [400, problem("Bad Request", "That code has expired.")];
    const user = state.users.find((u) => u.email === body.email);
    if (!user) return [400, problem("Bad Request", "Unknown account.")];
    user.password = body.newPassword;
    state.resetCodes.delete(body.email);
    return [200, ok({ userId: user.id, email: user.email, displayName: user.displayName, userType: user.userType, tenantId: null, canMake: true, canCheck: true })];
  }],
  // Tenant API key
  ["POST", /^auth\/token$/, (req) => {
    const tenantId = API_KEYS[req.headers["x-api-key"]];
    return tenantId ? [200, ok({ accessToken: tenantJwt(tenantId), expiresIn: 3600 })] : [403, fail("Access denied")];
  }],
  // Admin
  ["GET", /^admin\/tenants$/, () => [200, ok(state.tenants)]],
  ["POST", /^admin\/tenants$/, (_r, _m, body) => {
    const tenant = { id: `ten-${state.tenants.length + 1}`, code: body.code, displayName: body.displayName, status: "Active", createdAt: new Date().toISOString() };
    state.tenants.push(tenant);
    state.wallets[tenant.id] = { availableBalance: 0, reservedBalance: 0, totalBalance: 0, currency: "GHS" };
    return [200, ok({ tenantId: tenant.id, apiKey: `afk_live_${tenant.id}_SECRET` })];
  }],
  ["POST", /^admin\/tenants\/([^/]+)\/credentials$/, (_r, m, _body) => [200, ok({ credentialId: "cred-1", keyPrefix: "afk_live", apiKey: `afk_live_${m[1]}_SECRET` })]],
  ["GET", /^admin\/tenants\/[^/]+\/fees$/, () => [200, ok([])]],
  ["GET", /^admin\/wallets\/([^/]+)$/, (_r, m) => [200, ok(state.wallets[m[1]] ?? { availableBalance: 0, reservedBalance: 0, totalBalance: 0, currency: "GHS" })]],
  ["POST", /^admin\/wallets\/([^/]+)\/topup$/, (req, m, body) => {
    if (!req.headers["x-admin-user"]) return [400, problem("Bad Request", "X-Admin-User is required")];
    const wallet = state.wallets[m[1]] ?? { availableBalance: 0, reservedBalance: 0, totalBalance: 0, currency: "GHS" };
    wallet.availableBalance += Number(body.amount);
    wallet.totalBalance += Number(body.amount);
    state.wallets[m[1]] = wallet;
    return [200, ok(wallet)];
  }],
  ["GET", /^admin\/users$/, () => [200, ok(state.users.map(publicUser))]],
  ["GET", /^admin\/users\/([^/]+)$/, (_r, m) => {
    const user = state.users.find((u) => u.id === m[1]);
    return user ? [200, ok(publicUser(user))] : [404, problem("Not Found", "No such user.")];
  }],
  ["PATCH", /^admin\/users\/([^/]+)$/, (_r, m, body) => {
    const user = state.users.find((u) => u.id === m[1]);
    if (!user) return [404, problem("Not Found", "No such user.")];
    Object.assign(user, body);
    return [200, ok(publicUser(user))];
  }],
  ["POST", /^admin\/users\/([^/]+)\/activate$/, (_r, m) => {
    const user = state.users.find((u) => u.id === m[1]);
    if (!user) return [404, problem("Not Found", "No such user.")];
    user.isActive = true;
    return [200, ok(publicUser(user))];
  }],
  ["POST", /^admin\/users\/([^/]+)\/set-password$/, (_r, m, body) => {
    const user = state.users.find((u) => u.id === m[1]);
    if (!user) return [404, problem("Not Found", "No such user.")];
    user.password = body.newPassword;
    return [200, ok({ success: true })];
  }],
  // Platform approvals inbox
  ["GET", /^admin\/approvals$/, (_r, _m, _b, url) => {
    const status = url.searchParams.get("status");
    return [200, ok(state.approvals.filter((a) => !status || a.status === status))];
  }],
  ["GET", /^admin\/approvals\/([^/]+)$/, (_r, m) => {
    const found = state.approvals.find((a) => a.id === m[1]);
    return found ? [200, ok(found)] : [404, problem("Not Found", "No such request.")];
  }],
  ["POST", /^admin\/approvals\/([^/]+)\/decide$/, (_r, m, body) => decide(m[1], body)],
  ["POST", /^admin\/users$/, (_r, _m, body) => createUser(body, body.tenantId ?? null)],
  ["POST", /^admin\/users\/([^/]+)\/deactivate$/, (_r, m) => {
    const user = state.users.find((u) => u.id === m[1]);
    if (!user) return [404, problem("Not Found", "No such user.")];
    user.isActive = false;
    return [200, ok({ deactivated: true })];
  }],
  ["GET", /^admin\/refunds$/, (_r, _m, _b, url) => {
    const status = url.searchParams.get("status");
    return [200, ok(state.refunds.filter((r) => !status || r.status === status))];
  }],
  ["POST", /^admin\/refunds\/([^/]+)\/approve$/, (_r, m) => {
    const refund = state.refunds.find((r) => r.id === m[1]);
    if (!refund) return [404, problem("Not Found", "No such refund.")];
    refund.status = "Approved";
    refund.approvedBy = "Doris Bosompem";
    return [200, ok(refund)];
  }],
  ["GET", /^admin\/approval-policies$/, () => [200, ok([])]],
  // A tenant's own administration
  ["GET", /^tenant-admin\/tenant$/, () => [200, ok(state.tenantDetail)]],
  ["GET", /^tenant-admin\/users$/, () => [200, ok(state.users.filter((u) => u.tenantId === "ten-1").map(publicUser))]],
  ["POST", /^tenant-admin\/users$/, (_r, _m, body) => createUser({ ...body, userType: "TenantUser" }, "ten-1")],
  ["GET", /^tenant-admin\/users\/([^/]+)$/, (_r, m) => {
    const user = state.users.find((u) => u.id === m[1] && u.tenantId === "ten-1");
    return user ? [200, ok(publicUser(user))] : [404, problem("Not Found", "No such user.")];
  }],
  ["PATCH", /^tenant-admin\/users\/([^/]+)$/, (_r, m, body) => {
    const user = state.users.find((u) => u.id === m[1] && u.tenantId === "ten-1");
    if (!user) return [404, problem("Not Found", "No such user.")];
    Object.assign(user, body);
    return [200, ok(publicUser(user))];
  }],
  ["POST", /^tenant-admin\/users\/([^/]+)\/activate$/, (_r, m) => {
    const user = state.users.find((u) => u.id === m[1] && u.tenantId === "ten-1");
    if (!user) return [404, problem("Not Found", "No such user.")];
    user.isActive = true;
    return [200, ok(publicUser(user))];
  }],
  ["POST", /^tenant-admin\/users\/([^/]+)\/deactivate$/, (_r, m) => {
    const user = state.users.find((u) => u.id === m[1] && u.tenantId === "ten-1");
    if (!user) return [404, problem("Not Found", "No such user.")];
    user.isActive = false;
    return [200, ok({ deactivated: true })];
  }],
  ["POST", /^tenant-admin\/users\/([^/]+)\/set-password$/, (_r, m, body) => {
    const user = state.users.find((u) => u.id === m[1] && u.tenantId === "ten-1");
    if (!user) return [404, problem("Not Found", "No such user.")];
    user.password = body.newPassword;
    return [200, ok({ success: true })];
  }],
  ["POST", /^tenant-admin\/wallets\/topup-request$/, (_r, _m, body) => {
    const request = {
      id: `apr-${state.approvals.length + 1}`,
      actionKey: "WALLET_TOPUP",
      tenantId: "ten-1",
      resourceType: "Wallet",
      resourceId: "ten-1",
      rawPayloadJson: JSON.stringify(body),
      status: "Pending",
      requiredApprovals: 1,
      requestedBy: "owner@afikob.com",
      decidedSummary: null,
      decidedAt: null,
      createdAt: new Date().toISOString(),
    };
    state.approvals.push(request);
    return [202, ok({ pendingApproval: true, approvalRequestId: request.id })];
  }],
  ["GET", /^tenant-admin\/approvals$/, (_r, _m, _b, url) => {
    const status = url.searchParams.get("status");
    return [200, ok(state.approvals.filter((a) => a.tenantId === "ten-1" && (!status || a.status === status)))];
  }],
  ["GET", /^tenant-admin\/approvals\/([^/]+)$/, (_r, m) => {
    const found = state.approvals.find((a) => a.id === m[1]);
    return found ? [200, ok(found)] : [404, problem("Not Found", "No such request.")];
  }],
  ["POST", /^tenant-admin\/approvals\/([^/]+)\/decide$/, (_r, m, body) => decide(m[1], body)],
  ["GET", /^admin\/reports\/collections\/list$/, () => [200, ok(state.transactions.map(toReportRow))],],
  ["GET", /^admin\/reports\/disbursements\/list$/, () => [200, ok([])]],
  // Transactions & payments
  ["GET", /^transactions$/, () => [200, ok(state.transactions)]],
  ["GET", /^transactions\/([^/]+)$/, (_r, m) => [200, ok(state.transactions.find((t) => t.id === m[1]) ?? null)]],
  ["GET", /^payments\/[^/]+\/refunds$/, () => [200, ok([])]],
  ["GET", /^payments\/get-all-telcos$/, () => [200, ok([{ code: "MTN", name: "MTN Mobile Money", type: "Telco" }, { code: "VOD", name: "Telecel Cash", type: "Telco" }])]],
  ["GET", /^payments\/get-all-banks$/, () => [200, ok([{ code: "GCB", name: "GCB Bank", type: "Bank" }])]],
  ["GET", /^payments\/disbursement-balance$/, () => [200, ok(state.wallets["ten-1"])]],
  ["GET", /^payments\/collection-balance$/, () => [200, ok(state.wallets["ten-1"])]],
  ["POST", /^payments\/verify-name$/, () => [200, ok({ accountName: "KOFI BOATENG", accountNumber: "851274680", status: "Verified", message: null })]],
  ["POST", /^payments\/disbursement$/, (_r, _m, body) => {
    const id = `TX-${state.transactions.length + 1}`;
    state.transactions.unshift({
      id,
      clientTransactionId: body.clientTransactionId,
      providerTransactionId: null,
      type: "Disbursement",
      status: "Pending",
      amount: Number(body.amount),
      currency: body.currency ?? "GHS",
      fee: 0,
      netAmount: Number(body.amount),
      platformFee: 0,
      accountName: body.accountName,
      accountNumberMasked: `${String(body.accountNumber).slice(0, 3)}****`,
      institutionCode: body.institutionCode,
      reference: body.reference,
      providerMessage: "Accepted",
      completedAt: null,
      refundedAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    state.wallets["ten-1"].availableBalance -= Number(body.amount);
    return [202, ok({ transactionId: id, status: "Pending", code: "000", message: "Accepted", providerTransactionId: null })];
  }],
  ["GET", /^payments\/bulk-disbursements$/, () => [200, ok([])]],
];

function toReportRow(t) {
  return {
    dateCreated: t.createdAt,
    dateUpdated: t.updatedAt,
    branch: "Afikob Limited Company",
    branchType: "Main",
    customerEmail: null,
    transactionId: t.id,
    institutionCode: t.institutionCode,
    reference: t.reference,
    channel: "API",
    transactionAction: t.type,
    currency: t.currency,
    transactionStatus: t.status,
    amount: t.amount,
    fee: t.fee,
    merchantFeeValue: t.fee,
    customerFeeValue: 0,
    transactedAmount: t.amount,
    netToMerchant: t.netAmount,
    transactionAccountNumber: t.accountNumberMasked,
    transactionAccountName: t.accountName,
    domain: "test",
    failureReason: t.status === "Failed" ? t.providerMessage : null,
    paymentSlug: null,
  };
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === "/health") return void res.end("Healthy");
    if (url.pathname === "/__reset" && req.method === "POST") {
      state = initialState();
      return void res.end("reset");
    }
    const path = url.pathname.replace(/^\/api\/v1\//, "");

    // Report downloads stream a file rather than JSON.
    const download = /^admin\/reports\/(collections|disbursements)$/.exec(path);
    if (download && req.method === "GET") {
      const who = identify(req);
      if (who?.role !== "admin") return send(res, 403, fail("Access denied"));
      res.writeHead(200, {
        "content-type": "text/csv",
        "content-disposition": `attachment; filename="${download[1]}-report.csv"`,
      });
      return void res.end(csvFor(download[1]));
    }

    const route = routes.find(([method, re]) => method === req.method && re.test(path));
    if (!route) return send(res, 404, problem("Not Found", "No such endpoint."));
    if (!path.startsWith("portal/auth/") && path !== "auth/token") {
      const who = identify(req);
      if (!who) return send(res, 403, fail("Access denied"));
      if (path.startsWith("admin/") && who.role !== "admin") return send(res, 403, fail("Access denied"));
      if (path.startsWith("tenant-admin/") && !who.isTenantAdmin) return send(res, 403, fail("Access denied"));
    }
    const body = await readBody(req).catch(() => ({}));
    const [status, payload, headers] = route[2](req, path.match(route[1]), body, url);
    send(res, status, payload, headers);
  })
  .listen(PORT, () => console.log(`mock gateway on :${PORT}`));
