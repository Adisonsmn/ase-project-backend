import { Prisma } from "../../generated/prisma/client";

/**
 * Nominal uang disimpan sebagai Decimal(14,2) di database dan dikirim sebagai
 * string di JSON. Number JavaScript tidak dapat merepresentasikan pecahan
 * desimal secara tepat, sehingga agregasi lewat Number berisiko menghasilkan
 * selisih rupiah pada laporan.
 */
export type Money = Prisma.Decimal;

export const toDecimal = (value: string | number): Money =>
  new Prisma.Decimal(value);

/** Decimal -> string dua desimal, siap dikirim sebagai JSON. */
export const formatMoney = (value: Money | string | number | null): string => {
  if (value === null) return "0.00";
  return new Prisma.Decimal(value).toFixed(2);
};

export const sumMoney = (values: (Money | string | number)[]): string =>
  values
    .reduce<Prisma.Decimal>(
      (total, value) => total.plus(new Prisma.Decimal(value)),
      new Prisma.Decimal(0),
    )
    .toFixed(2);

/** a - b, dikembalikan sebagai string. */
export const subtractMoney = (
  a: Money | string | number,
  b: Money | string | number,
): string => new Prisma.Decimal(a).minus(new Prisma.Decimal(b)).toFixed(2);

/** Porsi b terhadap a dalam persen, dibulatkan 2 desimal. */
export const percentageOf = (
  part: Money | string | number,
  total: Money | string | number,
): number => {
  const totalDecimal = new Prisma.Decimal(total);
  if (totalDecimal.isZero()) return 0;

  return new Prisma.Decimal(part)
    .dividedBy(totalDecimal)
    .times(100)
    .toDecimalPlaces(2)
    .toNumber();
};
