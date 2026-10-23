import { describe, expect, test } from "bun:test";
import argon2 from "argon2";
import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from "../src/utils/password";

describe("password", () => {
  test("hash menghasilkan string argon2id, bukan password asli", async () => {
    const hash = await hashPassword("rahasia123");

    expect(hash).toStartWith("$argon2id$");
    expect(hash).not.toContain("rahasia123");
  });

  test("password yang sama menghasilkan hash berbeda (salt acak)", async () => {
    const [a, b] = await Promise.all([
      hashPassword("rahasia123"),
      hashPassword("rahasia123"),
    ]);

    expect(a).not.toBe(b);
  });

  test("verify menerima password yang benar", async () => {
    const hash = await hashPassword("rahasia123");
    expect(await verifyPassword("rahasia123", hash)).toBe(true);
  });

  test("verify menolak password yang salah", async () => {
    const hash = await hashPassword("rahasia123");
    expect(await verifyPassword("rahasia124", hash)).toBe(false);
  });
});

describe("passwordNeedsRehash", () => {
  test("hash baru tidak perlu di-rehash", async () => {
    expect(passwordNeedsRehash(await hashPassword("rahasia123"))).toBe(false);
  });

  test("hash dengan parameter default lama perlu di-rehash", async () => {
    const legacy = await argon2.hash("rahasia123", { type: argon2.argon2id });
    expect(passwordNeedsRehash(legacy)).toBe(true);
  });
});
