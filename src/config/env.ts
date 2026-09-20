import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.coerce.number().default(3000),

    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL environment variable is not set."),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET minimal 32 karakter."),

    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET minimal 32 karakter."),

    // Daftar origin yang diizinkan, dipisahkan koma.
    // Kosong di development = izinkan semua origin.
    CORS_ORIGIN: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((origin) => origin.trim())
              .filter(Boolean)
          : [],
      ),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && value.CORS_ORIGIN.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGIN"],
        message:
          "CORS_ORIGIN wajib diisi di production. Isi dengan daftar origin aplikasi, dipisahkan koma.",
      });
    }

    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message:
          "JWT_REFRESH_SECRET harus berbeda dari JWT_ACCESS_SECRET, agar access token tidak dapat dipakai sebagai refresh token.",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Konfigurasi environment tidak valid:",
    z.flattenError(parsed.error).fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
