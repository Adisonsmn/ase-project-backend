import { describe, expect, test } from "bun:test";
import argon2 from "argon2";
import { hashToken, verifyTokenHash } from "../src/utils/token-hash";

describe("token hash", () => {
  test("hash SHA-256 hex, bukan token asli", () => {
    const hash = hashToken("token-rahasia");

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("token-rahasia");
  });

  test("verify menerima token yang benar", async () => {
    expect(await verifyTokenHash("token-rahasia", hashToken("token-rahasia"))).toBe(true);
  });

  test("verify menolak token yang salah", async () => {
    expect(await verifyTokenHash("token-lain", hashToken("token-rahasia"))).toBe(false);
  });

  test("verify menolak hash yang rusak", async () => {
    expect(await verifyTokenHash("token-rahasia", "bukan-hex")).toBe(false);
  });

  test("verify tetap menerima hash argon2 dari sesi lama", async () => {
    const legacy = await argon2.hash("token-rahasia", { type: argon2.argon2id });

    expect(await verifyTokenHash("token-rahasia", legacy)).toBe(true);
    expect(await verifyTokenHash("token-lain", legacy)).toBe(false);
  });
});
