/**
 * Masa tenggang setelah rotasi refresh token.
 *
 * Frontend memanggil beberapa endpoint sekaligus, dan di hosting serverless
 * (Vercel) request itu bisa jatuh ke instance berbeda yang masing-masing
 * me-refresh dengan token lama yang sama. Hanya satu yang menang rotasi; tanpa
 * masa tenggang, sisanya dianggap reuse token curian dan seluruh sesi user
 * dicabut.
 */
export const REFRESH_GRACE_MS = 30_000;

export type RevocationState = {
  revokedAt: Date | null;
  replacedById: string | null;
};

/**
 * True kalau sesi baru saja dicabut karena rotasi (bukan logout atau reuse),
 * sehingga pemakaian ulang tokennya masih dianggap request paralel yang sah.
 */
export const isWithinRotationGrace = (
  session: RevocationState,
  now = new Date(),
): boolean =>
  session.revokedAt !== null &&
  session.replacedById !== null &&
  now.getTime() - session.revokedAt.getTime() <= REFRESH_GRACE_MS;
