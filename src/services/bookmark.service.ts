import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../config/database";
import type { ListBookmarkQuery } from "../schemas/article.schema";
import { buildMeta } from "../schemas/common.schema";
import { AppError } from "../utils/app.error";
import { articleListSelect } from "./article.service";

const findBookmark = (userId: string, articleId: string) =>
  prisma.bookmark.findUnique({
    where: { userId_articleId: { userId, articleId } },
    select: { createdAt: true },
  });

/**
 * Menyimpan bookmark. Idempotent: menandai artikel yang sudah ditandai tidak
 * dianggap error, karena dari sisi user hasil akhirnya sama.
 */
export const addBookmark = async (userId: string, articleId: string) => {
  const article = await prisma.article.findFirst({
    where: { id: articleId, status: "PUBLISHED" },
    select: { id: true },
  });

  if (!article) {
    throw new AppError(404, "Artikel tidak ditemukan");
  }

  const existing = await findBookmark(userId, articleId);
  if (existing) {
    return { created: false, articleId, bookmarkedAt: existing.createdAt };
  }

  try {
    const bookmark = await prisma.bookmark.create({
      data: { userId, articleId },
      select: { createdAt: true },
    });
    return { created: true, articleId, bookmarkedAt: bookmark.createdAt };
  } catch (error) {
    // Dua tap cepat dari aplikasi: request kedua kalah di constraint unik.
    // Hasilnya tetap "sudah ditandai", bukan error.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const bookmark = await findBookmark(userId, articleId);
      if (bookmark) {
        return { created: false, articleId, bookmarkedAt: bookmark.createdAt };
      }
    }
    throw error;
  }
};

/** Menghapus bookmark. Idempotent: menghapus yang tidak ada tetap berhasil. */
export const removeBookmark = async (userId: string, articleId: string) => {
  const { count } = await prisma.bookmark.deleteMany({
    where: { userId, articleId },
  });

  return { message: "Bookmark dihapus.", removed: count > 0 };
};

/**
 * Bookmark milik user, terbaru di atas. Artikel yang diturunkan kembali ke
 * draft disembunyikan, tetapi bookmark-nya tidak dihapus: begitu artikel
 * terbit lagi, bookmark itu muncul kembali.
 */
export const listBookmarks = async (
  userId: string,
  query: ListBookmarkQuery,
) => {
  const { page, limit } = query;

  const where: Prisma.BookmarkWhereInput = {
    userId,
    article: { status: "PUBLISHED" },
  };

  const [items, total] = await prisma.$transaction([
    prisma.bookmark.findMany({
      where,
      select: { createdAt: true, article: { select: articleListSelect } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.bookmark.count({ where }),
  ]);

  return {
    data: items.map((item) => ({
      bookmarkedAt: item.createdAt,
      article: item.article,
    })),
    meta: buildMeta(page, limit, total),
  };
};
