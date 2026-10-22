import type { SimInstrumentType } from "../../generated/prisma/enums";

/**
 * Template event edukasi game simulasi (F-12).
 *
 * Sengaja disimpan di kode, bukan database: mesin simulasi memilih event dan
 * dampaknya dari daftar ini, jadi mengubah isinya lewat database akan
 * mengubah hasil sesi yang sudah berjalan. Mengubah daftar ini pun sama
 * efeknya untuk sesi yang belum selesai, jadi tambahkan template baru di akhir
 * dan jangan mengubah urutannya.
 *
 * `impact` adalah perubahan nilai sesaat, mis. -0.06 = turun 6%. Template
 * hanya berlaku untuk tipe instrumen yang punya entri di `impact`. Dampak naik
 * dan turun untuk saham sengaja dibuat seimbang supaya event tidak membuat
 * simulasi condong untung atau rugi.
 */
export type SimEventTemplate = {
  key: string;
  headline: string;
  explanation: string;
  impact: Partial<Record<SimInstrumentType, number>>;
};

export const SIM_EVENT_TEMPLATES: SimEventTemplate[] = [
  {
    key: "RATE_HIKE",
    headline: "Bank sentral menaikkan suku bunga",
    explanation:
      "Saat bunga naik, menyimpan uang di deposito jadi lebih menarik, sehingga sebagian orang menjual sahamnya dan harga saham turun. Sebaliknya, reksa dana pasar uang ikut menikmati bunga yang lebih tinggi.",
    impact: { STOCK: -0.06, MUTUAL_FUND: 0.003 },
  },
  {
    key: "RATE_CUT",
    headline: "Bank sentral menurunkan suku bunga",
    explanation:
      "Bunga yang lebih rendah membuat pinjaman lebih murah. Perusahaan lebih mudah berkembang dan investor kembali melirik saham, sehingga harganya cenderung naik.",
    impact: { STOCK: 0.06 },
  },
  {
    key: "EARNINGS_BEAT",
    headline: "Laba perusahaan di atas perkiraan",
    explanation:
      "Perusahaan mengumumkan keuntungan yang lebih besar dari dugaan. Banyak orang ingin ikut memiliki sahamnya, sehingga harga saham naik.",
    impact: { STOCK: 0.1 },
  },
  {
    key: "COMPANY_SCANDAL",
    headline: "Kabar buruk menimpa perusahaan",
    explanation:
      "Ada berita negatif tentang perusahaan, misalnya masalah hukum atau produk yang gagal. Investor khawatir dan menjual sahamnya, sehingga harga turun. Inilah alasan pentingnya tidak menaruh semua uang di satu saham.",
    impact: { STOCK: -0.1 },
  },
  {
    key: "INFLATION_UP",
    headline: "Inflasi naik lebih cepat dari perkiraan",
    explanation:
      "Harga barang naik, sehingga biaya perusahaan bertambah dan daya beli masyarakat turun. Harga saham cenderung melemah. Reksa dana pasar uang sedikit terbantu karena bunga ikut naik untuk menahan inflasi.",
    impact: { STOCK: -0.04, MUTUAL_FUND: 0.002 },
  },
  {
    key: "ECONOMY_GROWS",
    headline: "Ekonomi tumbuh lebih cepat",
    explanation:
      "Saat ekonomi tumbuh, orang lebih banyak berbelanja dan penjualan perusahaan meningkat. Harga saham cenderung naik, dan imbal hasil pasar uang ikut sedikit membaik.",
    impact: { STOCK: 0.05, MUTUAL_FUND: 0.001 },
  },
  {
    key: "GLOBAL_PANIC",
    headline: "Pasar global sedang panik",
    explanation:
      "Kabar buruk dari luar negeri membuat investor di seluruh dunia menjual saham secara bersamaan. Harga turun walau perusahaannya sendiri tidak bermasalah. Penurunan seperti ini biasanya sementara.",
    impact: { STOCK: -0.08 },
  },
  {
    key: "FOREIGN_INFLOW",
    headline: "Investor asing ramai membeli saham Indonesia",
    explanation:
      "Investor dari luar negeri menilai ekonomi Indonesia menarik dan membeli banyak saham. Permintaan yang naik membuat harga saham ikut naik.",
    impact: { STOCK: 0.07 },
  },
];

export const templatesFor = (type: SimInstrumentType) =>
  SIM_EVENT_TEMPLATES.filter((template) => template.impact[type] !== undefined);
