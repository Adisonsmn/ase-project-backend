import { z } from "zod";
import { httpUrlSchema, paginationQuerySchema } from "./common.schema";
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "../utils/slug";

const articleStatusSchema = z.enum(["DRAFT", "PUBLISHED"], {
  message: "Status harus DRAFT atau PUBLISHED",
});

const slug = z
  .string()
  .trim()
  .min(3, "Slug minimal 3 karakter")
  .max(SLUG_MAX_LENGTH, `Slug maksimal ${SLUG_MAX_LENGTH} karakter`)
  .regex(
    SLUG_PATTERN,
    "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung, tanpa tanda hubung di awal atau akhir",
  );

/** Slug kategori dipakai sebagai filter di URL publik. */
const categorySlug = z.string().trim().max(50).regex(SLUG_PATTERN, "Kategori tidak valid");

const title = z
  .string()
  .trim()
  .min(5, "Judul minimal 5 karakter")
  .max(150, "Judul maksimal 150 karakter");

const summary = z
  .string()
  .trim()
  .min(10, "Ringkasan minimal 10 karakter")
  .max(300, "Ringkasan maksimal 300 karakter");

// Batas atas menjaga isi tetap di bawah batas body request 100kb.
const content = z
  .string()
  .trim()
  .min(50, "Isi artikel minimal 50 karakter")
  .max(50_000, "Isi artikel maksimal 50.000 karakter");

const sourceName = z.string().trim().min(2).max(100, "Nama sumber maksimal 100 karakter");

const idParams = z.object({ id: z.uuid("Format id tidak valid") });

// --- Publik ------------------------------------------------------------------

export const listArticleQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    category: categorySlug.optional(),
  }),
});

export const articleSlugParamSchema = z.object({
  // Sengaja tidak memakai SLUG_PATTERN: slug yang bentuknya salah pasti tidak
  // ada, dan untuk URL publik jawaban yang tepat adalah 404, bukan 400.
  params: z.object({ slug: z.string().trim().min(1).max(200) }),
});

// --- Admin -------------------------------------------------------------------

export const createArticleSchema = z.object({
  body: z
    .object({
      title,
      summary,
      content,
      categoryId: z.uuid("Format categoryId tidak valid"),
      /** Kosongkan untuk dibuat otomatis dari judul. */
      slug: slug.optional(),
      thumbnailUrl: httpUrlSchema.optional(),
      sourceName: sourceName.optional(),
      sourceUrl: httpUrlSchema.optional(),
      status: articleStatusSchema.default("DRAFT"),
    })
    .refine((data) => !data.sourceUrl || data.sourceName, {
      message: "sourceName wajib diisi kalau sourceUrl diisi, supaya atribusinya jelas",
      path: ["sourceName"],
    }),
});

export const updateArticleSchema = z.object({
  params: idParams,
  body: z
    .object({
      title: title.optional(),
      summary: summary.optional(),
      content: content.optional(),
      categoryId: z.uuid("Format categoryId tidak valid").optional(),
      // Slug tidak ikut berubah saat judul diubah; ubah eksplisit di sini.
      slug: slug.optional(),
      // null untuk menghapus nilai.
      thumbnailUrl: httpUrlSchema.nullable().optional(),
      sourceName: sourceName.nullable().optional(),
      sourceUrl: httpUrlSchema.nullable().optional(),
      status: articleStatusSchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Minimal satu field harus diisi untuk memperbarui artikel.",
    }),
});

export const adminListArticleQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    status: articleStatusSchema.optional(),
    category: categorySlug.optional(),
  }),
});

export const articleIdParamSchema = z.object({ params: idParams });

// --- Bookmark ----------------------------------------------------------------

export const listBookmarkQuerySchema = z.object({
  query: paginationQuerySchema,
});

export type ListArticleQuery = z.infer<typeof listArticleQuerySchema>["query"];
export type AdminListArticleQuery = z.infer<
  typeof adminListArticleQuerySchema
>["query"];
export type ArticleSlugParam = z.infer<typeof articleSlugParamSchema>["params"];
export type CreateArticleInput = z.infer<typeof createArticleSchema>["body"];
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>["body"];
export type ListBookmarkQuery = z.infer<typeof listBookmarkQuerySchema>["query"];
