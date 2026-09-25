// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  accountHolder,
  amount,
  anyAccount,
  bankAccount,
  clientReference,
  code,
  currency,
  emailAddress,
  ghanaMobile,
  isoDate,
  narration,
  newPassword,
  optionalLimit,
  personName,
  phoneNumber,
  text,
} from "@/lib/validation/fields";
import { createTenantSchema, personFormSchema, reportFilterSchema, completeRefundSchema } from "@/lib/api/schemas/requests";

const ok = <T,>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, v: unknown) => {
  const r = schema.safeParse(v);
  expect(r.success, `expected ${JSON.stringify(v)} to pass`).toBe(true);
  return r.data as T;
};
const bad = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(schema.safeParse(v).success, `expected ${JSON.stringify(v)} to fail`).toBe(false);

describe("money", () => {
  it.each([
    ["10", 10],
    ["10.5", 10.5],
    ["10.50", 10.5],
    ["1,250.75", 1250.75],
    [" 99.99 ", 99.99],
    [25, 25],
  ])("accepts %j as %d", (input, expected) => expect(ok(amount(), input)).toBe(expected));

  it.each(["", "0", "0.00", "-5", "10.555", "1e3", "abc", "10.", ".5", "Infinity", "NaN", null, undefined, "1000000001"])(
    "rejects %j",
    (input) => bad(amount(), input),
  );

  it("treats a blank limit as no limit, and keeps zero", () => {
    expect(ok(optionalLimit("Limit"), "")).toBeUndefined();
    expect(ok(optionalLimit("Limit"), "0")).toBe(0);
    bad(optionalLimit("Limit"), "-1");
  });

  it("only takes the currencies the gateway settles", () => {
    expect(ok(currency, "ghs")).toBe("GHS");
    bad(currency, "USD");
    bad(currency, "CEDI");
  });
});

describe("phone numbers", () => {
  it("normalises a Ghanaian mobile wallet to national form", () => {
    for (const input of ["0241234567", "024 123 4567", "+233241234567", "+233 24 123 4567", "233241234567", "(024) 123-4567"]) {
      expect(ok(ghanaMobile, input)).toBe("0241234567");
    }
  });

  it.each(["", "12345", "0241234", "02412345678", "+2348031234567", "0301234567", "abcdefghij"])("rejects %j as a wallet", (input) =>
    bad(ghanaMobile, input),
  );

  it("stores a contact number in E.164 from any country, and allows none", () => {
    expect(ok(phoneNumber, "024 123 4567")).toBe("+233241234567");
    expect(ok(phoneNumber, "+44 7911 123456")).toBe("+447911123456");
    expect(ok(phoneNumber, "")).toBeUndefined();
    bad(phoneNumber, "+233 12");
    bad(phoneNumber, "not a number");
  });
});

describe("accounts and references", () => {
  it("takes bank accounts as digits only", () => {
    expect(ok(bankAccount, "1234 5678-90")).toBe("1234567890");
    bad(bankAccount, "12345");
    bad(bankAccount, "ABC1234567");
    expect(ok(anyAccount, "+233241234567")).toBe("+233241234567");
  });

  it("keeps client references to safe characters", () => {
    expect(ok(clientReference, "PAY-LX2K_01")).toBe("PAY-LX2K_01");
    for (const input of ["ab", "has space", "semi;colon", "a".repeat(65), "<script>"]) bad(clientReference, input);
  });

  it("allows statement-friendly narrations only", () => {
    expect(ok(narration(), "Invoice #104: Sept (final) & fees")).toBe("Invoice #104: Sept (final) & fees");
    for (const input of ["", "   ", "<b>hi</b>", "a\u0000b", "x".repeat(101), "=HYPERLINK(1)"]) bad(narration(), input);
  });

  it("uppercases codes and refuses anything but letters, digits, - and _", () => {
    expect(ok(code("Code"), " afk-1 ")).toBe("AFK-1");
    bad(code("Code"), "bad code!");
  });

  it("checks names", () => {
    expect(ok(personName(), "Ama Serwaa-Mensah")).toBe("Ama Serwaa-Mensah");
    expect(ok(personName(), "Kwabena O'Neil Jr.")).toBe("Kwabena O'Neil Jr.");
    for (const input of ["A", "Ama2", "<script>", "  "]) bad(personName(), input);
    expect(ok(accountHolder(), "Afikob & Sons Ltd. (Accra)")).toBe("Afikob & Sons Ltd. (Accra)");
  });

  it("refuses control and bidi-override characters in free text", () => {
    bad(text("Note", 500), "hello‮world");
    bad(text("Note", 500), "bell\u0007");
    expect(ok(text("Note", 500, { required: false }), "  ")).toBeUndefined();
  });
});

describe("identity", () => {
  it("normalises email addresses", () => {
    expect(ok(emailAddress, "  Ama.Mensah@Shop.GH ")).toBe("ama.mensah@shop.gh");
    for (const input of ["", "ama", "ama@", "@shop.gh", "ama@shop", "a b@shop.gh"]) bad(emailAddress, input);
  });

  it("asks for a password with a letter and a number", () => {
    ok(newPassword, "abcdefg1");
    for (const input of ["short1", "allletters", "12345678", " padded1x", "x".repeat(129) + "1"]) bad(newPassword, input);
  });

  it("validates calendar dates", () => {
    ok(isoDate, "2026-02-28");
    for (const input of ["2026-02-30", "2026-13-01", "28/02/2026", ""]) bad(isoDate, input);
  });
});

describe("rules across fields", () => {
  it("keeps a per-payment limit within the daily limit", () => {
    bad(createTenantSchema, { code: "AFK", legalName: "Afikob Ltd", displayName: "Afikob", dailyLimit: "100", perTransactionLimit: "200" });
    ok(createTenantSchema, { code: "AFK", legalName: "Afikob Ltd", displayName: "Afikob", dailyLimit: "100", perTransactionLimit: "100" });
  });

  it("requires a tenant for tenant users, none for staff, and a phone for SMS", () => {
    const base = { email: "ama@shop.gh", displayName: "Ama Mensah", password: "first-password1" };
    bad(personFormSchema, { ...base, userType: "Tenant" });
    ok(personFormSchema, { ...base, userType: "Tenant", tenantId: "ten-1" });
    bad(personFormSchema, { ...base, userType: "Platform", tenantId: "ten-1" });
    bad(personFormSchema, { ...base, userType: "Platform", preferredNotificationChannel: "SMS" });
    ok(personFormSchema, { ...base, userType: "Platform", preferredNotificationChannel: "SMS", phoneNumber: "0241234567" });
  });

  it("refuses a report range that ends before it starts", () => {
    bad(reportFilterSchema, { fromDate: "2026-09-30", toDate: "2026-09-01" });
    ok(reportFilterSchema, { fromDate: "2026-09-01", toDate: "2026-09-30", status: "Successful" });
  });

  it("needs the provider's reference for a refund marked as paid", () => {
    bad(completeRefundSchema, { success: true, providerReference: "" });
    ok(completeRefundSchema, { success: true, providerReference: "MTN-889201" });
    ok(completeRefundSchema, { success: false });
  });
});
