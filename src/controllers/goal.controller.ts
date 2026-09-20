import type { Request, RequestHandler } from "express";
import * as goalService from "../services/goal.service";
import type {
  ListGoalQuery,
  ListIncomeIdeaQuery,
} from "../schemas/goal.schema";
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
    const goal = await goalService.createGoal(userId, req.body);
    res.status(201).json(goal);
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { status } = req.validated?.query as ListGoalQuery;

    const goals = await goalService.listGoals(userId, status);
    res.status(200).json({ data: goals });
  } catch (error) {
    next(error);
  }
};

export const detail: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const goal = await goalService.getGoal(userId, id);
    res.status(200).json(goal);
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const goal = await goalService.updateGoal(userId, id, req.body);
    res.status(200).json(goal);
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const result = await goalService.deleteGoal(userId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const gap: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const result = await goalService.analyzeGoalGap(userId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const incomeIdeas: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const query = req.validated?.query as ListIncomeIdeaQuery;

    const result = await goalService.listIncomeIdeas(userId, query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
