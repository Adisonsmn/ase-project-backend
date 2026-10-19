import type { Request, RequestHandler } from "express";
import * as transferService from "../services/transfer.service";
import type { IdParam } from "../schemas/common.schema";
import { AppError } from "../utils/app.error";

const requireUserId = (req: Request) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const transfer = await transferService.createTransfer(userId, req.body);
    res.status(201).json(transfer);
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const transfer = await transferService.updateTransfer(userId, id, req.body);
    res.status(200).json(transfer);
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const result = await transferService.deleteTransfer(userId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
