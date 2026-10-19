import { describe, expect, test } from "bun:test";
import { listActivityQuerySchema } from "../src/schemas/activity.schema";

const parse = (query: Record<string, string>) =>
  listActivityQuerySchema.safeParse({ body: undefined, params: {}, query });

describe("listActivityQuerySchema", () => {
  test("memakai default page dan limit", () => {
    const result = parse({});
    expect(result.success && result.data.query).toEqual({ page: 1, limit: 20 });
  });

  test("menerima rentang tanggal dan filter akun", () => {
    expect(
      parse({
        from: "2026-10-01",
        to: "2026-10-31",
        accountId: "00000000-0000-4000-8000-0000000a0001",
      }).success,
    ).toBe(true);
  });

  test("menolak limit di atas 100", () => {
    expect(parse({ limit: "101" }).success).toBe(false);
  });

  test("menolak from lebih besar dari to", () => {
    expect(parse({ from: "2026-10-31", to: "2026-10-01" }).success).toBe(false);
  });

  test("menolak accountId bukan UUID", () => {
    expect(parse({ accountId: "tunai" }).success).toBe(false);
  });
});
