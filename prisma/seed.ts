import { prisma } from "../src/config/database";
import type { TransactionType } from "../generated/prisma/enums";

/**
 * Kategori bawaan sistem (userId = null), dipakai bersama semua user.
 *
 * Id-nya sengaja ditetapkan manual, bukan di-generate, supaya seed ini
 * idempotent: dijalankan berapa kali pun tidak menghasilkan duplikat.
 * Constraint @@unique([userId, name, type]) tidak menjangkau baris ini karena
 * di Postgres nilai NULL selalu dianggap berbeda satu sama lain.
 */
type SeedCategory = {
  id: string;
  name: string;
  icon: string;
  type: TransactionType;
  isFallback?: boolean;
};

const systemCategories: SeedCategory[] = [
  // Pengeluaran
  { id: "00000000-0000-4000-8000-000000000001", name: "Makanan & Minuman", icon: "utensils", type: "EXPENSE" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Transport", icon: "bus", type: "EXPENSE" },
  { id: "00000000-0000-4000-8000-000000000003", name: "Hiburan", icon: "gamepad", type: "EXPENSE" },
  { id: "00000000-0000-4000-8000-000000000004", name: "Pendidikan", icon: "book", type: "EXPENSE" },
  { id: "00000000-0000-4000-8000-000000000005", name: "Tabungan", icon: "piggy-bank", type: "EXPENSE" },
  { id: "00000000-0000-4000-8000-000000000006", name: "Kesehatan", icon: "heart-pulse", type: "EXPENSE" },
  { id: "00000000-0000-4000-8000-000000000007", name: "Belanja", icon: "shopping-bag", type: "EXPENSE" },
  { id: "00000000-0000-4000-8000-00000000000f", name: "Lain-lain", icon: "ellipsis", type: "EXPENSE", isFallback: true },

  // Pemasukan
  { id: "00000000-0000-4000-8000-000000000011", name: "Uang Saku", icon: "wallet", type: "INCOME" },
  { id: "00000000-0000-4000-8000-000000000012", name: "Gaji", icon: "briefcase", type: "INCOME" },
  { id: "00000000-0000-4000-8000-000000000013", name: "Hadiah", icon: "gift", type: "INCOME" },
  { id: "00000000-0000-4000-8000-000000000014", name: "Penjualan", icon: "tag", type: "INCOME" },
  { id: "00000000-0000-4000-8000-00000000001f", name: "Lain-lain", icon: "ellipsis", type: "INCOME", isFallback: true },
];

const seed = async () => {
  for (const category of systemCategories) {
    const data = {
      userId: null,
      name: category.name,
      icon: category.icon,
      type: category.type,
      isSystem: true,
      isFallback: category.isFallback ?? false,
    };

    await prisma.category.upsert({
      where: { id: category.id },
      create: { id: category.id, ...data },
      update: data,
    });
  }

  const total = await prisma.category.count({ where: { isSystem: true } });
  console.log(`Seed selesai. Kategori sistem: ${total}`);
};

seed()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
