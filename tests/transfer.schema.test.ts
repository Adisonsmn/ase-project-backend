import { describe, expect, test } from "bun:test";
import {
  createTransferSchema,
  updateTransferSchema,
} from "../src/schemas/transfer.schema";

const BANK = "00000000-0000-4000-8000-0000000a0002";
const TUNAI = "00000000-0000-4000-8000-0000000a0001";
const ID = "8f1f2b94-6f0d-4f6c-9b3e-2f1c9d0a1b23";

const tomorrow = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 2);
  return date.toISOString().slice(0, 10);
};

describe("createTransferSchema", () => {
  const valid = {
    fromAccountId: BANK,
    toAccountId: TUNAI,
    amount: "300000",
    occurredAt: "2026-09-18",
  };
  const parse = (body: unknown) =>
    createTransferSchema.safeParse({ body, params: {}, query: {} });

  test("menerima transfer tanpa biaya", () => {
    expect(parse(valid).success).toBe(true);
  });

  test("biaya admin 0 diterima, negatif ditolak", () => {
    expect(parse({ ...valid, fee: "0" }).success).toBe(true);
    expect(parse({ ...valid, fee: "2500" }).success).toBe(true);
    expect(parse({ ...valid, fee: "-2500" }).success).toBe(false);
  });

  test("menolak akun asal dan tujuan yang sama", () => {
    expect(parse({ ...valid, toAccountId: BANK }).success).toBe(false);
  });

  test("menolak nominal 0", () => {
    expect(parse({ ...valid, amount: "0" }).success).toBe(false);
  });

  test("menolak tanggal di masa depan", () => {
    expect(parse({ ...valid, occurredAt: tomorrow() }).success).toBe(false);
  });

  test("menolak accountId bukan UUID", () => {
    expect(parse({ ...valid, fromAccountId: "bank" }).success).toBe(false);
  });
});

describe("updateTransferSchema", () => {
  const parse = (body: unknown) =>
    updateTransferSchema.safeParse({ body, params: { id: ID }, query: {} });

  test("menolak body kosong", () => {
    expect(parse({}).success).toBe(false);
  });

  test("fee 0 diterima (menghapus biaya admin)", () => {
    expect(parse({ fee: "0" }).success).toBe(true);
  });

  test("menolak akun asal dan tujuan yang sama bila keduanya dikirim", () => {
    expect(parse({ fromAccountId: TUNAI, toAccountId: TUNAI }).success).toBe(false);
  });

  test("boleh mengubah salah satu akun saja", () => {
    expect(parse({ toAccountId: TUNAI }).success).toBe(true);
  });
});
