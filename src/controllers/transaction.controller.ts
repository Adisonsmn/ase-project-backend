import type { Request, RequestHandler } from "express";
import * as transactionService from "../services/transaction.service";
import * as summaryService from "../services/summary.service";
import type {
  ListTransactionQuery,
  SummaryQuery,
} from "../schemas/transaction.schema";
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
    const transaction = await transactionService.createTransaction(
      userId,
      req.body,
    );
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const query = req.validated?.query as ListTransactionQuery;

    const result = await transactionService.listTransactions(userId, query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const detail: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const transaction = await transactionService.getTransaction(userId, id);
    res.status(200).json(transaction);
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const transaction = await transactionService.updateTransaction(
      userId,
      id,
      req.body,
    );
    res.status(200).json(transaction);
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const result = await transactionService.deleteTransaction(userId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const summary: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const query = req.validated?.query as SummaryQuery;

    const result = await summaryService.getSummary(userId, query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
