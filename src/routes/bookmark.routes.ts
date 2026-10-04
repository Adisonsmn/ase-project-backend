import { Router } from "express";
import * as bookmarkController from "../controllers/bookmark.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import { listBookmarkQuerySchema } from "../schemas/article.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  validateMiddleware(listBookmarkQuerySchema),
  bookmarkController.list,
);

export default router;
