import { describe, expect, test } from "bun:test";
import { registerSchema, loginSchema } from "../src/schemas/auth.schema";
import { updateMeSchema } from "../src/schemas/user.schema";

const wrap = (body: unknown) => ({ body, params: {}, query: {} });

describe("registerSchema", () => {
  const valid = {
    email: "rani@example.com",
    username: "rani_15",
    password: "rahasia123",
    displayName: "Rani",
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

  test("displayName dan dateOfBirth bersifat opsional", () => {
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
    const result = updateMeSchema.safeParse(wrap({ displayName: "Rani A" }));
    expect(result.success).toBe(true);
  });

  test("menolak avatarUrl bukan URL", () => {
    const result = updateMeSchema.safeParse(wrap({ avatarUrl: "bukan-url" }));
    expect(result.success).toBe(false);
  });
});
