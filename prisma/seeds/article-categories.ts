/**
 * Kategori artikel sesuai PRD bagian 3.5.
 *
 * Id ditetapkan manual supaya seed idempotent. Slug ikut dipakai sebagai
 * filter di URL (`/articles?category=pasar-saham`), jadi jangan diubah setelah
 * dipakai frontend.
 */
export type SeedArticleCategory = {
  id: string;
  slug: string;
  name: string;
};

export const articleCategories: SeedArticleCategory[] = [
  { id: "20000000-0000-4000-8000-000000000001", slug: "pasar-saham", name: "Pasar Saham" },
  { id: "20000000-0000-4000-8000-000000000002", slug: "tips-keuangan", name: "Tips Keuangan" },
  { id: "20000000-0000-4000-8000-000000000003", slug: "berita-ekonomi", name: "Berita Ekonomi" },
  { id: "20000000-0000-4000-8000-000000000004", slug: "edukasi-instrumen", name: "Edukasi Instrumen" },
];
