import { describe, expect, test } from "bun:test";
import { DEFAULT_ACCOUNTS, computeBalance } from "../src/utils/account";

describe("computeBalance", () => {
  test("saldo awal + pemasukan - pengeluaran", () => {
    expect(
      computeBalance({ openingBalance: "500000", income: "1500000", expense: "250000" }),
    ).toBe("1750000.00");
  });

  test("akun baru tanpa transaksi = saldo awal", () => {
    expect(computeBalance({ openingBalance: "750000", income: 0, expense: 0 })).toBe(
      "750000.00",
    );
  });

  test("boleh negatif kalau pengeluaran melebihi saldo", () => {
    expect(computeBalance({ openingBalance: "0", income: "0", expense: "15000" })).toBe(
      "-15000.00",
    );
  });

  test("transfer masuk menambah, transfer keluar mengurangi", () => {
    expect(
      computeBalance({
        openingBalance: "100000",
        income: "0",
        expense: "2500", // biaya admin dicatat sebagai pengeluaran
        transferIn: "50000",
        transferOut: "300000",
      }),
    ).toBe("-152500.00");
  });

  test("transfer antar akun tidak mengubah total saldo, hanya biayanya", () => {
    const before = { tunai: "100000", bank: "1000000" };
    const tunai = computeBalance({
      openingBalance: before.tunai,
      income: 0,
      expense: 0,
      transferIn: "300000",
    });
    const bank = computeBalance({
      openingBalance: before.bank,
      income: 0,
      expense: "2500",
      transferOut: "300000",
    });

    expect(Number(tunai) + Number(bank)).toBe(1_100_000 - 2500);
  });

  test("tidak ada galat pembulatan pecahan", () => {
    // Dengan Number: 0.1 + 0.2 = 0.30000000000000004
    expect(computeBalance({ openingBalance: "0.10", income: "0.20", expense: "0" })).toBe(
      "0.30",
    );
  });
});

describe("DEFAULT_ACCOUNTS", () => {
  test("tepat satu akun default", () => {
    expect(DEFAULT_ACCOUNTS.filter((a) => a.isDefault)).toHaveLength(1);
  });

  test("Tunai, Kartu Bank, Tabungan seperti di frontend", () => {
    expect(DEFAULT_ACCOUNTS.map((a) => a.name)).toEqual([
      "Tunai",
      "Kartu Bank",
      "Tabungan",
    ]);
  });

  test("nama unik", () => {
    const names = DEFAULT_ACCOUNTS.map((a) => a.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
