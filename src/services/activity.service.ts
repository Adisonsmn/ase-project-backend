import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../config/database";
import type { ListActivityQuery } from "../schemas/activity.schema";
import { buildMeta } from "../schemas/common.schema";
import { endOfLocalDay, startOfLocalDay } from "../utils/datetime";
import {
  transactionSelect,
  toResponse as toTransactionResponse,
  type RawTransaction,
} from "./transaction.service";
import { toTransferResponse, transferSelect } from "./transfer.service";

type FeedRow = { kind: "TRANSACTION" | "TRANSFER"; id: string };

/** Item diratakan dengan pembeda `kind`, supaya mudah di-switch di frontend. */
type ActivityItem =
  | ({ kind: "TRANSACTION" } & ReturnType<typeof toTransactionResponse>)
  | ({ kind: "TRANSFER" } & ReturnType<typeof toTransferResponse>);

/**
 * Riwayat gabungan transaksi dan transfer untuk timeline beranda, berurutan
 * dan berpaginasi bersama.
 *
 * Dua langkah: (1) satu query UNION ALL yang hanya mengambil id per halaman,
 * diurutkan di database; (2) detailnya diambil lewat Prisma dengan select
 * yang sama seperti endpoint transaksi/transfer, jadi bentuk itemnya identik.
 * Biaya admin tidak muncul sebagai item sendiri karena sudah menjadi bagian
 * dari item transfer.
 */
export const listActivities = async (
  userId: string,
  query: ListActivityQuery,
) => {
  const { page, limit, from, to, accountId } = query;

  const transactionWhere = [
    Prisma.sql`t."userId" = ${userId}`,
    Prisma.sql`t."transferId" IS NULL`,
  ];
  const transferWhere = [Prisma.sql`r."userId" = ${userId}`];

  if (from) {
    const gte = startOfLocalDay(new Date(from));
    transactionWhere.push(Prisma.sql`t."occurredAt" >= ${gte}`);
    transferWhere.push(Prisma.sql`r."occurredAt" >= ${gte}`);
  }
  if (to) {
    const lte = endOfLocalDay(new Date(to));
    transactionWhere.push(Prisma.sql`t."occurredAt" <= ${lte}`);
    transferWhere.push(Prisma.sql`r."occurredAt" <= ${lte}`);
  }
  if (accountId) {
    transactionWhere.push(Prisma.sql`t."accountId" = ${accountId}`);
    transferWhere.push(
      Prisma.sql`(r."fromAccountId" = ${accountId} OR r."toAccountId" = ${accountId})`,
    );
  }

  const feed = Prisma.sql`
    SELECT 'TRANSACTION' AS kind, t."id", t."occurredAt", t."createdAt"
    FROM "Transaction" t
    WHERE ${Prisma.join(transactionWhere, " AND ")}
    UNION ALL
    SELECT 'TRANSFER' AS kind, r."id", r."occurredAt", r."createdAt"
    FROM "Transfer" r
    WHERE ${Prisma.join(transferWhere, " AND ")}
  `;

  // Urutan sama dengan GET /transactions, ditambah id supaya stabil antar
  // halaman saat waktunya kembar.
  const [rows, [count]] = await Promise.all([
    prisma.$queryRaw<FeedRow[]>`
      SELECT kind, id FROM (${feed}) AS feed
      ORDER BY "occurredAt" DESC, "createdAt" DESC, id DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS total FROM (${feed}) AS feed
    `,
  ]);

  const idsOf = (kind: FeedRow["kind"]) =>
    rows.filter((row) => row.kind === kind).map((row) => row.id);

  const [transactions, transfers] = await Promise.all([
    prisma.transaction.findMany({
      where: { id: { in: idsOf("TRANSACTION") } },
      select: transactionSelect,
    }),
    prisma.transfer.findMany({
      where: { id: { in: idsOf("TRANSFER") } },
      select: transferSelect,
    }),
  ]);

  const transactionById = new Map(transactions.map((t) => [t.id, t]));
  const transferById = new Map(transfers.map((t) => [t.id, t]));

  // Baris yang terhapus di antara kedua langkah dilewati saja.
  const data = rows.flatMap<ActivityItem>((row) => {
    if (row.kind === "TRANSACTION") {
      const transaction = transactionById.get(row.id);
      return transaction
        ? [{ kind: "TRANSACTION", ...toTransactionResponse(transaction as RawTransaction) }]
        : [];
    }

    const transfer = transferById.get(row.id);
    return transfer ? [{ kind: "TRANSFER", ...toTransferResponse(transfer) }] : [];
  });

  return {
    data,
    meta: buildMeta(page, limit, Number(count?.total ?? 0)),
  };
};
