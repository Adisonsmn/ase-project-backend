import { z } from "zod";

/** Terima "YYYY-MM-DD" maupun ISO datetime lengkap. */
const dateOfBirth = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })])
  .refine((value) => {
    const parsed = new Date(value);
    return parsed.getTime() <= Date.now();
  }, "Tanggal lahir tidak boleh di masa depan");

const username = z
  .string()
  .min(3, "Username minimal 3 karakter")
  .max(30, "Username maksimal 30 karakter")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username hanya boleh berisi huruf, angka, dan underscore",
  );

export const registerSchema = z.object({
  body: z.object({
    email: z.email("Format email tidak valid"),
    username,
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .max(128, "Password maksimal 128 karakter"),
    displayName: z
      .string()
      .min(2, "Display name minimal 2 karakter")
      .max(50, "Display name maksimal 50 karakter")
      .optional(),
    dateOfBirth: dateOfBirth.optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.email("Format email tidak valid"),
    password: z.string().min(1, "Password tidak boleh kosong"),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token wajib diisi"),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
export type RefreshInput = z.infer<typeof refreshSchema>["body"];
