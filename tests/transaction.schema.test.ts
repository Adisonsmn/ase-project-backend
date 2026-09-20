import { describe, expect, test } from "bun:test";
import {
  createTransactionSchema,
  listTransactionQuerySchema,
  summaryQuerySchema,
  updateTransactionSchema,
} from "../src/schemas/transaction.schema";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../src/schemas/category.schema";

const wrap = (parts: { body?: unknown; params?: unknown; query?: unknown }) => ({
  body: parts.body ?? {},
  params: parts.params ?? {},
  query: parts.query ?? {},
});

const validTransaction = {
  type: "EXPENSE",
  amount: "15000",
  occurredAt: "2026-09-18",
};

describe("createTransactionSchema — nominal", () => {
  test("menerima string maupun number", () => {
    expect(
      createTransactionSchema.safeParse(wrap({ body: validTransaction })).success,
    ).toBe(true);

    expect(
      createTransactionSchema.safeParse(
        wrap({ body: { ...validTransaction, amount: 15000 } }),
      ).success,
    ).toBe(true);
  });

  test("dinormalkan menjadi string", () => {
    const result = createTransactionSchema.safeParse(
      wrap({ body: { ...validTransaction, amount: 15000.5 } }),
    );

    expect(result.success).toBe(true);
    if (result.success) expect(typeof result.data.body.amount).toBe("string");
  });

  test.each([
    ["negatif", "-5000"],
    ["nol", "0"],
    ["tiga desimal", "5000.555"],
    ["bukan angka", "limaribu"],
    ["kosong", ""],
  ])("menolak nominal %s", (_label, amount) => {
    const result = createTransactionSchema.safeParse(
      wrap({ body: { ...validTransaction, amount } }),
    );
    expect(result.success).toBe(false);
  });

  test("menolak nominal melebihi Decimal(14,2)", () => {
    const result = createTransactionSchema.safeParse(
      wrap({ body: { ...validTransaction, amount: "1000000000000" } }),
    );
    expect(result.success).toBe(false);
  });
});

describe("createTransactionSchema — tanggal", () => {
  test("menerima format YYYY-MM-DD", () => {
    expect(
      createTransactionSchema.safeParse(wrap({ body: validTransaction })).success,
    ).toBe(true);
  });

  test("menerima ISO datetime beroffset", () => {
    const result = createTransactionSchema.safeParse(
      wrap({
        body: { ...validTransaction, occurredAt: "2026-09-18T23:30:00+07:00" },
      }),
    );
    expect(result.success).toBe(true);
  });

  test("menolak tanggal masa depan", () => {
    const result = createTransactionSchema.safeParse(
      wrap({ body: { ...validTransaction, occurredAt: "2099-01-01" } }),
    );
    expect(result.success).toBe(false);
  });

  test("menerima hari ini walau UTC masih di tanggal kemarin", () => {
    // Batas atas memakai akhir hari WIB, bukan Date.now() mentah.
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const result = createTransactionSchema.safeParse(
      wrap({ body: { ...validTransaction, occurredAt: today } }),
    );
    expect(result.success).toBe(true);
  });
});

describe("updateTransactionSchema", () => {
  const params = { id: "8f1f2b94-6f0d-4f6c-9b3e-2f1c9d0a1b23" };

  test("menolak body kosong", () => {
    expect(
      updateTransactionSchema.safeParse(wrap({ params, body: {} })).success,
    ).toBe(false);
  });

  test("menerima satu field", () => {
    expect(
      updateTransactionSchema.safeParse(wrap({ params, body: { amount: "1000" } }))
        .success,
    ).toBe(true);
  });

  test("menolak id bukan UUID", () => {
    const result = updateTransactionSchema.safeParse(
      wrap({ params: { id: "bukan-uuid" }, body: { amount: "1000" } }),
    );
    expect(result.success).toBe(false);
  });
});

describe("listTransactionQuerySchema", () => {
  test("memakai default page dan limit", () => {
    const result = listTransactionQuerySchema.safeParse(wrap({ query: {} }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
    }
  });

  test("menolak limit di atas 100", () => {
    expect(
      listTransactionQuerySchema.safeParse(wrap({ query: { limit: "500" } }))
        .success,
    ).toBe(false);
  });

  test("menolak page nol", () => {
    expect(
      listTransactionQuerySchema.safeParse(wrap({ query: { page: "0" } })).success,
    ).toBe(false);
  });

  test("menolak from lebih besar dari to", () => {
    const result = listTransactionQuerySchema.safeParse(
      wrap({ query: { from: "2026-09-30", to: "2026-09-01" } }),
    );
    expect(result.success).toBe(false);
  });

  test("menerima from sama dengan to", () => {
    const result = listTransactionQuerySchema.safeParse(
      wrap({ query: { from: "2026-09-19", to: "2026-09-19" } }),
    );
    expect(result.success).toBe(true);
  });
});

describe("summaryQuerySchema", () => {
  test("default period monthly", () => {
    const result = summaryQuerySchema.safeParse(wrap({ query: {} }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.query.period).toBe("monthly");
  });

  test("menolak period tidak dikenal", () => {
    expect(
      summaryQuerySchema.safeParse(wrap({ query: { period: "yearly" } })).success,
    ).toBe(false);
  });
});

describe("category schema", () => {
  test("menolak nama terlalu pendek", () => {
    expect(
      createCategorySchema.safeParse(wrap({ body: { name: "A", type: "EXPENSE" } }))
        .success,
    ).toBe(false);
  });

  test("menolak tipe tidak dikenal", () => {
    expect(
      createCategorySchema.safeParse(
        wrap({ body: { name: "Jajan", type: "SAVING" } }),
      ).success,
    ).toBe(false);
  });

  test("memangkas spasi di nama", () => {
    const result = createCategorySchema.safeParse(
      wrap({ body: { name: "  Jajan Kantin  ", type: "EXPENSE" } }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body.name).toBe("Jajan Kantin");
  });

  test("update menolak body kosong", () => {
    const result = updateCategorySchema.safeParse(
      wrap({ params: { id: "8f1f2b94-6f0d-4f6c-9b3e-2f1c9d0a1b23" }, body: {} }),
    );
    expect(result.success).toBe(false);
  });
});
