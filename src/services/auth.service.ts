import { prisma } from "../config/database";
import type { RegisterInput, LoginInput, RefreshInput } from "../schemas/auth.schema";
import { AppError } from "../utils/app.error";
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";

const createSessionTokens = (user: { id: string; role: string }) => {
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

  const { sessionId, accessToken, refreshToken } = createSessionTokens(user);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash: await hashPassword(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  };
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
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

  const { sessionId, accessToken, refreshToken } = createSessionTokens(user);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash: await hashPassword(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  };
};

export const refresh = async (input: RefreshInput) => {
  let payload;
  try {
    payload = verifyRefreshToken(input.refreshToken);
  } catch (error) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const session = await prisma.session.findUnique({
    where: {
      id: payload.sid,
    },
    include: {
      user: true,
    },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt < new Date() ||
    !session.user.isActive
  ) {
    throw new AppError(401, "Session invalid or expired");
  }

  const isTokenHashValid = await verifyPassword(
    input.refreshToken,
    session.tokenHash,
  );

  if (!isTokenHashValid) {
    throw new AppError(401, "Invalid refresh token");
  }

  // Revoke current session (Rotate refresh token)
  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  // Create new session & tokens
  const { sessionId, accessToken, refreshToken } = createSessionTokens(
    session.user,
  );

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: session.userId,
      tokenHash: await hashPassword(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return {
    accessToken,
    refreshToken,
  };
};

export const logout = async (input: RefreshInput) => {
  let payload;
  try {
    payload = verifyRefreshToken(input.refreshToken);
  } catch (error) {
    throw new AppError(401, "Invalid refresh token");
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
  });

  if (session && session.revokedAt === null) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  }

  return { message: "Successfully logged out" };
};
