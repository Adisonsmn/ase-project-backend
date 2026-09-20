import { describe, expect, test } from "bun:test";
import {
  endOfLocalDay,
  startOfLocalDay,
  startOfLocalMonth,
  startOfLocalWeek,
  toLocalDateString,
} from "../src/utils/datetime";

describe("toLocalDateString", () => {
  test("23:30 WIB tetap dihitung sebagai hari yang sama", () => {
    // 2026-09-18 23:30 WIB = 2026-09-18 16:30 UTC
    expect(toLocalDateString(new Date("2026-09-18T16:30:00Z"))).toBe(
      "2026-09-18",
    );
  });

  test("00:30 WIB sudah masuk hari berikutnya", () => {
    // 2026-09-19 00:30 WIB = 2026-09-18 17:30 UTC
    expect(toLocalDateString(new Date("2026-09-18T17:30:00Z"))).toBe(
      "2026-09-19",
    );
  });

  test("tengah malam UTC masih hari yang sama di WIB", () => {
    expect(toLocalDateString(new Date("2026-09-20T00:00:00Z"))).toBe(
      "2026-09-20",
    );
  });
});

describe("startOfLocalDay / endOfLocalDay", () => {
  test("awal hari lokal adalah 17:00 UTC hari sebelumnya", () => {
    const start = startOfLocalDay(new Date("2026-09-20T10:00:00Z"));
    expect(start.toISOString()).toBe("2026-09-19T17:00:00.000Z");
  });

  test("akhir hari lokal tepat sebelum awal hari berikutnya", () => {
    const start = startOfLocalDay(new Date("2026-09-20T10:00:00Z"));
    const end = endOfLocalDay(new Date("2026-09-20T10:00:00Z"));

    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
    expect(toLocalDateString(end)).toBe("2026-09-20");
  });

  test("rentang satu hari mencakup transaksi 23:59 WIB", () => {
    const start = startOfLocalDay(new Date("2026-09-18T12:00:00Z"));
    const end = endOfLocalDay(new Date("2026-09-18T12:00:00Z"));
    const tx = new Date("2026-09-18T16:59:00Z"); // 23:59 WIB tanggal 18

    expect(tx >= start && tx <= end).toBe(true);
  });
});

describe("startOfLocalWeek", () => {
  test("minggu dimulai hari Senin", () => {
    // 2026-09-20 adalah hari Minggu
    const start = startOfLocalWeek(new Date("2026-09-20T05:00:00Z"));
    expect(toLocalDateString(start)).toBe("2026-09-14"); // Senin
  });

  test("hari Senin memetakan ke dirinya sendiri", () => {
    const start = startOfLocalWeek(new Date("2026-09-14T05:00:00Z"));
    expect(toLocalDateString(start)).toBe("2026-09-14");
  });
});

describe("startOfLocalMonth", () => {
  test("mengembalikan tanggal 1 waktu lokal", () => {
    const start = startOfLocalMonth(new Date("2026-09-20T05:00:00Z"));
    expect(toLocalDateString(start)).toBe("2026-09-01");
  });
});
