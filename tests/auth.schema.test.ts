import { describe, expect, test } from "bun:test";
import { registerSchema, loginSchema } from "../src/schemas/auth.schema";
import { updateMeSchema } from "../src/schemas/user.schema";

const wrap = (body: unknown) => ({ body, params: {}, query: {} });

describe("registerSchema", () => {
  const valid = {
    email: "rani@example.com",
    username: "rani_15",
    password: "rahasia123",
    dateOfBirth: "2011-05-04",
  };

  test("menerima payload yang valid", () => {
    expect(registerSchema.safeParse(wrap(valid)).success).toBe(true);
  });

  test("menerima tanggal lahir format ISO datetime", () => {
    const result = registerSchema.safeParse(
      wrap({ ...valid, dateOfBirth: "2011-05-04T00:00:00+07:00" }),
    );

    expect(result.success).toBe(true);
  });

  test("menolak email tidak valid", () => {
    const result = registerSchema.safeParse(wrap({ ...valid, email: "rani" }));
    expect(result.success).toBe(false);
  });

  test("menolak password kurang dari 8 karakter", () => {
    const result = registerSchema.safeParse(wrap({ ...valid, password: "abc" }));
    expect(result.success).toBe(false);
  });

  test("menolak username dengan karakter terlarang", () => {
    const result = registerSchema.safeParse(
      wrap({ ...valid, username: "rani 15!" }),
    );
    expect(result.success).toBe(false);
  });

  test("menolak tanggal lahir di masa depan", () => {
    const result = registerSchema.safeParse(
      wrap({ ...valid, dateOfBirth: "2099-01-01" }),
    );
    expect(result.success).toBe(false);
  });

  test("dateOfBirth bersifat opsional", () => {
    const result = registerSchema.safeParse(
      wrap({
        email: valid.email,
        username: valid.username,
        password: valid.password,
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe("loginSchema", () => {
  test("tidak memaksa panjang minimum password", () => {
    // Akun lama mungkin dibuat saat batas minimum masih 6 karakter.
    const result = loginSchema.safeParse(
      wrap({ email: "rani@example.com", password: "abc123" }),
    );
    expect(result.success).toBe(true);
  });
});

describe("updateMeSchema", () => {
  test("menolak body kosong", () => {
    expect(updateMeSchema.safeParse(wrap({})).success).toBe(false);
  });

  test("menerima update satu field", () => {
    const result = updateMeSchema.safeParse(wrap({ username: "rani_a" }));
    expect(result.success).toBe(true);
  });

  test("menolak avatarUrl bukan URL", () => {
    const result = updateMeSchema.safeParse(wrap({ avatarUrl: "bukan-url" }));
    expect(result.success).toBe(false);
  });

  test.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:image/svg+xml,<svg onload=alert(1)>"],
    ["ftp:", "ftp://example.com/file.png"],
    ["file:", "file:///etc/passwd"],
    ["vbscript:", "vbscript:msgbox(1)"],
    ["localhost", "http://localhost/avatar.png"],
    ["loopback IPv4", "http://127.0.0.1/avatar.png"],
    ["IP desimal", "http://2130706433/avatar.png"],
    ["IP hex", "http://0x7f000001/avatar.png"],
    ["loopback IPv6", "http://[::1]/avatar.png"],
    ["IP private", "http://192.168.1.10/avatar.png"],
    ["metadata cloud", "http://169.254.169.254/latest/meta-data"],
    [".local", "http://printer.local/avatar.png"],
    [".localhost", "http://app.localhost/avatar.png"],
    [".internal", "http://metadata.google.internal/"],
    ["huruf besar", "https://PRINTER.LOCAL/avatar.png"],
    ["lebih dari 2048 karakter", `https://cdn.contoh.com/${"a".repeat(2048)}`],
  ])("menolak avatarUrl %s", (_label, avatarUrl) => {
    expect(updateMeSchema.safeParse(wrap({ avatarUrl })).success).toBe(false);
  });

  test("menerima avatarUrl https ke domain publik", () => {
    const result = updateMeSchema.safeParse(
      wrap({ avatarUrl: "https://cdn.contoh.com/avatar.png" }),
    );
    expect(result.success).toBe(true);
  });

  test("menerima avatarUrl yang domainnya hanya mirip nama lokal", () => {
    const result = updateMeSchema.safeParse(
      wrap({ avatarUrl: "https://local.contoh.com/avatar.png" }),
    );
    expect(result.success).toBe(true);
  });
});
