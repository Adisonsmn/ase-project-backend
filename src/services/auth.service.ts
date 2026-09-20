import type { Role } from "../../generated/prisma/enums";
import { prisma } from "../config/database";
import type {
  RegisterInput,
  LoginInput,
  RefreshInput,
} from "../schemas/auth.schema";
import { AppError } from "../utils/app.error";
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from "../utils/jwt";
import { logger } from "../utils/logger";
import { hashPassword, verifyPassword } from "../utils/password";

type SessionUser = { id: string; role: Role };

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

/** Membuat sesi baru beserta pasangan tokennya. */
const issueSession = async (user: SessionUser) => {
  const { sessionId, accessToken, refreshToken } = createSessionTokens(user);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash: await hashPassword(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
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
  displayName: string | null;
  role: Role;
}) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  displayName: user.displayName,
  role: user.role,
});

export const register = async (input: RegisterInput) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, { username: input.username }],
    },
  });

  if (existingUser) {
    throw new AppError(409, "Email or username already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      displayName: input.displayName,
      dateOfBirth,
    },
  });

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

  const isTokenHashValid = await verifyPassword(
    input.refreshToken,
    session.tokenHash,
  );

  if (!isTokenHashValid) {
    throw new AppError(401, "Invalid refresh token");
  }

  // Token sah tapi sesinya sudah dicabut = token lama dipakai ulang.
  // Asumsikan token bocor dan cabut seluruh sesi user.
  if (session.revokedAt !== null) {
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

  // Rotasi: cabut sesi lama, berikan sesi baru.
  // updateMany + filter revokedAt memastikan hanya satu request yang menang
  // jika dua refresh datang bersamaan dengan token yang sama.
  const rotated = await prisma.session.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (rotated.count === 0) {
    throw new AppError(401, "Session invalid or expired");
  }

  return issueSession(session.user);
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
