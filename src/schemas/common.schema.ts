import { z } from "zod";

/** Parameter :id berupa UUID. */
export const idParamSchema = z.object({
  params: z.object({
    id: z.uuid("Format id tidak valid"),
  }),
});

export type IdParam = z.infer<typeof idParamSchema>["params"];

export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"], {
  message: "Tipe harus INCOME atau EXPENSE",
});

export const incomePeriodSchema = z.enum(["DAILY", "WEEKLY", "MONTHLY"], {
  message: "Periode harus DAILY, WEEKLY, atau MONTHLY",
});

/** Batas Decimal(14,2): 12 digit di depan koma. */
export const MAX_AMOUNT = 999_999_999_999.99;

/**
 * Nominal diterima sebagai string maupun number, lalu dinormalkan ke string
 * agar presisi tidak hilang sebelum masuk ke Decimal.
 */
const moneyFormat = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine(
    (value) => /^\d+(\.\d{1,2})?$/.test(value),
    "Nominal harus angka positif dengan maksimal 2 angka desimal",
  );

export const moneySchema = moneyFormat
  .refine((value) => Number(value) > 0, "Nominal harus lebih dari 0")
  .refine((value) => Number(value) <= MAX_AMOUNT, "Nominal terlalu besar");

/** Seperti moneySchema tetapi boleh 0, untuk saldo awal dan biaya opsional. */
export const nonNegativeMoneySchema = moneyFormat.refine(
  (value) => Number(value) <= MAX_AMOUNT,
  "Nominal terlalu besar",
);

export const percentageSchema = z
  .number()
  .int("Persentase harus bilangan bulat")
  .min(0, "Persentase minimal 0")
  .max(100, "Persentase maksimal 100");

/**
 * Akhiran nama domain yang hanya bermakna di jaringan lokal atau internal
 * cloud (mis. `printer.local`, `metadata.google.internal`).
 */
const LOCAL_DOMAIN_SUFFIXES = [
  "localhost",
  "local",
  "localdomain",
  "internal",
  "home.arpa",
];

const isLocalHostname = (hostname: string) => {
  const host = hostname.toLowerCase();
  return LOCAL_DOMAIN_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
};

/**
 * URL http(s) ke domain publik. `z.url()` polos menerima skema apa pun,
 * termasuk `javascript:` dan `data:`, yang menjadi celah XSS begitu frontend
 * merendernya sebagai tautan atau gambar. Hostname harus nama domain, jadi IP
 * (127.0.0.1, 169.254.169.254, [::1], juga bentuk desimal/hex yang dinormalkan
 * `URL` menjadi IP) ikut ditolak, begitu pula domain jaringan lokal.
 */
export const httpUrlSchema = z
  .url({
    protocol: /^https?$/,
    hostname: z.regexes.domain,
    error: "URL harus diawali http:// atau https:// dan memakai nama domain",
  })
  .max(2048, "URL maksimal 2048 karakter")
  .refine(
    (value) => !URL.canParse(value) || !isLocalHostname(new URL(value).hostname),
    "URL tidak boleh mengarah ke alamat jaringan lokal",
  );

/** Query pagination yang dipakai bersama oleh endpoint berdaftar. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const buildMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
