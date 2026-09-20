import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Role } from "../../generated/prisma/enums";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "7d";
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AccessPayload = {
  sub: string;
  role: Role;
};

export type RefreshPayload = {
  sub: string;
  sid: string;
};

const isRole = (value: unknown): value is Role =>
  typeof value === "string" && Object.hasOwn(Role, value);

export const createAccessToken = (payload: AccessPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
};

export const createRefreshToken = (payload: RefreshPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
};

export const verifyAccessToken = (token: string): AccessPayload => {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.sub !== "string" ||
    !isRole((payload as Record<string, unknown>).role)
  ) {
    throw new jwt.JsonWebTokenError("Access token payload tidak valid");
  }

  return {
    sub: payload.sub,
    role: (payload as unknown as AccessPayload).role,
  };
};

export const verifyRefreshToken = (token: string): RefreshPayload => {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.sub !== "string" ||
    typeof (payload as Record<string, unknown>).sid !== "string"
  ) {
    throw new jwt.JsonWebTokenError("Refresh token payload tidak valid");
  }

  return {
    sub: payload.sub,
    sid: (payload as unknown as RefreshPayload).sid,
  };
};
