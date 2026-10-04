import type { RequestHandler } from "express";
import * as bookmarkService from "../services/bookmark.service";
import type { ListBookmarkQuery } from "../schemas/article.schema";
import type { IdParam } from "../schemas/common.schema";
import { AppError } from "../utils/app.error";

const requireUserId = (req: Parameters<RequestHandler>[0]) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
};

export const add: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    const { created, ...bookmark } = await bookmarkService.addBookmark(
      userId,
      id,
    );
    // 201 saat baru dibuat, 200 kalau artikel itu memang sudah ditandai.
    res.status(created ? 201 : 200).json(bookmark);
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;

    res.status(200).json(await bookmarkService.removeBookmark(userId, id));
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const query = req.validated?.query as ListBookmarkQuery;

    res.status(200).json(await bookmarkService.listBookmarks(userId, query));
  } catch (error) {
    next(error);
  }
};
