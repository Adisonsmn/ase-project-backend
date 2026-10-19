import type { Request, RequestHandler } from "express";
import * as accountService from "../services/account.service";
import type { ListAccountQuery } from "../schemas/account.schema";
import type { IdParam } from "../schemas/common.schema";
import { AppError } from "../utils/app.error";

const requireUserId = (req: Request) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { includeArchived } = req.validated?.query as ListAccountQuery;

    const accounts = await accountService.listAccounts(userId, includeArchived);
    res.status(200).json({ data: accounts });
  } catch (error) {
    next(error);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const account = await accountService.createAccount(userId, req.body);
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const account = await accountService.updateAccount(userId, id, req.body);
    res.status(200).json(account);
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const result = await accountService.deleteAccount(userId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
