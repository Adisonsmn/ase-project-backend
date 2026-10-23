-- Email kini dinormalkan ke huruf kecil saat register dan login. Email lama
-- yang masih berhuruf besar diseragamkan supaya pemiliknya tetap bisa login.
--
-- Baris yang huruf kecilnya bentrok dengan user lain sengaja dilewati: kalau
-- tidak, constraint unik akan menggagalkan migrasi dan container tidak pernah
-- sehat. Cek dulu dengan:
--   SELECT lower(email), count(*) FROM "User" GROUP BY 1 HAVING count(*) > 1;
UPDATE "User" u
SET "email" = lower(u."email")
WHERE u."email" <> lower(u."email")
  AND NOT EXISTS (
    SELECT 1 FROM "User" o
    WHERE o."id" <> u."id" AND lower(o."email") = lower(u."email")
  );
