import type { Role } from "../../generated/prisma/enums";
import { prisma } from "../config/database";
import type {
  RegisterInput,
  LoginInput,
  RefreshInput,
} from "../schemas/auth.schema";
import { DEFAULT_ACCOUNTS } from "../utils/account";
import { AppError } from "../utils/app.error";
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from "../utils/jwt";
import { logger } from "../utils/logger";
import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from "../utils/password";
import { isUniqueViolation } from "../utils/prisma-error";
import { isWithinRotationGrace } from "../utils/session";
import { hashToken, verifyTokenHash } from "../utils/token-hash";

type SessionUser = { id: string; role: Role };

const DUPLICATE_ACCOUNT_MESSAGE = "Email or username already exists";

const createSessionTokens = (user: SessionUser) => {
  const sessionId = crypto.randomUUID();

  const accessToken = createAccessToken({
    sub: user.id,
    role: user.role,
  });

  const refreshToken = createRefreshToken({
    sub: user.id,
    sid: sessionId,
  });

  return { sessionId, accessToken, refreshToken };
};

type SessionTokens = ReturnType<typeof createSessionTokens>;

const sessionData = (user: SessionUser, tokens: SessionTokens) => ({
  id: tokens.sessionId,
  userId: user.id,
  tokenHash: hashToken(tokens.refreshToken),
  expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
});

/** Membuat sesi baru beserta pasangan tokennya. */
const issueSession = async (user: SessionUser) => {
  const tokens = createSessionTokens(user);

  await prisma.session.create({ data: sessionData(user, tokens) });

  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
};

/**
 * Rotasi: cabut sesi lama dan buat penggantinya dalam satu transaksi.
 * Mengembalikan null kalau request lain dengan token yang sama sudah lebih
 * dulu memutarnya (filter revokedAt di updateMany).
 */
const rotateSession = async (sessionId: string, user: SessionUser) => {
  const tokens = createSessionTokens(user);

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), replacedById: tokens.sessionId },
    });

    if (count === 0) return null;

    await tx.session.create({ data: sessionData(user, tokens) });

    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  });
};

/**
 * Mencabut seluruh sesi aktif milik user.
 * Dipanggil saat terdeteksi penggunaan ulang refresh token, yang merupakan
 * indikasi token bocor.
 */
const revokeAllSessions = async (userId: string) => {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

const toPublicUser = (user: {
  id: string;
  email: string;
  username: string;
  role: Role;
}) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  role: user.role,
});

export const register = async (input: RegisterInput) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, { username: input.username }],
    },
  });

  if (existingUser) {
    throw new AppError(409, DUPLICATE_ACCOUNT_MESSAGE);
  }

  const passwordHash = await hashPassword(input.password);
  const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;

  // Akun bawaan dibuat bersama user dalam satu query, jadi tidak pernah ada
  // user tanpa akun default.
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
        dateOfBirth,
        accounts: { create: DEFAULT_ACCOUNTS },
      },
    });
  } catch (error) {
    // Dua pendaftaran bersamaan lolos pengecekan di atas; yang kalah ditolak
    // constraint unik.
    if (isUniqueViolation(error)) {
      throw new AppError(409, DUPLICATE_ACCOUNT_MESSAGE);
    }
    throw error;
  }

  const tokens = await issueSession(user);

  return { ...tokens, user: toPublicUser(user) };
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, "Invalid email or password");
  }

  const isPasswordValid = await verifyPassword(
    input.password,
    user.passwordHash,
  );

  if (!isPasswordValid) {
    throw new AppError(401, "Invalid email or password");
  }

  // Hash yang dibuat dengan parameter argon2 lama diperbarui sekali saat login,
  // supaya verifikasi berikutnya ikut cepat.
  if (passwordNeedsRehash(user.passwordHash)) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.password) },
    });
  }

  const tokens = await issueSession(user);

  return { ...tokens, user: toPublicUser(user) };
};

export const refresh = async (input: RefreshInput) => {
  let payload;
  try {
    payload = verifyRefreshToken(input.refreshToken);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });

  if (!session || !session.user.isActive) {
    throw new AppError(401, "Session invalid or expired");
  }

  const isTokenHashValid = await verifyTokenHash(
    input.refreshToken,
    session.tokenHash,
  );

  if (!isTokenHashValid) {
    throw new AppError(401, "Invalid refresh token");
  }

  if (session.revokedAt !== null) {
    // Request paralel yang kalah rotasi beberapa detik lalu: bukan token
    // curian, jadi diberi sesi sendiri alih-alih me-logout user.
    if (isWithinRotationGrace(session)) {
      return issueSession(session.user);
    }

    // Token sah tapi sesinya sudah lama dicabut = token lama dipakai ulang.
    // Asumsikan token bocor dan cabut seluruh sesi user.
    await revokeAllSessions(session.userId);

    logger.warn("Refresh token reuse terdeteksi, seluruh sesi dicabut", {
      userId: session.userId,
      sessionId: session.id,
    });

    throw new AppError(
      401,
      "Sesi tidak valid. Semua sesi telah dicabut demi keamanan, silakan login kembali.",
    );
  }

  if (session.expiresAt < new Date()) {
    throw new AppError(401, "Session invalid or expired");
  }

  const rotated = await rotateSession(session.id, session.user);
  if (rotated) return rotated;

  // Kalah balapan dengan request lain yang memutar token yang sama pada saat
  // yang persis bersamaan.
  const latest = await prisma.session.findUnique({
    where: { id: session.id },
    select: { revokedAt: true, replacedById: true },
  });

  if (latest && isWithinRotationGrace(latest)) {
    return issueSession(session.user);
  }

  throw new AppError(401, "Session invalid or expired");
};

export const logout = async (input: RefreshInput) => {
  let payload;
  try {
    payload = verifyRefreshToken(input.refreshToken);
  } catch {
    throw new AppError(401, "Invalid refresh token");
  }

  await prisma.session.updateMany({
    where: { id: payload.sid, userId: payload.sub, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { message: "Successfully logged out" };
};
