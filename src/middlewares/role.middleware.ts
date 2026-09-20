import type { RequestHandler } from "express";
import type { Role } from "../../generated/prisma/enums";
import { AppError } from "../utils/app.error";

/**
 * Membatasi akses endpoint ke role tertentu.
 * Harus dipasang setelah authMiddleware.
 */
export const requireRole = (...allowedRoles: Role[]): RequestHandler => {
  return (req, _res, next) => {
    const user = req.user;

    if (!user) {
      return next(new AppError(401, "Unauthorized"));
    }

    if (!allowedRoles.includes(user.role)) {
      return next(
        new AppError(403, "Anda tidak memiliki akses ke resource ini."),
      );
    }

    next();
  };
};
