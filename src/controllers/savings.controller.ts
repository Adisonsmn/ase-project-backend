import type { Request, RequestHandler } from "express";
import * as savingsService from "../services/savings.service";
import { AppError } from "../utils/app.error";

const requireUserId = (req: Request) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
};

export const presets: RequestHandler = (_req, res) => {
  res.status(200).json(savingsService.listPresets());
};

export const calculate: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const result = await savingsService.calculate(userId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getRatio: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const ratio = await savingsService.getSavedRatio(userId);

    if (!ratio) {
      // Belum pernah menyimpan bukan kondisi error; frontend cukup memakai
      // rasio default yang ikut dikirim di sini.
      res.status(200).json({
        data: null,
        default: savingsService.listPresets().default,
      });
      return;
    }

    res.status(200).json({ data: ratio });
  } catch (error) {
    next(error);
  }
};

export const saveRatio: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const ratio = await savingsService.saveRatio(userId, req.body);
    res.status(200).json(ratio);
  } catch (error) {
    next(error);
  }
};
