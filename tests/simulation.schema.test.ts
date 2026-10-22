import { describe, expect, test } from "bun:test";
import {
  instrumentCodeParamSchema,
  instrumentHistorySchema,
  listInstrumentQuerySchema,
  listSessionQuerySchema,
  purchaseSchema,
} from "../src/schemas/simulation.schema";

const wrap = (parts: { body?: unknown; params?: unknown; query?: unknown }) => ({
  body: parts.body,
  params: parts.params ?? {},
  query: parts.query ?? {},
});

describe("purchaseSchema", () => {
  const parse = (body: unknown) => purchaseSchema.safeParse(wrap({ body }));

  test("menerima kode dan nominal", () => {
    const result = parse({ instrumentCode: "nusa", amount: 500000 });
    expect(result.success).toBe(true);
    // Kode dinormalkan ke huruf besar, nominal ke string.
    expect(result.data?.body).toEqual({ instrumentCode: "NUSA", amount: "500000" });
  });

  test.each([
    ["nol", 0],
    ["negatif", "-1000"],
    ["tiga desimal", "1000.555"],
    ["bukan angka", "seratus ribu"],
  ])("nominal %s ditolak", (_label, amount) => {
    expect(parse({ instrumentCode: "NUSA", amount }).success).toBe(false);
  });

  test("kode instrumen wajib", () => {
    expect(parse({ amount: "100000" }).success).toBe(false);
    expect(parse({ instrumentCode: "  ", amount: "100000" }).success).toBe(false);
  });
});

describe("instrumentHistorySchema", () => {
  const parse = (query: unknown) =>
    instrumentHistorySchema.safeParse(wrap({ params: { code: "NUSA" }, query }));

  test("range default MONTH", () => {
    expect(parse({}).data?.query.range).toBe("MONTH");
  });

  test("range di luar enum ditolak", () => {
    expect(parse({ range: "DAY" }).success).toBe(false);
  });
});

describe("listInstrumentQuerySchema", () => {
  test("tipe di luar enum ditolak", () => {
    expect(
      listInstrumentQuerySchema.safeParse(wrap({ query: { type: "CRYPTO" } }))
        .success,
    ).toBe(false);
  });

  test("tipe opsional", () => {
    expect(listInstrumentQuerySchema.safeParse(wrap({})).success).toBe(true);
  });
});

describe("instrumentCodeParamSchema", () => {
  test("kode dinormalkan ke huruf besar", () => {
    expect(
      instrumentCodeParamSchema.safeParse(wrap({ params: { code: " rdpu " } }))
        .data?.params.code,
    ).toBe("RDPU");
  });
});

describe("listSessionQuerySchema", () => {
  test("status di luar enum ditolak", () => {
    expect(
      listSessionQuerySchema.safeParse(wrap({ query: { status: "PAUSED" } }))
        .success,
    ).toBe(false);
  });

  test("pagination default", () => {
    expect(listSessionQuerySchema.safeParse(wrap({})).data?.query).toEqual({
      page: 1,
      limit: 20,
    });
  });
});
