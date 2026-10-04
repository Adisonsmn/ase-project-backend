import { describe, expect, test } from "bun:test";
import {
  adminListArticleQuerySchema,
  createArticleSchema,
  listArticleQuerySchema,
  updateArticleSchema,
} from "../src/schemas/article.schema";

const ID = "20000000-0000-4000-8000-000000000001";
const wrapBody = (body: unknown) => ({ body, params: {}, query: {} });
const wrapUpdate = (body: unknown) => ({ body, params: { id: ID }, query: {} });
const wrapQuery = (query: unknown) => ({ body: {}, params: {}, query });

const validArticle = {
  title: "Cara Menabung Uang Jajan",
  summary: "Tiga langkah sederhana supaya uang jajan tidak habis di tengah minggu.",
  content: "Isi artikel yang cukup panjang untuk lolos batas minimum lima puluh karakter.",
  categoryId: ID,
};

describe("createArticleSchema", () => {
  test("menerima input minimal dan status default DRAFT", () => {
    const result = createArticleSchema.safeParse(wrapBody(validArticle));
    expect(result.success).toBe(true);
    expect(result.data?.body.status).toBe("DRAFT");
  });

  test("menerima slug eksplisit yang valid", () => {
    const result = createArticleSchema.safeParse(
      wrapBody({ ...validArticle, slug: "menabung-uang-jajan" }),
    );
    expect(result.success).toBe(true);
  });

  test.each([
    ["huruf besar", "Menabung-Uang"],
    ["spasi", "menabung uang"],
    ["tanda hubung di awal", "-menabung"],
    ["tanda hubung ganda", "menabung--uang"],
    ["terlalu pendek", "ab"],
  ])("menolak slug dengan %s", (_label, slug) => {
    const result = createArticleSchema.safeParse(
      wrapBody({ ...validArticle, slug }),
    );
    expect(result.success).toBe(false);
  });

  test.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["ftp:", "ftp://contoh.com/gambar.png"],
    ["tanpa domain", "https://localhost/gambar.png"],
  ])("menolak thumbnailUrl berskema %s", (_label, thumbnailUrl) => {
    const result = createArticleSchema.safeParse(
      wrapBody({ ...validArticle, thumbnailUrl }),
    );
    expect(result.success).toBe(false);
  });

  test("menerima thumbnailUrl https", () => {
    const result = createArticleSchema.safeParse(
      wrapBody({ ...validArticle, thumbnailUrl: "https://cdn.contoh.com/a.png" }),
    );
    expect(result.success).toBe(true);
  });

  test("menolak sourceUrl tanpa sourceName", () => {
    const result = createArticleSchema.safeParse(
      wrapBody({ ...validArticle, sourceUrl: "https://kontan.co.id/berita" }),
    );
    expect(result.success).toBe(false);
  });

  test("menerima sourceUrl beserta sourceName", () => {
    const result = createArticleSchema.safeParse(
      wrapBody({
        ...validArticle,
        sourceName: "Kontan",
        sourceUrl: "https://kontan.co.id/berita",
      }),
    );
    expect(result.success).toBe(true);
  });

  test("menolak isi artikel yang terlalu pendek", () => {
    const result = createArticleSchema.safeParse(
      wrapBody({ ...validArticle, content: "Terlalu pendek." }),
    );
    expect(result.success).toBe(false);
  });

  test("menolak status yang tidak dikenal", () => {
    const result = createArticleSchema.safeParse(
      wrapBody({ ...validArticle, status: "ARCHIVED" }),
    );
    expect(result.success).toBe(false);
  });
});

describe("updateArticleSchema", () => {
  test("menolak body kosong", () => {
    expect(updateArticleSchema.safeParse(wrapUpdate({})).success).toBe(false);
  });

  test("menerima null untuk menghapus thumbnail", () => {
    const result = updateArticleSchema.safeParse(
      wrapUpdate({ thumbnailUrl: null }),
    );
    expect(result.success).toBe(true);
  });

  test("menerima perubahan status saja", () => {
    const result = updateArticleSchema.safeParse(
      wrapUpdate({ status: "PUBLISHED" }),
    );
    expect(result.success).toBe(true);
  });

  test("menolak id yang bukan UUID", () => {
    const result = updateArticleSchema.safeParse({
      body: { status: "PUBLISHED" },
      params: { id: "123" },
      query: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("listArticleQuerySchema", () => {
  test("memakai page 1 dan limit 20 sebagai default", () => {
    const result = listArticleQuerySchema.safeParse(wrapQuery({}));
    expect(result.data?.query).toEqual({ page: 1, limit: 20 });
  });

  test("menerima filter kategori berupa slug", () => {
    const result = listArticleQuerySchema.safeParse(
      wrapQuery({ category: "pasar-saham" }),
    );
    expect(result.success).toBe(true);
  });

  test("menolak limit di atas 100", () => {
    const result = listArticleQuerySchema.safeParse(wrapQuery({ limit: "101" }));
    expect(result.success).toBe(false);
  });
});

describe("adminListArticleQuerySchema", () => {
  test("menerima filter status DRAFT", () => {
    const result = adminListArticleQuerySchema.safeParse(
      wrapQuery({ status: "DRAFT" }),
    );
    expect(result.success).toBe(true);
  });
});
