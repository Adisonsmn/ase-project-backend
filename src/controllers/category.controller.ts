import type { RequestHandler } from "express";
import * as categoryService from "../services/category.service";
import type { ListCategoryQuery } from "../schemas/category.schema";
import type { IdParam } from "../schemas/common.schema";
import { AppError } from "../utils/app.error";

const requireUserId = (req: Parameters<RequestHandler>[0]) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { type } = req.validated?.query as ListCategoryQuery;

    const categories = await categoryService.listCategories(userId, type);
    res.status(200).json({ data: categories });
  } catch (error) {
    next(error);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const category = await categoryService.createCategory(userId, req.body);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const category = await categoryService.updateCategory(userId, id, req.body);
    res.status(200).json(category);
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const result = await categoryService.deleteCategory(userId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
