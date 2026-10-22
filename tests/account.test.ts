import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ACCOUNTS,
  computeBalance,
  findInsufficientAccount,
  transferBalanceChanges,
} from "../src/utils/account";

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

const A = "akun-a";
const B = "akun-b";
const C = "akun-c";

/** Perubahan saldo dalam bentuk string supaya mudah dibandingkan. */
const changesOf = (...args: Parameters<typeof transferBalanceChanges>) =>
  Object.fromEntries(
    [...transferBalanceChanges(...args)].map(([id, value]) => [id, value.toFixed(2)]),
  );

describe("transferBalanceChanges", () => {
  test("transfer baru: asal berkurang amount + fee, tujuan bertambah amount", () => {
    expect(
      changesOf(null, { fromAccountId: A, toAccountId: B, amount: "48000", fee: "5000" }),
    ).toEqual({ [A]: "-53000.00", [B]: "48000.00" });
  });

  test("tanpa fee", () => {
    expect(changesOf(null, { fromAccountId: A, toAccountId: B, amount: "1000" })).toEqual({
      [A]: "-1000.00",
      [B]: "1000.00",
    });
  });

  test("ubah amount: hanya selisihnya yang dihitung", () => {
    const before = { fromAccountId: A, toAccountId: B, amount: "50000" };
    expect(changesOf(before, { ...before, amount: "999999" })).toEqual({
      [A]: "-949999.00",
      [B]: "949999.00",
    });
  });

  test("ubah fee saja", () => {
    const before = { fromAccountId: A, toAccountId: B, amount: "50000", fee: "2500" };
    expect(changesOf(before, { ...before, fee: "0" })).toEqual({
      [A]: "2500.00",
      [B]: "0.00",
    });
  });

  test("ganti akun asal: akun lama dikembalikan, akun baru dibebani", () => {
    const before = { fromAccountId: A, toAccountId: B, amount: "50000", fee: "2500" };
    expect(changesOf(before, { ...before, fromAccountId: C })).toEqual({
      [A]: "52500.00",
      [B]: "0.00",
      [C]: "-52500.00",
    });
  });

  test("ganti akun tujuan: tujuan lama kehilangan amount", () => {
    const before = { fromAccountId: A, toAccountId: B, amount: "50000" };
    expect(changesOf(before, { ...before, toAccountId: C })).toEqual({
      [A]: "0.00",
      [B]: "-50000.00",
      [C]: "50000.00",
    });
  });

  test("tukar asal dan tujuan", () => {
    const before = { fromAccountId: A, toAccountId: B, amount: "50000" };
    expect(changesOf(before, { fromAccountId: B, toAccountId: A, amount: "50000" })).toEqual(
      { [A]: "100000.00", [B]: "-100000.00" },
    );
  });
});

describe("findInsufficientAccount", () => {
  const check = (
    balances: Record<string, string>,
    ...args: Parameters<typeof transferBalanceChanges>
  ) => findInsufficientAccount(new Map(Object.entries(balances)), transferBalanceChanges(...args));

  test("BUG-TRF-1: transfer 999999 dari saldo 1000 ditolak", () => {
    expect(
      check({ [A]: "1000.00", [B]: "0.00" }, null, {
        fromAccountId: A,
        toAccountId: B,
        amount: "999999",
      }),
    ).toEqual({ accountId: A, available: "1000.00", missing: "998999.00" });
  });

  test("BUG-TRF-2: amount + fee melebihi saldo ditolak", () => {
    expect(
      check({ [A]: "50000.00", [B]: "0.00" }, null, {
        fromAccountId: A,
        toAccountId: B,
        amount: "48000",
        fee: "5000",
      }),
    ).toEqual({ accountId: A, available: "50000.00", missing: "3000.00" });
  });

  test("BUG-TRF-3: menaikkan amount melebihi saldo ditolak", () => {
    // Saldo awal 100000, sudah transfer 50000, sisa 50000.
    const before = { fromAccountId: A, toAccountId: B, amount: "50000" };
    expect(
      check({ [A]: "50000.00", [B]: "50000.00" }, before, { ...before, amount: "999999" }),
    ).toEqual({ accountId: A, available: "50000.00", missing: "899999.00" });
  });

  test("menaikkan amount masih dalam saldo diterima", () => {
    // Sisa 50000 + 50000 yang dikembalikan cukup untuk 100000.
    const before = { fromAccountId: A, toAccountId: B, amount: "50000" };
    expect(
      check({ [A]: "50000.00", [B]: "50000.00" }, before, { ...before, amount: "100000" }),
    ).toBeUndefined();
  });

  test("transfer persis sebesar saldo diterima", () => {
    expect(
      check({ [A]: "53000.00", [B]: "0.00" }, null, {
        fromAccountId: A,
        toAccountId: B,
        amount: "48000",
        fee: "5000",
      }),
    ).toBeUndefined();
  });

  test("tujuan lama yang uangnya sudah terpakai tidak bisa dilepas", () => {
    const before = { fromAccountId: A, toAccountId: B, amount: "50000" };
    expect(
      check({ [A]: "0.00", [B]: "10000.00", [C]: "0.00" }, before, {
        ...before,
        toAccountId: C,
      }),
    ).toEqual({ accountId: B, available: "10000.00", missing: "40000.00" });
  });

  test("edit yang tidak mengurangi saldo lolos walau akun sudah negatif", () => {
    const before = { fromAccountId: A, toAccountId: B, amount: "50000" };
    expect(check({ [A]: "-20000.00", [B]: "50000.00" }, before, before)).toBeUndefined();
    expect(
      check({ [A]: "-20000.00", [B]: "50000.00" }, before, { ...before, amount: "40000" }),
    ).toBeUndefined();
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
