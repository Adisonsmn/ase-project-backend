import { describe, expect, test } from "bun:test";
import jwt from "jsonwebtoken";
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../src/utils/jwt";

const userId = "8f1f2b94-6f0d-4f6c-9b3e-2f1c9d0a1b23";

describe("access token", () => {
  test("token yang dibuat dapat diverifikasi kembali", () => {
    const token = createAccessToken({ sub: userId, role: "USER" });
    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe(userId);
    expect(payload.role).toBe("USER");
  });

  test("token yang diubah ditolak", () => {
    const token = createAccessToken({ sub: userId, role: "USER" });
    const tampered = `${token.slice(0, -2)}xy`;

    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  test("refresh token tidak dapat dipakai sebagai access token", () => {
    const refreshToken = createRefreshToken({ sub: userId, sid: "sesi-1" });

    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });

  test("role yang tidak dikenal ditolak", () => {
    const token = jwt.sign(
      { sub: userId, role: "SUPERADMIN" },
      process.env.JWT_ACCESS_SECRET as string,
    );

    expect(() => verifyAccessToken(token)).toThrow();
  });

  test("token tanpa klaim role ditolak", () => {
    const token = jwt.sign(
      { sub: userId },
      process.env.JWT_ACCESS_SECRET as string,
    );

    expect(() => verifyAccessToken(token)).toThrow();
  });
});

describe("refresh token", () => {
  test("token yang dibuat dapat diverifikasi kembali", () => {
    const token = createRefreshToken({ sub: userId, sid: "sesi-1" });
    const payload = verifyRefreshToken(token);

    expect(payload.sub).toBe(userId);
    expect(payload.sid).toBe("sesi-1");
  });

  test("access token tidak dapat dipakai sebagai refresh token", () => {
    const accessToken = createAccessToken({ sub: userId, role: "USER" });

    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });

  test("token tanpa klaim sid ditolak", () => {
    const token = jwt.sign(
      { sub: userId },
      process.env.JWT_REFRESH_SECRET as string,
    );

    expect(() => verifyRefreshToken(token)).toThrow();
  });
});
