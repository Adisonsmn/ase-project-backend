import type {
  SimInstrumentType,
  SimLevel,
} from "../../generated/prisma/enums";

/**
 * Instrumen game simulasi investasi. Nama dan kodenya fiktif; tidak mewakili
 * emiten atau produk reksa dana sungguhan.
 *
 * Id ditetapkan manual supaya seed idempotent. Drift dan volatilitas per
 * tahun dikalibrasi supaya saham berisiko tinggi rugi di sekitar 45% sesi
 * 1 tahun (pesan edukasinya: investasi tidak selalu untung), sedangkan reksa
 * dana pasar uang hampir selalu naik tipis.
 */
export type SeedSimInstrument = {
  id: string;
  code: string;
  type: SimInstrumentType;
  name: string;
  fundType?: string;
  description: string;
  note?: string;
  riskLevel: SimLevel;
  returnPotential: SimLevel;
  horizonText?: string;
  minInvestment: string;
  basePrice: string;
  annualDrift: number;
  annualVolatility: number;
  sortOrder: number;
};

export const simInstruments: SeedSimInstrument[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    code: "NUSA",
    type: "STOCK",
    name: "PT Nusantara Abadi Tbk",
    description:
      "NUSA merupakan aset simulasi yang digunakan untuk mempelajari perubahan nilai investasi.",
    riskLevel: "HIGH",
    returnPotential: "HIGH",
    minInvestment: "1",
    basePrice: "2500",
    annualDrift: 0.1,
    annualVolatility: 0.35,
    sortOrder: 1,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    code: "KARYA",
    type: "STOCK",
    name: "PT Karya Maju Tbk",
    description:
      "KARYA merupakan aset simulasi perusahaan yang bergerak stabil. Harganya tidak naik turun setajam saham lain, tetapi potensi keuntungannya juga lebih kecil.",
    riskLevel: "MEDIUM",
    returnPotential: "MEDIUM",
    minInvestment: "1",
    basePrice: "1850",
    annualDrift: 0.07,
    annualVolatility: 0.2,
    sortOrder: 2,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    code: "TEKNO",
    type: "STOCK",
    name: "PT Teknologi Global Tbk",
    description:
      "TEKNO merupakan aset simulasi perusahaan teknologi yang sedang berkembang. Harganya bisa naik atau turun tajam dalam waktu singkat.",
    riskLevel: "HIGH",
    returnPotential: "HIGH",
    minInvestment: "1",
    basePrice: "3200",
    annualDrift: 0.12,
    annualVolatility: 0.4,
    sortOrder: 3,
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    code: "RDPU",
    type: "MUTUAL_FUND",
    name: "Reksa Dana Pasar Uang",
    fundType: "Pasar Uang",
    description:
      "Investasi jangka pendek dengan risiko rendah yang ditempatkan pada instrumen pasar uang.",
    note: "Dana kamu akan dikelola oleh Manajer Investasi dan ditempatkan pada instrumen pasar uang.",
    riskLevel: "LOW",
    returnPotential: "LOW",
    horizonText: "1–2 tahun",
    minInvestment: "10000",
    basePrice: "1000",
    annualDrift: 0.045,
    annualVolatility: 0.01,
    sortOrder: 4,
  },
];
