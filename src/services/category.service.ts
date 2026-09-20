import type { TransactionType } from "../../generated/prisma/enums";
import { prisma } from "../config/database";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../schemas/category.schema";
import { AppError } from "../utils/app.error";

const categorySelect = {
  id: true,
  name: true,
  icon: true,
  type: true,
  isSystem: true,
  isFallback: true,
} as const;

/** Kategori sistem + milik user sendiri. */
export const listCategories = async (
  userId: string,
  type?: TransactionType,
) => {
  return prisma.category.findMany({
    where: {
      OR: [{ userId: null }, { userId }],
      ...(type && { type }),
    },
    select: categorySelect,
    // Kategori sistem lebih dulu, lalu urut nama.
    orderBy: [{ isSystem: "desc" }, { type: "asc" }, { name: "asc" }],
  });
};

/**
 * Mengambil kategori yang boleh dipakai user: miliknya sendiri atau kategori
 * sistem. Melempar 404 kalau tidak ada atau milik user lain — sengaja 404,
 * bukan 403, supaya  data user lain tidak bocor.
 */
export const getUsableCategory = async (userId: string, categoryId: string) => {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      OR: [{ userId: null }, { userId }],
    },
    select: categorySelect,
  });

  if (!category) {
    throw new AppError(404, "Kategori tidak ditemukan");
  }

  return category;
};

export const createCategory = async (
  userId: string,
  input: CreateCategoryInput,
) => {
  const duplicate = await prisma.category.findFirst({
    where: {
      name: { equals: input.name, mode: "insensitive" },
      type: input.type,
      OR: [{ userId: null }, { userId }],
    },
    select: { id: true, isSystem: true },
  });

  if (duplicate) {
    throw new AppError(
      409,
      duplicate.isSystem
        ? "Kategori dengan nama itu sudah tersedia sebagai kategori bawaan."
        : "Anda sudah punya kategori dengan nama dan tipe yang sama.",
    );
  }

  return prisma.category.create({
    data: {
      userId,
      name: input.name,
      icon: input.icon,
      type: input.type,
    },
    select: categorySelect,
  });
};

/** Memastikan kategori milik user dan bukan kategori sistem. */
const getOwnedCategory = async (userId: string, categoryId: string) => {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, OR: [{ userId: null }, { userId }] },
  });

  if (!category) {
    throw new AppError(404, "Kategori tidak ditemukan");
  }

  if (category.isSystem) {
    throw new AppError(403, "Kategori bawaan tidak dapat diubah atau dihapus.");
  }

  return category;
};

export const updateCategory = async (
  userId: string,
  categoryId: string,
  input: UpdateCategoryInput,
) => {
  const category = await getOwnedCategory(userId, categoryId);

  if (input.name && input.name.toLowerCase() !== category.name.toLowerCase()) {
    const duplicate = await prisma.category.findFirst({
      where: {
        id: { not: categoryId },
        name: { equals: input.name, mode: "insensitive" },
        type: category.type,
        OR: [{ userId: null }, { userId }],
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new AppError(409, "Sudah ada kategori dengan nama dan tipe itu.");
    }
  }

  return prisma.category.update({
    where: { id: categoryId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.icon !== undefined && { icon: input.icon }),
    },
    select: categorySelect,
  });
};

/**
 * Menghapus kategori milik user. Transaksinya TIDAK ikut terhapus, melainkan
 * dipindah ke kategori fallback ("Lain-lain") dengan tipe yang sama.
 */
export const deleteCategory = async (userId: string, categoryId: string) => {
  const category = await getOwnedCategory(userId, categoryId);

  const fallback = await prisma.category.findFirst({
    where: { isSystem: true, isFallback: true, type: category.type },
    select: { id: true },
  });

  if (!fallback) {
    throw new AppError(
      500,
      "Kategori penampung tidak tersedia. Jalankan seed database.",
    );
  }

  const [moved] = await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { categoryId, userId },
      data: { categoryId: fallback.id },
    }),
    prisma.category.delete({ where: { id: categoryId } }),
  ]);

  return {
    message: "Kategori dihapus.",
    movedTransactions: moved.count,
    movedTo: fallback.id,
  };
};
