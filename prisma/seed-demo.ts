import { prisma } from "../src/config/database";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/password";
import { DEFAULT_ACCOUNTS } from "../src/utils/account";
import { listAccounts } from "../src/services/account.service";
import { refreshProgress } from "../src/services/goal.service";
import type { TransactionType } from "../generated/prisma/enums";

/**
 * Data demo untuk mengisi tampilan frontend: satu akun USER beserta dompetnya
 * (Tunai, Kartu Bank, Tabungan), transaksi tiga bulan terakhir, target
 * tabungan, rasio tabungan, dan bookmark.
 *
 * Idempotent dengan cara reset: setiap kali dijalankan, seluruh data milik
 * akun demo dihapus lalu dibuat ulang dengan tanggal relatif terhadap hari
 * ini. Data user lain tidak disentuh. Jalankan `bun run db:seed` lebih dulu
 * karena transaksi memakai kategori bawaan sistem.
 */

const DEMO_EMAIL = "demo@example.com";
const DEMO_USERNAME = "demo_ase";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "DemoAse123";

// Id kategori bawaan dari prisma/seed.ts.
const category = {
  makanan: "00000000-0000-4000-8000-000000000001",
  transport: "00000000-0000-4000-8000-000000000002",
  hiburan: "00000000-0000-4000-8000-000000000003",
  pendidikan: "00000000-0000-4000-8000-000000000004",
  tabungan: "00000000-0000-4000-8000-000000000005",
  kesehatan: "00000000-0000-4000-8000-000000000006",
  belanja: "00000000-0000-4000-8000-000000000007",
  uangSaku: "00000000-0000-4000-8000-000000000011",
  hadiah: "00000000-0000-4000-8000-000000000013",
  penjualan: "00000000-0000-4000-8000-000000000014",
};

// Id target tetap, supaya mudah dipakai saat mencoba API dari Scalar.
const goal = {
  laptop: "00000000-0000-4000-8000-0000000d0001",
  darurat: "00000000-0000-4000-8000-0000000d0002",
  sepatu: "00000000-0000-4000-8000-0000000d0003",
};

// Akun bawaan yang sama seperti saat register, dengan id tetap dan saldo awal.
const account = {
  tunai: "00000000-0000-4000-8000-0000000a0001",
  bank: "00000000-0000-4000-8000-0000000a0002",
  tabungan: "00000000-0000-4000-8000-0000000a0003",
};

const accountSeed: Record<string, { id: string; openingBalance: string }> = {
  Tunai: { id: account.tunai, openingBalance: "600000" },
  "Kartu Bank": { id: account.bank, openingBalance: "1000000" },
  Tabungan: { id: account.tabungan, openingBalance: "750000" },
};

// Uang saku masuk ke rekening, dan menabung serta kebutuhan bulanan dibayar
// dari rekening. Sisanya dibayar tunai.
const bankCategories = new Set([
  category.uangSaku,
  category.tabungan,
  category.belanja,
  category.pendidikan,
]);

type DemoTransaction = {
  type: TransactionType;
  amount: string;
  accountId: string;
  categoryId: string;
  goalId?: string;
  note: string;
  occurredAt: Date;
};

/** Tanggal pukul 12.00 WIB pada `day` di bulan `monthOffset` bulan lalu. */
const dateIn = (monthOffset: number, day: number) => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthOffset, day, 5),
  );
};

const meals = [
  ["25000", "Makan siang di kantin"],
  ["32000", "Ayam geprek"],
  ["18000", "Sarapan nasi uduk"],
  ["45000", "Makan bareng teman"],
  ["27000", "Mie ayam"],
  ["22000", "Kopi & roti"],
  ["38000", "Nasi padang"],
  ["30000", "Makan malam"],
  ["20000", "Jajan sore"],
] as const;

/** Transaksi satu bulan. Pola sengaja tetap supaya hasil seed bisa ditebak. */
const monthTransactions = (offset: number): DemoTransaction[] => {
  const tx = (
    type: TransactionType,
    day: number,
    amount: string,
    categoryId: string,
    note: string,
    goalId?: string,
  ): DemoTransaction => ({
    type,
    amount,
    accountId: bankCategories.has(categoryId) ? account.bank : account.tunai,
    categoryId,
    goalId,
    note,
    occurredAt: dateIn(offset, day),
  });

  const list: DemoTransaction[] = [
    tx("INCOME", 1, "1500000", category.uangSaku, "Uang saku bulanan"),
    offset === 1
      ? tx("INCOME", 20, "200000", category.hadiah, "Hadiah ulang tahun")
      : tx("INCOME", 15, "250000", category.penjualan, "Jualan stiker di kampus"),

    // Menabung = pengeluaran kategori Tabungan yang ditautkan ke target.
    tx("EXPENSE", 2, "400000", category.tabungan, "Nabung laptop", goal.laptop),
    tx("EXPENSE", 2, "200000", category.tabungan, "Dana darurat", goal.darurat),

    tx("EXPENSE", 3, "15000", category.transport, "Ojek ke kampus"),
    tx("EXPENSE", 10, "15000", category.transport, "Ojek ke kampus"),
    tx("EXPENSE", 17, "20000", category.transport, "Isi saldo e-money"),
    tx("EXPENSE", 24, "15000", category.transport, "Ojek ke kampus"),
    tx("EXPENSE", 6, "85000", category.pendidikan, "Fotokopi & buku"),
    tx("EXPENSE", 13, "60000", category.hiburan, "Nonton bioskop"),
    tx("EXPENSE", 27, "45000", category.hiburan, "Langganan streaming"),
    tx("EXPENSE", 21, "120000", category.belanja, "Kebutuhan kos"),
    ...meals.map(([amount, note], i) =>
      tx("EXPENSE", 2 + i * 3, amount, category.makanan, note),
    ),
  ];

  // Target sepatu dilunasi dua bulan lalu dan bulan lalu (status ACHIEVED).
  if (offset === 2 || offset === 1) {
    list.push(
      tx("EXPENSE", 2, "375000", category.tabungan, "Nabung sepatu lari", goal.sepatu),
    );
  }
  if (offset === 1) {
    list.push(tx("EXPENSE", 9, "70000", category.kesehatan, "Obat flu"));
  }

  return list;
};

const seedDemo = async () => {
  if (env.NODE_ENV === "production") {
    throw new Error("Seed demo tidak boleh dijalankan dengan NODE_ENV=production.");
  }

  const dbHost = new URL(env.DATABASE_URL).host;
  console.log(`Target database: ${dbHost}`);

  const systemCategories = await prisma.category.count({
    where: { id: { in: Object.values(category) }, isSystem: true },
  });
  if (systemCategories !== Object.values(category).length) {
    throw new Error("Kategori bawaan belum lengkap. Jalankan `bun run db:seed` dulu.");
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();
  const transactions = [2, 1, 0]
    .flatMap(monthTransactions)
    .filter((t) => t.occurredAt <= now);

  const publishedArticles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: { id: true },
  });

  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: DEMO_EMAIL },
      create: {
        email: DEMO_EMAIL,
        username: DEMO_USERNAME,
        passwordHash,
        dateOfBirth: new Date("2004-05-17"),
      },
      update: { passwordHash, isActive: true },
    });

    // Reset data milik akun demo saja. Transaksi dihapus sebelum akunnya.
    await tx.transaction.deleteMany({ where: { userId: user.id } });
    await tx.account.deleteMany({ where: { userId: user.id } });
    await tx.savingGoal.deleteMany({ where: { userId: user.id } });
    await tx.savingRatio.deleteMany({ where: { userId: user.id } });
    await tx.bookmark.deleteMany({ where: { userId: user.id } });

    await tx.account.createMany({
      data: DEFAULT_ACCOUNTS.map((a) => ({
        ...a,
        ...accountSeed[a.name]!,
        userId: user.id,
      })),
    });

    await tx.savingGoal.createMany({
      data: [
        {
          id: goal.laptop,
          userId: user.id,
          title: "Laptop baru untuk kuliah",
          targetAmount: "8000000",
          targetDate: dateIn(-8, 1),
          isPrimary: true,
        },
        {
          id: goal.darurat,
          userId: user.id,
          title: "Dana darurat",
          targetAmount: "2000000",
          targetDate: dateIn(-5, 1),
        },
        {
          id: goal.sepatu,
          userId: user.id,
          title: "Sepatu lari",
          targetAmount: "750000",
          targetDate: dateIn(0, 1),
        },
      ],
    });

    await tx.transaction.createMany({
      data: transactions.map((t) => ({ ...t, userId: user.id })),
    });

    await tx.savingRatio.create({
      data: {
        userId: user.id,
        needsPct: 50,
        savingsPct: 20,
        funPct: 30,
        incomeAmount: "1500000",
        period: "MONTHLY",
      },
    });

    await tx.bookmark.createMany({
      data: publishedArticles.map((a) => ({ userId: user.id, articleId: a.id })),
    });

    return user;
  });

  // currentAmount & status dihitung dengan logika yang sama seperti API.
  for (const goalId of Object.values(goal)) {
    const progress = await refreshProgress(user.id, goalId);
    console.log(
      `Target "${progress.title}": ${progress.currentAmount} / ${progress.targetAmount} (${progress.status})`,
    );
  }

  for (const item of await listAccounts(user.id, false)) {
    console.log(`Akun "${item.name}": saldo ${item.balance}`);
  }

  console.log(`Transaksi: ${transactions.length}`);
  console.log(
    publishedArticles.length > 0
      ? `Bookmark: ${publishedArticles.length}`
      : "Bookmark: dilewati, belum ada artikel PUBLISHED.",
  );
  console.log(`Akun demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log("Seed demo selesai.");
};

seedDemo()
  .catch((error) => {
    console.error("Seed demo gagal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
