-- Menandai sesi yang dicabut karena rotasi refresh token, supaya refresh
-- paralel dengan token yang sama (frontend serverless multi-instance) tidak
-- dianggap pencurian token dan mencabut semua sesi user.
ALTER TABLE "Session" ADD COLUMN "replacedById" TEXT;
