import { Prisma } from "../../generated/prisma/client";
import type { AgeGroup } from "../../generated/prisma/enums";
import { startOfLocalDay, toLocalDateString } from "./datetime";

/**
 * Analisis gap target tabungan (F-04..F-06).
 *
 * Fungsi murni tanpa database supaya aritmetikanya bisa diuji langsung.
 * Bagian yang paling mudah salah di sini adalah kasus tepi: target yang
 * tenggatnya hari ini, target yang sudah lewat, dan pembagian dengan nol.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 365 / 12;

/** Batas gap dianggap tidak realistis: lebih dari 3x pemasukan bulanan. */
export const UNREALISTIC_GAP_MULTIPLIER = 3;

export const calculateAge = (dateOfBirth: Date, now = new Date()): number => {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dateOfBirth.getUTCMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())
  ) {
    age--;
  }

  return age;
};

/**
 * Kelompok usia menentukan rekomendasi income mana yang ditampilkan.
 * Tanpa tanggal lahir, dipakai GENERAL — bukan menebak.
 */
export const resolveAgeGroup = (
  dateOfBirth: Date | null,
  now = new Date(),
): AgeGroup => {
  if (!dateOfBirth) return "GENERAL";

  const age = calculateAge(dateOfBirth, now);

  if (age >= 13 && age <= 19) return "TEEN";
  if (age >= 20 && age <= 24) return "YOUNG_ADULT";
  return "GENERAL";
};

/**
 * Sisa bulan menuju tenggat, minimal 1.
 *
 * Dibatasi minimal 1 supaya pembagian tidak pernah nol. Target yang tenggatnya
 * hari ini berarti seluruh kekurangannya harus dikumpulkan sekarang juga,
 * bukan dibagi nol.
 */
export const monthsUntil = (targetDate: Date, now = new Date()): number => {
  const from = startOfLocalDay(now).getTime();
  const to = startOfLocalDay(targetDate).getTime();
  const days = (to - from) / MS_PER_DAY;

  if (days <= 0) return 1;

  return Math.max(1, days / DAYS_PER_MONTH);
};

export type GapInput = {
  targetAmount: string;
  currentAmount: string;
  targetDate: Date;
  /** Pemasukan bulanan user; "0" kalau belum diketahui. */
  monthlyIncome: string;
  /** Persentase alokasi tabungan dari rasio F-01. */
  savingsPct: number;
  now?: Date;
};

export type GapResult = {
  remainingAmount: string;
  monthsRemaining: number;
  daysRemaining: number;
  requiredPerMonth: string;
  capablePerMonth: string;
  gapPerMonth: string;
  isAchieved: boolean;
  isOverdue: boolean;
  isOnTrack: boolean;
  isUnrealistic: boolean;
  /** Perkiraan tanggal tercapai kalau pola menabung sekarang diteruskan. */
  projectedDate: string | null;
  progressPercentage: number;
};

export const analyzeGap = (input: GapInput): GapResult => {
  const now = input.now ?? new Date();

  const target = new Prisma.Decimal(input.targetAmount);
  const current = new Prisma.Decimal(input.currentAmount);
  const monthlyIncome = new Prisma.Decimal(input.monthlyIncome);

  const remaining = Prisma.Decimal.max(target.minus(current), 0);
  const isAchieved = remaining.isZero();

  const daysRemaining = Math.ceil(
    (startOfLocalDay(input.targetDate).getTime() -
      startOfLocalDay(now).getTime()) /
      MS_PER_DAY,
  );
  const isOverdue = daysRemaining < 0 && !isAchieved;

  const monthsRemaining = monthsUntil(input.targetDate, now);

  const requiredPerMonth = remaining
    .dividedBy(monthsRemaining)
    .toDecimalPlaces(2);

  const capablePerMonth = monthlyIncome
    .times(input.savingsPct)
    .dividedBy(100)
    .toDecimalPlaces(2);

  const gapPerMonth = Prisma.Decimal.max(
    requiredPerMonth.minus(capablePerMonth),
    0,
  );

  const isOnTrack = isAchieved || gapPerMonth.isZero();

  // Tidak realistis kalau kekurangannya melebihi 3x seluruh pemasukan bulanan.
  // Kalau pemasukan belum diketahui, tidak ada dasar untuk menyimpulkan apa pun.
  const isUnrealistic =
    !isAchieved &&
    monthlyIncome.greaterThan(0) &&
    gapPerMonth.greaterThan(monthlyIncome.times(UNREALISTIC_GAP_MULTIPLIER));

  // Proyeksi hanya bisa dihitung kalau user memang mampu menabung.
  let projectedDate: string | null = null;
  if (isAchieved) {
    projectedDate = toLocalDateString(now);
  } else if (capablePerMonth.greaterThan(0)) {
    const monthsNeeded = remaining.dividedBy(capablePerMonth).toNumber();
    const projected = new Date(
      startOfLocalDay(now).getTime() + monthsNeeded * DAYS_PER_MONTH * MS_PER_DAY,
    );
    projectedDate = toLocalDateString(projected);
  }

  const progressPercentage = target.isZero()
    ? 0
    : Prisma.Decimal.min(
        current.dividedBy(target).times(100),
        100,
      )
        .toDecimalPlaces(2)
        .toNumber();

  return {
    remainingAmount: remaining.toFixed(2),
    monthsRemaining: Number(monthsRemaining.toFixed(2)),
    daysRemaining,
    requiredPerMonth: requiredPerMonth.toFixed(2),
    capablePerMonth: capablePerMonth.toFixed(2),
    gapPerMonth: gapPerMonth.toFixed(2),
    isAchieved,
    isOverdue,
    isOnTrack,
    isUnrealistic,
    projectedDate,
    progressPercentage,
  };
};

export type GapAdvice = {
  level: "info" | "warning" | "success";
  message: string;
};

/** Pesan yang menjelaskan hasil analisis dengan bahasa sehari-hari. */
export const buildGapAdvice = (
  result: GapResult,
  targetTitle: string,
): GapAdvice[] => {
  const advice: GapAdvice[] = [];
  const rupiah = (value: string) =>
    `Rp ${Number(value).toLocaleString("id-ID")}`;

  if (result.isAchieved) {
    advice.push({
      level: "success",
      message: `Target "${targetTitle}" sudah tercapai. Saatnya menentukan target berikutnya.`,
    });
    return advice;
  }

  if (result.isOverdue) {
    advice.push({
      level: "warning",
      message: `Tenggat target ini sudah lewat dan masih kurang ${rupiah(result.remainingAmount)}. Perpanjang tenggatnya supaya rencananya kembali masuk akal.`,
    });
  }

  if (result.isUnrealistic) {
    advice.push({
      level: "warning",
      message: `Untuk mengejar target ini kamu perlu menabung ${rupiah(result.requiredPerMonth)} per bulan, jauh di atas kemampuanmu sekarang. Coba turunkan nominal targetnya atau perpanjang jangka waktunya dulu.`,
    });
    return advice;
  }

  if (result.isOnTrack) {
    advice.push({
      level: "success",
      message: `Dengan pola menabungmu sekarang, target ini tercapai sekitar ${result.projectedDate ?? "sesuai rencana"}. Pertahankan.`,
    });
    return advice;
  }

  advice.push({
    level: "info",
    message: `Kamu perlu menabung ${rupiah(result.requiredPerMonth)} per bulan, sementara kemampuanmu sekarang ${rupiah(result.capablePerMonth)}. Kekurangannya ${rupiah(result.gapPerMonth)} per bulan.`,
  });

  advice.push({
    level: "info",
    message:
      "Ada dua jalan: menambah pemasukan, atau menurunkan pengeluaran. Lihat daftar ide di bawah — pilih yang paling masuk ke jadwalmu.",
  });

  return advice;
};
