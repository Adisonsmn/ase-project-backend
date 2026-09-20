/**
 * Semua tanggal disimpan dalam UTC, tetapi laporan dikelompokkan menurut
 * tanggal lokal user. Tanpa ini, transaksi jam 23:30 WIB (16:30 UTC) akan
 * masuk ke hari yang salah di laporan harian.
 *
 * Indonesia tidak pernah menerapkan DST, jadi offset tetap aman dipakai.
 * Kalau nanti aplikasi mendukung banyak zona waktu, ganti konstanta ini
 * dengan preferensi per user.
 */
export const APP_TIME_ZONE = "Asia/Jakarta";
export const APP_UTC_OFFSET_MINUTES = 7 * 60;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/** Waktu UTC digeser ke waktu dinding lokal. */
const toLocalWallClock = (date: Date) =>
  new Date(date.getTime() + APP_UTC_OFFSET_MINUTES * MS_PER_MINUTE);

/** Kebalikan dari toLocalWallClock. */
const fromLocalWallClock = (date: Date) =>
  new Date(date.getTime() - APP_UTC_OFFSET_MINUTES * MS_PER_MINUTE);

/** "YYYY-MM-DD" menurut tanggal lokal. */
export const toLocalDateString = (date: Date): string =>
  toLocalWallClock(date).toISOString().slice(0, 10);

/** Awal hari lokal (00:00 WIB) sebagai Date UTC. */
export const startOfLocalDay = (date: Date): Date => {
  const local = toLocalWallClock(date);
  local.setUTCHours(0, 0, 0, 0);
  return fromLocalWallClock(local);
};

/** Akhir hari lokal (23:59:59.999 WIB) sebagai Date UTC. */
export const endOfLocalDay = (date: Date): Date =>
  new Date(startOfLocalDay(date).getTime() + MS_PER_DAY - 1);

/** Awal minggu lokal; minggu dimulai hari Senin. */
export const startOfLocalWeek = (date: Date): Date => {
  const local = toLocalWallClock(date);
  const dayOfWeek = local.getUTCDay(); // 0 = Minggu
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  local.setUTCDate(local.getUTCDate() - daysSinceMonday);
  local.setUTCHours(0, 0, 0, 0);
  return fromLocalWallClock(local);
};

/** Awal bulan lokal. */
export const startOfLocalMonth = (date: Date): Date => {
  const local = toLocalWallClock(date);
  local.setUTCDate(1);
  local.setUTCHours(0, 0, 0, 0);
  return fromLocalWallClock(local);
};

/**
 * Batas atas transaksi yang boleh dicatat: akhir hari ini menurut waktu lokal.
 * Memakai `new Date()` langsung akan keliru menolak transaksi bertanggal hari
 * ini yang dicatat dini hari WIB, karena saat itu UTC masih di tanggal kemarin.
 */
export const endOfToday = (): Date => endOfLocalDay(new Date());
