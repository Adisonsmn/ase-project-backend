import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env";

const message = (text: string) => ({ message: text });

// Unit/integration test tidak boleh tertahan kuota yang dipakai bersama.
const skip = () => env.NODE_ENV === "test";

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * IP yang dipakai sebagai kunci rate limit.
 *
 * Semua request frontend lewat BFF Next, jadi IP koneksinya selalu IP server
 * Next dan seluruh user akan berbagi satu kuota. BFF mengirim IP klien asli di
 * `x-client-ip`, tetapi header itu hanya dipercaya kalau `x-bff-key` cocok
 * dengan secret bersama; tanpa itu siapa pun bisa memalsukan IP-nya.
 */
export const resolveClientIp = (
  headers: { bffKey?: string; clientIp?: string },
  fallbackIp: string,
  secret: string | undefined,
) => {
  if (
    secret &&
    headers.bffKey &&
    headers.clientIp &&
    isIP(headers.clientIp) !== 0 &&
    sameSecret(headers.bffKey, secret)
  ) {
    return headers.clientIp;
  }
  return fallbackIp;
};

const clientIpKey = (req: Request) =>
  ipKeyGenerator(
    resolveClientIp(
      { bffKey: req.get("x-bff-key"), clientIp: req.get("x-client-ip") },
      req.ip ?? "",
      env.BFF_SHARED_SECRET,
    ),
  );

/** Batas umum untuk seluruh endpoint (default 100 request / 15 menit / IP). */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_GLOBAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  keyGenerator: clientIpKey,
  message: message(
    "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit.",
  ),
});

/**
 * Kunci login = IP + email, agar satu akun yang salah password tidak ikut
 * mengunci pengguna lain di jaringan yang sama (mis. Wi-Fi kampus / NAT).
 * Percobaan ke banyak email dari satu IP tetap tertahan globalLimiter.
 */
const loginKey = (req: Request) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  return `${clientIpKey(req)}:${email}`;
};

/**
 * Batas ketat untuk login: hanya percobaan gagal yang dihitung.
 * Menahan brute force password per akun (NF-03).
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  skipSuccessfulRequests: true,
  keyGenerator: loginKey,
  message: message(
    "Terlalu banyak percobaan gagal. Silakan coba lagi setelah 15 menit.",
  ),
});

/**
 * Batas refresh token, terpisah dari login: refresh gagal (token kedaluwarsa
 * yang dikirim otomatis oleh frontend) tidak boleh menghabiskan jatah login.
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  skipSuccessfulRequests: true,
  keyGenerator: clientIpKey,
  message: message(
    "Terlalu banyak refresh token gagal. Silakan login ulang atau coba lagi setelah 15 menit.",
  ),
});

/** Batas untuk pendaftaran akun, menahan pembuatan akun massal. */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.RATE_LIMIT_REGISTER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  keyGenerator: clientIpKey,
  message: message(
    "Terlalu banyak pendaftaran dari IP ini. Silakan coba lagi dalam satu jam.",
  ),
});
