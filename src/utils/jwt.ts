import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type AccessPayload = {
  sub: string;
  role: string;
};

export type RefreshPayload = {
  sub: string;
  sid: string;
};

export const createAccessToken = (payload: AccessPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });
};

export const createRefreshToken = (payload: RefreshPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

export const verifyAccessToken = (token: string): AccessPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
};

export const verifyRefreshToken = (token: string): RefreshPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
};
