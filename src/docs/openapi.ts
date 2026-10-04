import { z } from "zod";

import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from "../schemas/auth.schema";
import { updateMeSchema } from "../schemas/user.schema";
import {
  listCategoryQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from "../schemas/category.schema";
import {
  createGoalSchema,
  updateGoalSchema,
  listGoalQuerySchema,
  listIncomeIdeaQuerySchema,
} from "../schemas/goal.schema";
import {
  calculateRatioSchema,
  saveRatioSchema,
} from "../schemas/savings.schema";
import {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionQuerySchema,
  summaryQuerySchema,
} from "../schemas/transaction.schema";
import {
  adminListArticleQuerySchema,
  articleIdParamSchema,
  articleSlugParamSchema,
  createArticleSchema,
  listArticleQuerySchema,
  listBookmarkQuerySchema,
  updateArticleSchema,
} from "../schemas/article.schema";

/**
 * Dokumen OpenAPI dibangun langsung dari schema Zod yang dipakai
 * validateMiddleware, memakai konversi JSON Schema bawaan Zod 4. Dengan begitu
 * dokumentasi tidak bisa melenceng dari validasi yang benar-benar berjalan:
 * mengubah schema otomatis mengubah dokumentasi.
 */

type JsonSchema = Record<string, unknown>;

/** Schema di proyek ini berbentuk z.object({ body, params, query }). */
type RequestSchema = z.ZodObject<Record<string, z.ZodType>>;

const toJson = (schema: z.ZodType): JsonSchema => {
  const json = z.toJSONSchema(schema, {
    io: "input",
    // `amount` memakai .transform(), yang tidak punya padanan langsung di
    // JSON Schema. "any" membuatnya tetap terdokumentasi, bukan menggagalkan
    // pembuatan dokumen.
    unrepresentable: "any",
  }) as JsonSchema;

  // Dokumen OpenAPI 3.1 sudah menetapkan dialek JSON Schema-nya sendiri,
  // jadi $schema per sub-skema hanya jadi derau.
  delete json.$schema;
  return json;
};

const partOf = (schema: RequestSchema, key: "body" | "params" | "query") => {
  const part = schema.shape[key];
  return part ? toJson(part) : undefined;
};

/** Object JSON Schema -> daftar parameter OpenAPI. */
const toParameters = (
  schema: RequestSchema,
  key: "params" | "query",
  location: "path" | "query",
) => {
  const json = partOf(schema, key);
  if (!json) return [];

  const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
  const required = (json.required ?? []) as string[];

  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: location,
    required: location === "path" ? true : required.includes(name),
    schema: propertySchema,
  }));
};

const jsonBody = (schema: RequestSchema) => {
  const body = partOf(schema, "body");
  if (!body || Object.keys(body.properties ?? {}).length === 0) return undefined;

  return {
    required: true,
    content: { "application/json": { schema: body } },
  };
};

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          message: { type: "string" },
          errors: { type: "object", additionalProperties: true },
          requestId: { type: "string" },
        },
        required: ["message"],
      },
    },
  },
});

type RouteSpec = {
  method: "get" | "post" | "patch" | "put" | "delete";
  path: string;
  tag: string;
  summary: string;
  auth?: boolean;
  admin?: boolean;
  schema?: RequestSchema;
  successStatus?: number;
  successDescription?: string;
};

const routes: RouteSpec[] = [
  {
    method: "get",
    path: "/health",
    tag: "Health",
    summary: "Liveness probe",
    successDescription: "Server hidup",
  },
  {
    method: "get",
    path: "/health/ready",
    tag: "Health",
    summary: "Readiness probe, termasuk cek koneksi database",
    successDescription: "Server dan database siap",
  },

  {
    method: "post",
    path: "/api/v1/auth/register",
    tag: "Auth",
    summary: "Daftar akun baru",
    schema: registerSchema,
    successStatus: 201,
    successDescription: "Akun dibuat, access & refresh token dikembalikan",
  },
  {
    method: "post",
    path: "/api/v1/auth/login",
    tag: "Auth",
    summary: "Login",
    schema: loginSchema,
    successDescription: "Access & refresh token",
  },
  {
    method: "post",
    path: "/api/v1/auth/refresh",
    tag: "Auth",
    summary: "Tukar refresh token (token lama dirotasi)",
    schema: refreshSchema,
    successDescription: "Pasangan token baru",
  },
  {
    method: "post",
    path: "/api/v1/auth/logout",
    tag: "Auth",
    summary: "Cabut sesi",
    schema: refreshSchema,
    successDescription: "Sesi dicabut",
  },

  {
    method: "get",
    path: "/api/v1/users/me",
    tag: "User",
    summary: "Profil sendiri",
    auth: true,
    successDescription: "Data profil",
  },
  {
    method: "patch",
    path: "/api/v1/users/me",
    tag: "User",
    summary: "Ubah profil sendiri",
    auth: true,
    schema: updateMeSchema,
    successDescription: "Profil setelah diperbarui",
  },

  {
    method: "get",
    path: "/api/v1/categories",
    tag: "Kategori",
    summary: "Daftar kategori (bawaan sistem + milik sendiri)",
    auth: true,
    schema: listCategoryQuerySchema,
    successDescription: "Daftar kategori",
  },
  {
    method: "post",
    path: "/api/v1/categories",
    tag: "Kategori",
    summary: "Tambah kategori kustom",
    auth: true,
    schema: createCategorySchema,
    successStatus: 201,
    successDescription: "Kategori dibuat",
  },
  {
    method: "patch",
    path: "/api/v1/categories/{id}",
    tag: "Kategori",
    summary: "Ubah kategori sendiri (kategori bawaan ditolak 403)",
    auth: true,
    schema: updateCategorySchema,
    successDescription: "Kategori setelah diperbarui",
  },
  {
    method: "delete",
    path: "/api/v1/categories/{id}",
    tag: "Kategori",
    summary:
      "Hapus kategori sendiri. Transaksinya dipindah ke kategori Lain-lain, tidak ikut terhapus",
    auth: true,
    schema: updateCategorySchema,
    successDescription: "Kategori dihapus, beserta jumlah transaksi yang dipindah",
  },

  {
    method: "get",
    path: "/api/v1/savings/ratio/presets",
    tag: "Rasio Menabung",
    summary: "Daftar preset rasio (60:30:10, 50:30:20, 70:20:10)",
    successDescription: "Daftar preset beserta rasio default",
  },
  {
    method: "post",
    path: "/api/v1/savings/ratio/calculate",
    tag: "Rasio Menabung",
    summary:
      "Hitung alokasi dana. Hasilnya tidak disimpan. Prioritas rasio: kustom > preset > tersimpan > default",
    auth: true,
    schema: calculateRatioSchema,
    successDescription:
      "Alokasi per periode input dan setara bulanan, beserta tips kontekstual",
  },
  {
    method: "get",
    path: "/api/v1/savings/ratio",
    tag: "Rasio Menabung",
    summary: "Rasio tersimpan milik user (null kalau belum pernah menyimpan)",
    auth: true,
    successDescription: "Rasio tersimpan, atau null beserta rasio default",
  },
  {
    method: "put",
    path: "/api/v1/savings/ratio",
    tag: "Rasio Menabung",
    summary: "Simpan atau ubah rasio kustom. Satu rasio per user",
    auth: true,
    schema: saveRatioSchema,
    successDescription: "Rasio setelah disimpan",
  },

  {
    method: "post",
    path: "/api/v1/goals",
    tag: "Target Tabungan",
    summary: "Buat target tabungan",
    auth: true,
    schema: createGoalSchema,
    successStatus: 201,
    successDescription: "Target dibuat",
  },
  {
    method: "get",
    path: "/api/v1/goals",
    tag: "Target Tabungan",
    summary: "Daftar target, target utama di urutan pertama",
    auth: true,
    schema: listGoalQuerySchema,
    successDescription: "Daftar target",
  },
  {
    method: "get",
    path: "/api/v1/goals/{id}",
    tag: "Target Tabungan",
    summary: "Detail target. Progress disegarkan dari transaksi bertaut",
    auth: true,
    schema: updateGoalSchema,
    successDescription: "Detail target beserta progress terbaru",
  },
  {
    method: "get",
    path: "/api/v1/goals/{id}/gap",
    tag: "Target Tabungan",
    summary:
      "Analisis kesenjangan menuju target, beserta rekomendasi penambahan income sesuai kelompok usia",
    auth: true,
    schema: updateGoalSchema,
    successDescription:
      "Kebutuhan per bulan, kemampuan, gap, saran, dan daftar ide income",
  },
  {
    method: "patch",
    path: "/api/v1/goals/{id}",
    tag: "Target Tabungan",
    summary: "Ubah target",
    auth: true,
    schema: updateGoalSchema,
    successDescription: "Target setelah diperbarui",
  },
  {
    method: "delete",
    path: "/api/v1/goals/{id}",
    tag: "Target Tabungan",
    summary:
      "Hapus target. Transaksinya tidak ikut terhapus, hanya tautannya yang dilepas",
    auth: true,
    schema: updateGoalSchema,
    successDescription: "Target dihapus beserta jumlah transaksi yang dilepas",
  },
  {
    method: "get",
    path: "/api/v1/income-ideas",
    tag: "Target Tabungan",
    summary:
      "Daftar ide penambahan income. Kelompok usia diambil dari profil kalau tidak disebutkan",
    auth: true,
    schema: listIncomeIdeaQuerySchema,
    successDescription: "Daftar ide, diurutkan berdasarkan kecocokan dengan gap",
  },

  {
    method: "post",
    path: "/api/v1/transactions",
    tag: "Transaksi",
    summary: "Catat transaksi",
    auth: true,
    schema: createTransactionSchema,
    successStatus: 201,
    successDescription: "Transaksi dibuat",
  },
  {
    method: "get",
    path: "/api/v1/transactions",
    tag: "Transaksi",
    summary: "Riwayat transaksi dengan filter dan pagination",
    auth: true,
    schema: listTransactionQuerySchema,
    successDescription: "Daftar transaksi + meta pagination",
  },
  {
    method: "get",
    path: "/api/v1/transactions/summary",
    tag: "Transaksi",
    summary:
      "Ringkasan pemasukan vs pengeluaran, breakdown kategori, dan deret waktu untuk grafik",
    auth: true,
    schema: summaryQuerySchema,
    successDescription: "Data ringkasan",
  },
  {
    method: "get",
    path: "/api/v1/transactions/{id}",
    tag: "Transaksi",
    summary: "Detail transaksi",
    auth: true,
    schema: updateTransactionSchema,
    successDescription: "Detail transaksi",
  },
  {
    method: "patch",
    path: "/api/v1/transactions/{id}",
    tag: "Transaksi",
    summary: "Ubah transaksi",
    auth: true,
    schema: updateTransactionSchema,
    successDescription: "Transaksi setelah diperbarui",
  },
  {
    method: "delete",
    path: "/api/v1/transactions/{id}",
    tag: "Transaksi",
    summary: "Hapus transaksi",
    auth: true,
    schema: updateTransactionSchema,
    successDescription: "Transaksi dihapus",
  },

  {
    method: "get",
    path: "/api/v1/articles",
    tag: "Artikel",
    summary:
      "Daftar artikel terbit, terbaru di atas. Publik. Filter kategori memakai slug",
    schema: listArticleQuerySchema,
    successDescription: "Daftar artikel (tanpa isi) + meta pagination",
  },
  {
    method: "get",
    path: "/api/v1/articles/{slug}",
    tag: "Artikel",
    summary: "Detail artikel terbit berdasarkan slug. Publik. Draft dijawab 404",
    schema: articleSlugParamSchema,
    successDescription: "Detail artikel beserta isi dan atribusi sumber",
  },
  {
    method: "get",
    path: "/api/v1/article-categories",
    tag: "Artikel",
    summary: "Daftar kategori artikel beserta jumlah artikel terbit. Publik",
    successDescription: "Daftar kategori",
  },
  {
    method: "post",
    path: "/api/v1/articles",
    tag: "Artikel",
    summary:
      "Buat artikel (ADMIN). Slug dibuat otomatis dari judul kalau tidak diisi; status default DRAFT",
    auth: true,
    admin: true,
    schema: createArticleSchema,
    successStatus: 201,
    successDescription: "Artikel dibuat",
  },
  {
    method: "patch",
    path: "/api/v1/articles/{id}",
    tag: "Artikel",
    summary:
      "Ubah artikel (ADMIN). Slug tidak ikut berubah saat judul diubah. Kirim null untuk menghapus thumbnail/sumber",
    auth: true,
    admin: true,
    schema: updateArticleSchema,
    successDescription: "Artikel setelah diperbarui",
  },
  {
    method: "delete",
    path: "/api/v1/articles/{id}",
    tag: "Artikel",
    summary: "Hapus artikel (ADMIN). Bookmark-nya ikut terhapus",
    auth: true,
    admin: true,
    schema: articleIdParamSchema,
    successDescription: "Artikel dihapus beserta jumlah bookmark yang ikut terhapus",
  },
  {
    method: "get",
    path: "/api/v1/admin/articles",
    tag: "Artikel",
    summary: "Semua artikel termasuk draft (ADMIN), terakhir diubah di atas",
    auth: true,
    admin: true,
    schema: adminListArticleQuerySchema,
    successDescription: "Daftar artikel beserta status + meta pagination",
  },
  {
    method: "get",
    path: "/api/v1/admin/articles/{id}",
    tag: "Artikel",
    summary: "Detail artikel berdasarkan id, termasuk draft (ADMIN)",
    auth: true,
    admin: true,
    schema: articleIdParamSchema,
    successDescription: "Detail artikel beserta status dan penulis",
  },

  {
    method: "post",
    path: "/api/v1/articles/{id}/bookmark",
    tag: "Bookmark",
    summary:
      "Tandai artikel. Idempotent: 201 saat baru ditandai, 200 kalau sudah ditandai sebelumnya",
    auth: true,
    schema: articleIdParamSchema,
    successStatus: 201,
    successDescription: "Artikel ditandai",
  },
  {
    method: "delete",
    path: "/api/v1/articles/{id}/bookmark",
    tag: "Bookmark",
    summary: "Hapus tanda. Idempotent: tetap 200 walau belum pernah ditandai",
    auth: true,
    schema: articleIdParamSchema,
    successDescription: "Tanda dihapus; `removed` false kalau memang tidak ada",
  },
  {
    method: "get",
    path: "/api/v1/bookmarks",
    tag: "Bookmark",
    summary:
      "Artikel yang ditandai, terbaru di atas. Artikel yang diturunkan ke draft disembunyikan",
    auth: true,
    schema: listBookmarkQuerySchema,
    successDescription: "Daftar bookmark + meta pagination",
  },
];

export const buildOpenApiDocument = () => {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const parameters = route.schema
      ? [
          ...toParameters(route.schema, "params", "path"),
          ...toParameters(route.schema, "query", "query"),
        ]
      : [];

    // Endpoint GET/DELETE tidak mengirim body walau schema-nya punya bagian body
    // (schema-nya dipakai ulang hanya untuk parameter :id).
    const sendsBody =
      route.method === "post" ||
      route.method === "patch" ||
      route.method === "put";

    const operation: Record<string, unknown> = {
      tags: [route.tag],
      summary: route.summary,
      ...(parameters.length > 0 && { parameters }),
      ...(sendsBody && route.schema
        ? { requestBody: jsonBody(route.schema) }
        : {}),
      responses: {
        [route.successStatus ?? 200]: {
          description: route.successDescription ?? "Berhasil",
        },
        400: errorResponse("Data request tidak valid"),
        ...(route.auth && { 401: errorResponse("Token tidak ada atau kedaluwarsa") }),
        ...(route.admin && { 403: errorResponse("Tidak punya akses") }),
        404: errorResponse("Data tidak ditemukan"),
        429: errorResponse("Terlalu banyak permintaan"),
      },
      ...(route.auth && { security: [{ bearerAuth: [] }] }),
    };

    paths[route.path] = { ...paths[route.path], [route.method]: operation };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "API Edukasi Literasi Keuangan",
      version: "1.0.0",
      description:
        "Backend aplikasi edukasi literasi keuangan.\n\n" +
        "Catatan penting:\n" +
        "- Nominal uang dikirim dan diterima sebagai **string** (contoh `\"15000.55\"`) untuk menjaga presisi desimal.\n" +
        "- Tanggal memakai ISO 8601. Laporan dikelompokkan menurut waktu **Asia/Jakarta**.\n" +
        "- Semua respons error berformat `{ message, errors?, requestId }`.",
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "Health", description: "Monitoring" },
      { name: "Auth", description: "Registrasi, login, rotasi token" },
      { name: "User", description: "Profil pengguna" },
      { name: "Kategori", description: "Kategori transaksi (F-07)" },
      { name: "Rasio Menabung", description: "Saran alokasi dana (F-01..F-03)" },
      {
        name: "Target Tabungan",
        description: "Goal, analisis gap, dan saran income (F-04..F-06)",
      },
      { name: "Transaksi", description: "Catatan keuangan & laporan (F-07..F-09)" },
      { name: "Artikel", description: "Artikel & berita keuangan (F-14..F-15)" },
      { name: "Bookmark", description: "Artikel favorit (F-16)" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    paths,
  };
};
