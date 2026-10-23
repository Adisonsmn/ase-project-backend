import { createHash, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";

/**
 * Hash refresh token pakai SHA-256. Refresh token adalah JWT acak berentropi
 * tinggi, jadi tidak perlu hash lambat seperti argon2 yang ditujukan untuk
 * password buatan manusia.
 */
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const verifyTokenHash = async (token: string, storedHash: string) => {
  // Sesi lama masih menyimpan hash argon2.
  if (storedHash.startsWith("$argon2")) {
    return argon2.verify(storedHash, token);
  }

  const expected = Buffer.from(storedHash, "hex");
  const actual = createHash("sha256").update(token).digest();

  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
