import { describe, expect, test } from "bun:test";
import {
  createAccountSchema,
  listAccountQuerySchema,
  updateAccountSchema,
} from "../src/schemas/account.schema";

const ID = "00000000-0000-4000-8000-0000000a0001";
const wrapBody = (body: unknown) => ({ body, params: {}, query: {} });
const wrapUpdate = (body: unknown) => ({ body, params: { id: ID }, query: {} });

describe("createAccountSchema", () => {
  const parse = (body: unknown) => createAccountSchema.safeParse(wrapBody(body));

  test("menerima input minimal", () => {
    expect(parse({ name: "Dompet", type: "CASH" }).success).toBe(true);
  });

  test("saldo awal 0 diterima, negatif ditolak", () => {
    expect(parse({ name: "Dompet", type: "CASH", openingBalance: "0" }).success).toBe(true);
    expect(parse({ name: "Dompet", type: "CASH", openingBalance: "-5000" }).success).toBe(
      false,
    );
  });

  test("menolak tipe yang tidak dikenal", () => {
    expect(parse({ name: "Dompet", type: "CRYPTO" }).success).toBe(false);
  });

  test("menolak nama terlalu pendek atau panjang", () => {
    expect(parse({ name: "A", type: "CASH" }).success).toBe(false);
    expect(parse({ name: "x".repeat(31), type: "CASH" }).success).toBe(false);
  });
});

describe("updateAccountSchema", () => {
  const parse = (body: unknown) => updateAccountSchema.safeParse(wrapUpdate(body));

  test("menolak body kosong", () => {
    expect(parse({}).success).toBe(false);
  });

  test("isDefault hanya bisa true (default dipindah, bukan dikosongkan)", () => {
    expect(parse({ isDefault: true }).success).toBe(true);
    expect(parse({ isDefault: false }).success).toBe(false);
  });

  test("menolak jadikan default sekaligus arsipkan", () => {
    expect(parse({ isDefault: true, isArchived: true }).success).toBe(false);
  });

  test("mengaktifkan akun arsip sekaligus menjadikannya default", () => {
    expect(parse({ isDefault: true, isArchived: false }).success).toBe(true);
  });

  test("menolak id bukan UUID", () => {
    const result = updateAccountSchema.safeParse({
      body: { name: "Dompet" },
      params: { id: "123" },
      query: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("listAccountQuerySchema", () => {
  const parse = (query: Record<string, string>) =>
    listAccountQuerySchema.safeParse({ body: undefined, params: {}, query });

  test("default tanpa akun arsip", () => {
    const result = parse({});
    expect(result.success && result.data.query.includeArchived).toBe(false);
  });

  test("includeArchived=true dibaca sebagai boolean", () => {
    const result = parse({ includeArchived: "true" });
    expect(result.success && result.data.query.includeArchived).toBe(true);
  });

  test("menolak nilai selain boolean", () => {
    expect(parse({ includeArchived: "mungkin" }).success).toBe(false);
  });
});
