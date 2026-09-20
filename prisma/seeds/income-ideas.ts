import type { AgeGroup } from "../../generated/prisma/enums";

/**
 * Ide penambahan income, disaring menurut kelompok usia.
 *
 * Id ditetapkan manual supaya seed idempotent. Estimasi pendapatan sengaja
 * dibuat sebagai rentang, bukan angka tunggal, karena hasilnya sangat
 * bergantung pada usaha dan lokasi — menampilkan satu angka pasti akan
 * memberi harapan yang keliru.
 */
export type SeedIncomeIdea = {
  id: string;
  title: string;
  description: string;
  ageGroup: AgeGroup;
  estMonthlyMin: string;
  estMonthlyMax: string;
  effortLevel: number;
};

export const incomeIdeas: SeedIncomeIdea[] = [
  // 13-19 tahun: modal kecil, bisa dikerjakan di sela sekolah
  {
    id: "10000000-0000-4000-8000-000000000001",
    title: "Jualan ATK di sekolah",
    description:
      "Jual pulpen, pensil, penghapus, dan kertas binder ke teman sekelas. Modal awal kecil dan barangnya hampir selalu dibutuhkan, terutama menjelang ujian.",
    ageGroup: "TEEN",
    estMonthlyMin: "100000",
    estMonthlyMax: "400000",
    effortLevel: 2,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    title: "Jualan snack atau minuman dingin",
    description:
      "Beli camilan dalam jumlah besar, jual satuan saat jam istirahat. Perhatikan aturan sekolah dan jangan sampai mengganggu jam belajar.",
    ageGroup: "TEEN",
    estMonthlyMin: "150000",
    estMonthlyMax: "500000",
    effortLevel: 2,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    title: "Jasa print dan jilid tugas",
    description:
      "Kalau di rumah ada printer, tawarkan jasa cetak dan jilid tugas ke teman. Hitung biaya tinta dan kertas supaya harganya tidak merugi.",
    ageGroup: "TEEN",
    estMonthlyMin: "100000",
    estMonthlyMax: "350000",
    effortLevel: 2,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    title: "Jual barang preloved",
    description:
      "Jual buku, baju, atau mainan yang sudah tidak dipakai lewat marketplace. Tidak butuh modal sama sekali, dan sekalian merapikan kamar.",
    ageGroup: "TEEN",
    estMonthlyMin: "50000",
    estMonthlyMax: "300000",
    effortLevel: 1,
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    title: "Jasa desain poster dan feed sederhana",
    description:
      "Banyak organisasi sekolah butuh poster acara. Modal awalnya cukup aplikasi desain gratis dan latihan beberapa minggu.",
    ageGroup: "TEEN",
    estMonthlyMin: "150000",
    estMonthlyMax: "600000",
    effortLevel: 3,
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    title: "Jasa titip jajan atau belanja",
    description:
      "Bantu teman membelikan sesuatu dari luar sekolah dengan biaya jasa kecil. Cocok kalau rumahmu dekat pusat jajanan.",
    ageGroup: "TEEN",
    estMonthlyMin: "50000",
    estMonthlyMax: "250000",
    effortLevel: 1,
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    title: "Mengajar adik kelas",
    description:
      "Kalau kamu kuat di satu mata pelajaran, tawarkan belajar bersama berbayar untuk adik kelas. Sekalian memperkuat pemahamanmu sendiri.",
    ageGroup: "TEEN",
    estMonthlyMin: "200000",
    estMonthlyMax: "700000",
    effortLevel: 3,
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    title: "Jasa cuci sepatu",
    description:
      "Modalnya sikat, sabun khusus, dan ketelatenan. Banyak peminat di lingkungan sekolah dan sekitar rumah.",
    ageGroup: "TEEN",
    estMonthlyMin: "150000",
    estMonthlyMax: "500000",
    effortLevel: 3,
  },

  // 20-24 tahun: bisa terikat jadwal, keterampilan lebih spesifik
  {
    id: "20000000-0000-4000-8000-000000000001",
    title: "Freelance desain grafis",
    description:
      "Kerjakan logo, poster, atau konten media sosial lewat platform freelance atau jaringan pertemanan. Bangun portofolio dulu sebelum menaikkan tarif.",
    ageGroup: "YOUNG_ADULT",
    estMonthlyMin: "500000",
    estMonthlyMax: "3000000",
    effortLevel: 3,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    title: "Freelance menulis artikel",
    description:
      "Tulis artikel untuk blog perusahaan atau media online. Tarif biasanya dihitung per kata atau per artikel.",
    ageGroup: "YOUNG_ADULT",
    estMonthlyMin: "400000",
    estMonthlyMax: "2500000",
    effortLevel: 3,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    title: "Freelance coding atau bikin website",
    description:
      "Buat landing page atau website sederhana untuk UMKM. Satu proyek kecil saja sudah lumayan menutup target bulanan.",
    ageGroup: "YOUNG_ADULT",
    estMonthlyMin: "1000000",
    estMonthlyMax: "5000000",
    effortLevel: 4,
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    title: "Les privat atau bimbel",
    description:
      "Mengajar siswa SD sampai SMA, bisa daring maupun datang ke rumah. Jadwalnya relatif tetap sehingga mudah direncanakan.",
    ageGroup: "YOUNG_ADULT",
    estMonthlyMin: "500000",
    estMonthlyMax: "2500000",
    effortLevel: 3,
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    title: "Crew event atau usher",
    description:
      "Kerja harian saat ada konser, pameran, atau seminar. Dibayar per hari dan tidak mengikat jangka panjang.",
    ageGroup: "YOUNG_ADULT",
    estMonthlyMin: "300000",
    estMonthlyMax: "1500000",
    effortLevel: 2,
  },
  {
    id: "20000000-0000-4000-8000-000000000006",
    title: "Jasa fotografi atau videografi",
    description:
      "Foto wisuda, produk UMKM, atau acara kecil. Butuh kamera yang memadai, tapi bisa mulai dari menyewa dulu.",
    ageGroup: "YOUNG_ADULT",
    estMonthlyMin: "500000",
    estMonthlyMax: "3000000",
    effortLevel: 4,
  },
  {
    id: "20000000-0000-4000-8000-000000000007",
    title: "Dropship produk",
    description:
      "Jual produk tanpa menyetok barang. Keuntungan per transaksi tipis, jadi kuncinya ada di volume dan pemilihan produk.",
    ageGroup: "YOUNG_ADULT",
    estMonthlyMin: "200000",
    estMonthlyMax: "2000000",
    effortLevel: 3,
  },
  {
    id: "20000000-0000-4000-8000-000000000008",
    title: "Admin media sosial UMKM",
    description:
      "Kelola akun media sosial usaha kecil: jadwal unggahan, balas pesan, bikin konten sederhana. Biasanya dibayar bulanan.",
    ageGroup: "YOUNG_ADULT",
    estMonthlyMin: "500000",
    estMonthlyMax: "2000000",
    effortLevel: 3,
  },

  // Berlaku untuk semua usia
  {
    id: "30000000-0000-4000-8000-000000000001",
    title: "Kurangi satu pengeluaran rutin",
    description:
      "Bukan menambah income, tapi efeknya sama. Cek catatan pengeluaranmu: sering kali ada langganan atau jajan rutin yang bisa dipangkas tanpa terasa.",
    ageGroup: "GENERAL",
    estMonthlyMin: "50000",
    estMonthlyMax: "500000",
    effortLevel: 1,
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    title: "Jual keterampilan yang sudah kamu punya",
    description:
      "Mengetik, menerjemahkan, mengedit video, atau membuat presentasi. Mulai dari orang terdekat dulu sebelum mencari klien baru.",
    ageGroup: "GENERAL",
    estMonthlyMin: "200000",
    estMonthlyMax: "1500000",
    effortLevel: 2,
  },
];
