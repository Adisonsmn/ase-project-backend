import { describe, expect, test } from "bun:test";
import {
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
  nextAvailableSlug,
  slugify,
} from "../src/utils/slug";

describe("slugify", () => {
  test.each([
    ["judul biasa", "Cara Menabung Uang Jajan", "cara-menabung-uang-jajan"],
    ["tanda baca dibuang", "Saham: Naik atau Turun?!", "saham-naik-atau-turun"],
    ["& dibaca 'dan'", "Saham & Obligasi", "saham-dan-obligasi"],
    ["diakritik dibuang", "Café Crème Brûlée", "cafe-creme-brulee"],
    ["spasi & tanda hubung berlebih", "  IHSG --  Hari   Ini  ", "ihsg-hari-ini"],
    ["angka dipertahankan", "5 Tips Keuangan 2026", "5-tips-keuangan-2026"],
  ])("%s", (_label, input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  test("judul tanpa huruf atau angka menghasilkan string kosong", () => {
    expect(slugify("💰💰 ?!")).toBe("");
  });

  test("judul panjang dipotong di batas kata, tidak di tengah kata", () => {
    const title = "Panduan Lengkap ".repeat(10); // jauh di atas batas
    const slug = slugify(title);

    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug).toMatch(SLUG_PATTERN);
    expect(slug.endsWith("-panduan") || slug.endsWith("-lengkap")).toBe(true);
  });

  test("satu kata yang sangat panjang tetap dipotong, bukan dikosongkan", () => {
    const slug = slugify("a".repeat(200));
    expect(slug).toBe("a".repeat(SLUG_MAX_LENGTH));
  });

  test("hasilnya selalu lolos SLUG_PATTERN", () => {
    for (const title of [
      "Inflasi -- Apa Itu?",
      "Dolar/Rupiah: 16.000",
      "__rahasia__ menabung",
      "Emas!!! Naik???",
    ]) {
      expect(slugify(title)).toMatch(SLUG_PATTERN);
    }
  });
});

describe("nextAvailableSlug", () => {
  test("memakai slug dasar kalau belum terpakai", () => {
    expect(nextAvailableSlug("inflasi", ["deflasi"])).toBe("inflasi");
  });

  test("menambah sufiks -2 kalau slug dasar terpakai", () => {
    expect(nextAvailableSlug("inflasi", ["inflasi"])).toBe("inflasi-2");
  });

  test("melompati sufiks yang juga sudah terpakai", () => {
    expect(
      nextAvailableSlug("inflasi", ["inflasi", "inflasi-2", "inflasi-3"]),
    ).toBe("inflasi-4");
  });

  test("sufiks tetap muat dalam batas panjang", () => {
    const base = slugify("kata ".repeat(40));
    const slug = nextAvailableSlug(base, [base]);

    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug).toMatch(SLUG_PATTERN);
    expect(slug.endsWith("-2")).toBe(true);
  });
});
