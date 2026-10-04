/** Panjang maksimum slug. Cukup untuk judul wajar tanpa membuat URL kepanjangan. */
export const SLUG_MAX_LENGTH = 80;

/** Huruf kecil, angka, dan tanda hubung tunggal di antaranya. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Memotong slug ke panjang tertentu tanpa meninggalkan potongan kata atau
 * tanda hubung di ujung. "tips-menabung-untuk" lebih rapi daripada
 * "tips-menabung-untu".
 */
const truncateSlug = (slug: string, maxLength: number): string => {
  if (slug.length <= maxLength) return slug;

  const cut = slug.slice(0, maxLength);
  const lastDash = cut.lastIndexOf("-");

  // Kalau tidak ada batas kata sama sekali (satu kata yang sangat panjang),
  // potong saja di tengah kata daripada menghasilkan string kosong.
  const trimmed = lastDash > 0 ? cut.slice(0, lastDash) : cut;
  return trimmed.replace(/-+$/, "");
};

/**
 * Mengubah judul menjadi slug URL.
 *
 * Diakritik dibuang ("Café" -> "cafe") dan "&" dibaca "dan", karena judul
 * artikel berbahasa Indonesia ("Saham & Obligasi") lebih terbaca dengan cara
 * itu. Bisa mengembalikan string kosong kalau judul tidak mengandung huruf atau
 * angka sama sekali; pemanggil yang menentukan cadangannya.
 */
export const slugify = (text: string): string => {
  const slug = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return truncateSlug(slug, SLUG_MAX_LENGTH);
};

/**
 * Memilih slug yang belum terpakai: `base`, lalu `base-2`, `base-3`, dst.
 * Sufiks selalu muat dalam batas panjang, dengan memotong `base` bila perlu.
 */
export const nextAvailableSlug = (
  base: string,
  taken: Iterable<string>,
): string => {
  const used = new Set(taken);
  if (!used.has(base)) return base;

  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${truncateSlug(base, SLUG_MAX_LENGTH - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
};
