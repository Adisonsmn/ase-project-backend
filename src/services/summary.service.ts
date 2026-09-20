import { Prisma } from "../../generated/prisma/client";
import type { TransactionType } from "../../generated/prisma/enums";
import { prisma } from "../config/database";
import type { SummaryQuery } from "../schemas/transaction.schema";
import {
  APP_TIME_ZONE,
  endOfLocalDay,
  endOfToday,
  startOfLocalDay,
  startOfLocalMonth,
  startOfLocalWeek,
  toLocalDateString,
} from "../utils/datetime";
import { formatMoney, percentageOf, subtractMoney } from "../utils/money";

/**
 * Unit date_trunc per periode. Dipetakan lewat konstanta, bukan diambil
 * langsung dari input user, supaya tidak ada nilai sembarang yang masuk ke SQL.
 */
const TRUNC_UNIT = {
  daily: "day",
  weekly: "week",
  monthly: "month",
} as const;

/** Rentang default per periode, dipilih agar grafiknya punya cukup titik. */
const defaultRange = (period: SummaryQuery["period"]) => {
  const to = endOfToday();
  const now = new Date();

  if (period === "daily") {
    const from = startOfLocalDay(now);
    from.setUTCDate(from.getUTCDate() - 29); // 30 hari terakhir
    return { from, to };
  }

  if (period === "weekly") {
    const from = startOfLocalWeek(now);
    from.setUTCDate(from.getUTCDate() - 7 * 11); // 12 minggu terakhir
    return { from, to };
  }

  const from = startOfLocalMonth(now);
  from.setUTCMonth(from.getUTCMonth() - 11); // 12 bulan terakhir
  return { from, to };
};

type SeriesRow = { bucket: Date; type: TransactionType; total: string };

export const getSummary = async (userId: string, query: SummaryQuery) => {
  const fallback = defaultRange(query.period);

  const from = query.from ? startOfLocalDay(new Date(query.from)) : fallback.from;
  const to = query.to ? endOfLocalDay(new Date(query.to)) : fallback.to;

  const where = { userId, occurredAt: { gte: from, lte: to } };

  // 1. Total per tipe — diagregasi di database, bukan ditarik lalu dijumlah di JS.
  const totalsRaw = await prisma.transaction.groupBy({
    by: ["type"],
    where,
    _sum: { amount: true },
  });

  const income = formatMoney(
    totalsRaw.find((row) => row.type === "INCOME")?._sum.amount ?? null,
  );
  const expense = formatMoney(
    totalsRaw.find((row) => row.type === "EXPENSE")?._sum.amount ?? null,
  );

  // 2. Breakdown per kategori, untuk pie chart.
  const byCategoryRaw = await prisma.transaction.groupBy({
    by: ["categoryId", "type"],
    where,
    _sum: { amount: true },
  });

  const categoryIds = byCategoryRaw
    .map((row) => row.categoryId)
    .filter((id): id is string => id !== null);

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, icon: true },
  });

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const byCategory = byCategoryRaw
    .map((row) => {
      const total = formatMoney(row._sum.amount);
      const category = row.categoryId
        ? categoryById.get(row.categoryId)
        : undefined;

      return {
        categoryId: row.categoryId,
        name: category?.name ?? "Tanpa kategori",
        icon: category?.icon ?? null,
        type: row.type,
        total,
        // Persentase dihitung terhadap total tipenya sendiri, bukan terhadap
        // seluruh transaksi, supaya pie chart pemasukan dan pengeluaran
        // masing-masing berjumlah 100%.
        percentage: percentageOf(total, row.type === "INCOME" ? income : expense),
      };
    })
    .sort((a, b) => Number(b.total) - Number(a.total));

  // 3. Deret waktu. Perlu raw SQL karena Prisma groupBy tidak bisa melakukan
  //    date_trunc. Kolom occurredAt bertipe TIMESTAMP tanpa zona waktu dan
  //    menyimpan UTC, jadi harus ditafsirkan sebagai UTC dulu sebelum
  //    dikonversi ke waktu lokal.
  const seriesRaw = await prisma.$queryRaw<SeriesRow[]>(Prisma.sql`
    SELECT
      date_trunc(
        ${TRUNC_UNIT[query.period]},
        ("occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${APP_TIME_ZONE}
      ) AS bucket,
      "type",
      SUM("amount")::text AS total
    FROM "Transaction"
    WHERE "userId" = ${userId}
      AND "occurredAt" >= ${from}
      AND "occurredAt" <= ${to}
    GROUP BY 1, 2
    ORDER BY 1 ASC
  `);

  const seriesMap = new Map<string, { income: string; expense: string }>();

  for (const row of seriesRaw) {
    // bucket sudah berupa waktu dinding lokal, jadi diambil tanggalnya apa adanya.
    const key = new Date(row.bucket).toISOString().slice(0, 10);
    const entry = seriesMap.get(key) ?? { income: "0.00", expense: "0.00" };

    if (row.type === "INCOME") entry.income = formatMoney(row.total);
    else entry.expense = formatMoney(row.total);

    seriesMap.set(key, entry);
  }

  const series = [...seriesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, value]) => ({
      bucket,
      income: value.income,
      expense: value.expense,
      net: subtractMoney(value.income, value.expense),
    }));

  return {
    range: {
      from: toLocalDateString(from),
      to: toLocalDateString(to),
      period: query.period,
      timeZone: APP_TIME_ZONE,
    },
    totals: {
      income,
      expense,
      net: subtractMoney(income, expense),
    },
    byCategory,
    series,
  };
};
