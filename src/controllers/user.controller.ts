import type { RequestHandler } from "express";
import * as userService from "../services/user.service";
import { AppError } from "../utils/app.error";

export const getMe: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const user = await userService.getProfile(userId);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const updateMe: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const updatedUser = await userService.updateProfile(userId, req.body);
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};
