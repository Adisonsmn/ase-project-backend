import { describe, expect, test } from "bun:test";
import { resolveClientIp } from "../src/middlewares/rate-limit.middleware";

const SECRET = "secret-bersama-bff-yang-panjangnya-lebih-dari-32";
const SERVER_NEXT = "20.1.2.3";

describe("resolveClientIp", () => {
  test("memakai x-client-ip kalau x-bff-key cocok", () => {
    expect(
      resolveClientIp({ bffKey: SECRET, clientIp: "36.71.0.9" }, SERVER_NEXT, SECRET),
    ).toBe("36.71.0.9");
  });

  test("menerima IPv6 dari BFF", () => {
    expect(
      resolveClientIp({ bffKey: SECRET, clientIp: "2001:db8::1" }, SERVER_NEXT, SECRET),
    ).toBe("2001:db8::1");
  });

  test.each([
    ["secret salah", { bffKey: "secret-palsu", clientIp: "36.71.0.9" }],
    ["tanpa secret", { clientIp: "36.71.0.9" }],
    ["tanpa x-client-ip", { bffKey: SECRET }],
    ["x-client-ip bukan IP", { bffKey: SECRET, clientIp: "bukan-ip" }],
  ])("kembali ke IP koneksi: %s", (_label, headers) => {
    expect(resolveClientIp(headers, SERVER_NEXT, SECRET)).toBe(SERVER_NEXT);
  });

  test("mengabaikan header kalau BE tidak punya secret", () => {
    expect(
      resolveClientIp({ bffKey: SECRET, clientIp: "36.71.0.9" }, SERVER_NEXT, undefined),
    ).toBe(SERVER_NEXT);
  });
});
