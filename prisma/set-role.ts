import { prisma } from "../src/config/database";

/**
 * Mengubah role user lewat baris perintah.
 *
 *   bun run db:set-role -- budi@contoh.com ADMIN
 *   bun run db:set-role -- budi@contoh.com USER
 *
 * Sengaja tidak dibuat sebagai endpoint API: promosi admin pertama tidak bisa
 * dilakukan lewat API tanpa admin yang sudah ada, dan endpoint yang bisa
 * memberi hak admin adalah sasaran serangan yang tidak sebanding manfaatnya.
 *
 * Role baru berlaku saat user me-refresh token (refresh membaca role dari
 * database), atau paling lambat saat access token lamanya kedaluwarsa.
 */
const ROLES = ["USER", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

const [email, role] = process.argv.slice(2);

const main = async () => {
  if (!email || !ROLES.includes(role as Role)) {
    console.error("Pemakaian: bun run db:set-role -- <email> <USER|ADMIN>");
    process.exit(1);
  }

  // Email disimpan apa adanya saat registrasi, jadi dicocokkan tanpa
  // membedakan huruf besar-kecil.
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true },
  });

  if (!user) {
    console.error(`User dengan email ${email} tidak ditemukan.`);
    process.exit(1);
  }

  if (user.role === role) {
    console.log(`${email} sudah ber-role ${role}. Tidak ada yang diubah.`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: role as Role },
  });

  console.log(`${email}: ${user.role} -> ${role}`);
};

main()
  .catch((error) => {
    console.error("Gagal mengubah role:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
