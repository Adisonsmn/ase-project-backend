import { Prisma } from "../../generated/prisma/client";
import type { IncomePeriod } from "../../generated/prisma/enums";

/**
 * Logika kalkulasi rasio menabung (F-01..F-03).
 *
 * Fungsi di berkas ini sengaja murni — tanpa database, tanpa Express — supaya
 * aritmetikanya bisa diuji langsung. Di sinilah bagian yang paling mudah salah:
 * pembulatan alokasi.
 */

export type RatioSplit = {
  needsPct: number;
  savingsPct: number;
  funPct: number;
};

export type RatioPreset = RatioSplit & {
  id: string;
  name: string;
  description: string;
};

export const RATIO_PRESETS: RatioPreset[] = [
  {
    id: "60-30-10",
    name: "60 : 30 : 10",
    description:
      "Rasio seimbang untuk pemula. Sebagian besar untuk kebutuhan, sepertiga ditabung.",
    needsPct: 60,
    savingsPct: 30,
    funPct: 10,
  },
  {
    id: "50-30-20",
    name: "50 : 30 : 20",
    description:
      "Porsi hiburan lebih longgar. Cocok kalau kebutuhan hariannya tidak besar.",
    needsPct: 50,
    savingsPct: 30,
    funPct: 20,
  },
  {
    id: "70-20-10",
    name: "70 : 20 : 10",
    description:
      "Untuk yang kebutuhannya besar, misalnya ongkos harian jauh. Tabungan tetap ada.",
    needsPct: 70,
    savingsPct: 20,
    funPct: 10,
  },
];

export const DEFAULT_RATIO: RatioSplit = {
  needsPct: 60,
  savingsPct: 30,
  funPct: 10,
};

/**
 * Faktor pengali ke nominal bulanan.
 *
 * Mingguan memakai 4,345 (= 365 / 7 / 12), bukan 4, supaya setahun tetap
 * berjumlah 52 minggu. Memakai 4 akan kehilangan sekitar satu bulan pemasukan
 * per tahun dan membuat analisis gap di F-04 meleset.
 */
export const MONTHLY_FACTOR: Record<IncomePeriod, number> = {
  DAILY: 30,
  WEEKLY: 365 / 7 / 12,
  MONTHLY: 1,
};

export const PERIOD_LABEL: Record<IncomePeriod, string> = {
  DAILY: "harian",
  WEEKLY: "mingguan",
  MONTHLY: "bulanan",
};

export const isRatioValid = (split: RatioSplit): boolean =>
  split.needsPct + split.savingsPct + split.funPct === 100;

export type Allocation = {
  needs: string;
  savings: string;
  fun: string;
};

/**
 * Membagi nominal menurut rasio.
 *
 * Tiap bagian dibulatkan ke bawah ke rupiah penuh, lalu seluruh sisa pembulatan
 * diberikan ke kebutuhan. Dengan begitu penjumlahan ketiganya SELALU sama persis
 * dengan nominal masukan — tanpa ini, 33:33:34 atas Rp 100.000 bisa menghasilkan
 * total Rp 99.999 dan langsung terlihat salah oleh user.
 */
export const allocate = (
  amount: string | number | Prisma.Decimal,
  split: RatioSplit,
): Allocation => {
  const total = new Prisma.Decimal(amount);

  const portion = (percentage: number) =>
    total.times(percentage).dividedBy(100).floor();

  const savings = portion(split.savingsPct);
  const fun = portion(split.funPct);

  // Kebutuhan dihitung sebagai sisa, bukan dibulatkan sendiri.
  const needs = total.minus(savings).minus(fun);

  return {
    needs: needs.toFixed(2),
    savings: savings.toFixed(2),
    fun: fun.toFixed(2),
  };
};

/** Nominal per periode diubah ke setara bulanan. */
export const toMonthlyAmount = (
  amount: string | number | Prisma.Decimal,
  period: IncomePeriod,
): string =>
  new Prisma.Decimal(amount)
    .times(MONTHLY_FACTOR[period])
    .toDecimalPlaces(2)
    .toFixed(2);

export type Tip = {
  level: "info" | "warning" | "success";
  message: string;
};

/**
 * Tips kontekstual berdasarkan rasio dan besar pemasukan.
 * Urutannya disusun dari yang paling perlu diperhatikan.
 */
export const buildTips = (
  split: RatioSplit,
  monthlyIncome: string,
): Tip[] => {
  const tips: Tip[] = [];
  const income = new Prisma.Decimal(monthlyIncome);

  if (split.savingsPct === 0) {
    tips.push({
      level: "warning",
      message:
        "Belum ada porsi untuk tabungan. Mulai dari 5% pun sudah jauh lebih baik daripada nol.",
    });
  } else if (split.savingsPct < 10) {
    tips.push({
      level: "warning",
      message: `Porsi tabunganmu baru ${split.savingsPct}%. Coba naikkan ke 10% dulu selama sebulan, lihat apakah terasa berat.`,
    });
  } else if (split.savingsPct >= 30) {
    tips.push({
      level: "success",
      message: `Porsi tabungan ${split.savingsPct}% sudah bagus. Pertahankan, dan pastikan porsi kebutuhan tetap cukup supaya tidak jebol di tengah bulan.`,
    });
  }

  if (split.funPct > 30) {
    tips.push({
      level: "warning",
      message: `Porsi hiburan ${split.funPct}% cukup besar. Menurunkannya ke 20% bisa menambah tabungan tanpa terasa terlalu ketat.`,
    });
  }

  if (split.needsPct < 40) {
    tips.push({
      level: "info",
      message: `Porsi kebutuhan hanya ${split.needsPct}%. Pastikan ongkos dan makan harian benar-benar tercukupi, supaya tabungan tidak terpakai lagi di akhir bulan.`,
    });
  }

  // Pemasukan kecil: persentase saja kurang membantu, angka nominalnya yang terasa.
  if (income.lessThan(300_000)) {
    tips.push({
      level: "info",
      message:
        "Pemasukanmu masih kecil, jadi konsistensi lebih penting daripada besarnya. Menabung Rp 5.000 tiap hari lebih efektif daripada menunggu punya uang banyak.",
    });
  }

  if (tips.length === 0) {
    tips.push({
      level: "success",
      message:
        "Pembagianmu sudah seimbang. Langkah berikutnya: catat pengeluaran harian supaya tahu apakah rencananya benar-benar terlaksana.",
    });
  }

  return tips;
};
