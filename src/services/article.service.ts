import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../config/database";
import type {
  AdminListArticleQuery,
  CreateArticleInput,
  ListArticleQuery,
  UpdateArticleInput,
} from "../schemas/article.schema";
import { buildMeta } from "../schemas/common.schema";
import { AppError } from "../utils/app.error";
import { nextAvailableSlug, slugify } from "../utils/slug";

const categorySelect = { id: true, slug: true, name: true } as const;

/** Kolom untuk daftar: tanpa `content`, yang bisa puluhan ribu karakter. */
export const articleListSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  thumbnailUrl: true,
  publishedAt: true,
  category: { select: categorySelect },
} as const;

const articleDetailSelect = {
  ...articleListSelect,
  content: true,
  sourceName: true,
  sourceUrl: true,
  updatedAt: true,
} as const;

/** Admin juga perlu melihat status dan jejak waktu artikel. */
const articleAdminSelect = {
  ...articleDetailSelect,
  status: true,
  createdAt: true,
  author: { select: { id: true, username: true, displayName: true } },
} as const;

// Urutan sesuai PRD: terbaru di atas. createdAt dan id sebagai pemecah seri
// supaya pagination stabil walau beberapa artikel terbit di detik yang sama.
const newestFirst: Prisma.ArticleOrderByWithRelationInput[] = [
  { publishedAt: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
];

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

// --- Publik ------------------------------------------------------------------

export const listPublishedArticles = async (query: ListArticleQuery) => {
  const { page, limit, category } = query;

  const where: Prisma.ArticleWhereInput = {
    status: "PUBLISHED",
    ...(category && { category: { slug: category } }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.article.findMany({
      where,
      select: articleListSelect,
      orderBy: newestFirst,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.article.count({ where }),
  ]);

  return { data: items, meta: buildMeta(page, limit, total) };
};

export const getPublishedArticle = async (slug: string) => {
  const article = await prisma.article.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: articleDetailSelect,
  });

  // Draft dijawab 404, bukan 403: keberadaan draft tidak perlu diketahui publik.
  if (!article) {
    throw new AppError(404, "Artikel tidak ditemukan");
  }

  return article;
};

/** Daftar kategori beserta jumlah artikel terbit, untuk tombol filter. */
export const listArticleCategories = async () => {
  const categories = await prisma.articleCategory.findMany({
    select: {
      ...categorySelect,
      _count: { select: { articles: { where: { status: "PUBLISHED" } } } },
    },
    orderBy: { name: "asc" },
  });

  return categories.map(({ _count, ...category }) => ({
    ...category,
    articleCount: _count.articles,
  }));
};

// --- Admin -------------------------------------------------------------------

export const listArticlesForAdmin = async (query: AdminListArticleQuery) => {
  const { page, limit, status, category } = query;

  const where: Prisma.ArticleWhereInput = {
    ...(status && { status }),
    ...(category && { category: { slug: category } }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.article.findMany({
      where,
      select: {
        ...articleListSelect,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      // Draft belum punya publishedAt; yang terakhir disentuh paling relevan.
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.article.count({ where }),
  ]);

  return { data: items, meta: buildMeta(page, limit, total) };
};

export const getArticleForAdmin = async (id: string) => {
  const article = await prisma.article.findUnique({
    where: { id },
    select: articleAdminSelect,
  });

  if (!article) {
    throw new AppError(404, "Artikel tidak ditemukan");
  }

  return article;
};

const assertCategoryExists = async (categoryId: string) => {
  const category = await prisma.articleCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new AppError(404, "Kategori artikel tidak ditemukan");
  }
};

const assertSlugAvailable = async (slug: string, exceptId?: string) => {
  const existing = await prisma.article.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing && existing.id !== exceptId) {
    throw new AppError(409, "Slug sudah dipakai artikel lain.");
  }
};

/** Slug otomatis dari judul, dengan sufiks -2, -3, dst. kalau bentrok. */
const generateSlug = async (title: string) => {
  const base = slugify(title) || "artikel";

  const taken = await prisma.article.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });

  return nextAvailableSlug(
    base,
    taken.map((article) => article.slug),
  );
};

const assertAttribution = (
  sourceName: string | null | undefined,
  sourceUrl: string | null | undefined,
) => {
  if (sourceUrl && !sourceName) {
    throw new AppError(
      400,
      "sourceName wajib diisi kalau sourceUrl diisi, supaya atribusinya jelas.",
    );
  }
};

export const createArticle = async (
  authorId: string,
  input: CreateArticleInput,
) => {
  await assertCategoryExists(input.categoryId);

  if (input.slug) {
    await assertSlugAvailable(input.slug);
  }

  const slug = input.slug ?? (await generateSlug(input.title));

  try {
    return await prisma.article.create({
      data: {
        slug,
        title: input.title,
        summary: input.summary,
        content: input.content,
        thumbnailUrl: input.thumbnailUrl,
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
        categoryId: input.categoryId,
        authorId,
        status: input.status,
        publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      },
      select: articleAdminSelect,
    });
  } catch (error) {
    // Dua admin menyimpan judul yang sama bersamaan: keduanya lolos
    // pengecekan di atas, tapi constraint unik menolak yang kedua.
    if (isUniqueViolation(error)) {
      throw new AppError(
        409,
        "Slug sudah dipakai artikel lain. Silakan simpan ulang.",
      );
    }
    throw error;
  }
};

export const updateArticle = async (id: string, input: UpdateArticleInput) => {
  const article = await prisma.article.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      publishedAt: true,
      sourceName: true,
      sourceUrl: true,
    },
  });

  if (!article) {
    throw new AppError(404, "Artikel tidak ditemukan");
  }

  if (input.categoryId) {
    await assertCategoryExists(input.categoryId);
  }

  if (input.slug && input.slug !== article.slug) {
    await assertSlugAvailable(input.slug, id);
  }

  // Atribusi dicek terhadap nilai akhir, bukan hanya field yang dikirim:
  // menghapus sourceName sambil membiarkan sourceUrl juga harus ditolak.
  assertAttribution(
    input.sourceName !== undefined ? input.sourceName : article.sourceName,
    input.sourceUrl !== undefined ? input.sourceUrl : article.sourceUrl,
  );

  // publishedAt diisi sekali saat pertama terbit. Menurunkan ke draft lalu
  // menerbitkan ulang tidak memindahkan artikel ke urutan teratas.
  const firstPublish =
    input.status === "PUBLISHED" && article.publishedAt === null;

  try {
    return await prisma.article.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.summary !== undefined && { summary: input.summary }),
        ...(input.content !== undefined && { content: input.content }),
        ...(input.categoryId !== undefined && {
          categoryId: input.categoryId,
        }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.thumbnailUrl !== undefined && {
          thumbnailUrl: input.thumbnailUrl,
        }),
        ...(input.sourceName !== undefined && {
          sourceName: input.sourceName,
        }),
        ...(input.sourceUrl !== undefined && { sourceUrl: input.sourceUrl }),
        ...(input.status !== undefined && { status: input.status }),
        ...(firstPublish && { publishedAt: new Date() }),
      },
      select: articleAdminSelect,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "Slug sudah dipakai artikel lain.");
    }
    throw error;
  }
};

export const deleteArticle = async (id: string) => {
  const article = await prisma.article.findUnique({
    where: { id },
    select: { id: true, _count: { select: { bookmarks: true } } },
  });

  if (!article) {
    throw new AppError(404, "Artikel tidak ditemukan");
  }

  await prisma.article.delete({ where: { id } });

  return {
    message: "Artikel dihapus.",
    removedBookmarks: article._count.bookmarks,
  };
};
