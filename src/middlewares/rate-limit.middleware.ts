import rateLimit from "express-rate-limit";

const message = (text: string) => ({ message: text });

/** Batas umum untuk seluruh endpoint: 100 request / 15 menit / IP. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
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
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: message(
    "Terlalu banyak percobaan gagal. Silakan coba lagi setelah 15 menit.",
  ),
});

/** Batas untuk pendaftaran akun, menahan pembuatan akun massal. */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: message(
    "Terlalu banyak pendaftaran dari IP ini. Silakan coba lagi dalam satu jam.",
  ),
});
