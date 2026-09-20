-- Index unik ini tidak pernah dipakai: hash Argon2 selalu mengandung salt acak
-- sehingga tidak pernah bentrok, dan session dicari lewat id (sid), bukan hash.
DROP INDEX "Session_tokenHash_key";
