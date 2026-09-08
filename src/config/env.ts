import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
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
});

export const env = envSchema.parse(process.env);