import type { Request, RequestHandler } from "express";
import * as activityService from "../services/activity.service";
import type { ListActivityQuery } from "../schemas/activity.schema";
import { AppError } from "../utils/app.error";

const requireUserId = (req: Request) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const query = req.validated?.query as ListActivityQuery;

    const result = await activityService.listActivities(userId, query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
