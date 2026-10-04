import type { RequestHandler } from "express";
import * as articleService from "../services/article.service";
import type {
  AdminListArticleQuery,
  ArticleSlugParam,
  ListArticleQuery,
} from "../schemas/article.schema";
import type { IdParam } from "../schemas/common.schema";
import { AppError } from "../utils/app.error";

const requireUserId = (req: Parameters<RequestHandler>[0]) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
};

// --- Publik ------------------------------------------------------------------

export const list: RequestHandler = async (req, res, next) => {
  try {
    const query = req.validated?.query as ListArticleQuery;
    res.status(200).json(await articleService.listPublishedArticles(query));
  } catch (error) {
    next(error);
  }
};

export const detail: RequestHandler = async (req, res, next) => {
  try {
    const { slug } = req.validated?.params as ArticleSlugParam;
    res.status(200).json(await articleService.getPublishedArticle(slug));
  } catch (error) {
    next(error);
  }
};

export const categories: RequestHandler = async (_req, res, next) => {
  try {
    const data = await articleService.listArticleCategories();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// --- Admin -------------------------------------------------------------------

export const adminList: RequestHandler = async (req, res, next) => {
  try {
    const query = req.validated?.query as AdminListArticleQuery;
    res.status(200).json(await articleService.listArticlesForAdmin(query));
  } catch (error) {
    next(error);
  }
};

export const adminDetail: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.validated?.params as IdParam;
    res.status(200).json(await articleService.getArticleForAdmin(id));
  } catch (error) {
    next(error);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const authorId = requireUserId(req);
    const article = await articleService.createArticle(authorId, req.body);
    res.status(201).json(article);
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.validated?.params as IdParam;
    const article = await articleService.updateArticle(id, req.body);
    res.status(200).json(article);
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.validated?.params as IdParam;
    res.status(200).json(await articleService.deleteArticle(id));
  } catch (error) {
    next(error);
  }
};
