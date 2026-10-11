import rateLimit from "express-rate-limit";
import { env } from "../config/env";

const message = (text: string) => ({ message: text });

// Unit/integration test tidak boleh tertahan kuota yang dipakai bersama.
const skip = () => env.NODE_ENV === "test";

/** Batas umum untuk seluruh endpoint (default 100 request / 15 menit / IP). */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_GLOBAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: message(
    "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit.",
  ),
});

/**
 * Batas ketat untuk endpoint yang memeriksa kredensial (login, refresh).
 * Menahan credential stuffing / brute force (NF-03).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  skipSuccessfulRequests: true,
  message: message(
    "Terlalu banyak percobaan gagal. Silakan coba lagi setelah 15 menit.",
  ),
});

/** Batas untuk pendaftaran akun, menahan pembuatan akun massal. */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.RATE_LIMIT_REGISTER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: message(
    "Terlalu banyak pendaftaran dari IP ini. Silakan coba lagi dalam satu jam.",
  ),
});
