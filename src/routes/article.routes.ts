import { Router } from "express";
import * as articleController from "../controllers/article.controller";
import * as bookmarkController from "../controllers/bookmark.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import {
  articleIdParamSchema,
  articleSlugParamSchema,
  createArticleSchema,
  listArticleQuerySchema,
  updateArticleSchema,
} from "../schemas/article.schema";

const router = Router();

// Membaca artikel tidak butuh akun (PRD F-14): calon user bisa membaca dulu
// sebelum memutuskan mendaftar. Hanya artikel PUBLISHED yang dikembalikan.
router.get(
  "/",
  validateMiddleware(listArticleQuerySchema),
  articleController.list,
);

router.get(
  "/:slug",
  validateMiddleware(articleSlugParamSchema),
  articleController.detail,
);

router.use(authMiddleware);

// --- Bookmark: semua user yang login ----------------------------------------

router.post(
  "/:id/bookmark",
  validateMiddleware(articleIdParamSchema),
  bookmarkController.add,
);

router.delete(
  "/:id/bookmark",
  validateMiddleware(articleIdParamSchema),
  bookmarkController.remove,
);

// --- Kelola artikel: khusus ADMIN -------------------------------------------

router.post(
  "/",
  requireRole("ADMIN"),
  validateMiddleware(createArticleSchema),
  articleController.create,
);

router.patch(
  "/:id",
  requireRole("ADMIN"),
  validateMiddleware(updateArticleSchema),
  articleController.update,
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  validateMiddleware(articleIdParamSchema),
  articleController.remove,
);

export default router;
