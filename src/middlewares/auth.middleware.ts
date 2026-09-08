import type { RequestHandler } from "express";
import { AppError } from "../utils/app.error";
import { verifyAccessToken } from "../utils/jwt";

export const authMiddleware: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError(401, "Authorization token is missing or invalid"));
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next(new AppError(401, "Authorization token is missing or invalid"));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
    };
    next();
  } catch (error) {
    return next(new AppError(401, "Invalid or expired access token"));
  }
};
