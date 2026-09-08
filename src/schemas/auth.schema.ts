import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email("Format email tidak valid"),
    username: z
      .string()
      .min(3, "Username minimal 3 karakter")
      .max(30, "Username maksimal 30 karakter"),
    password: z.string().min(6, "Password minimal 6 karakter"),
    displayName: z
      .string()
      .min(2, "Display name minimal 2 karakter")
      .optional(),
    dateOfBirth: z
      .string()
      .datetime({ offset: true })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal lahir YYYY-MM-DD"))
      .optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Format email tidak valid"),
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
