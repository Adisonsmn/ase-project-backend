import { Router } from "express";
import * as articleController from "../controllers/article.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import {
  adminListArticleQuerySchema,
  articleIdParamSchema,
} from "../schemas/article.schema";

/**
 * Endpoint baca khusus admin. Dipisah dari /articles karena endpoint publik
 * hanya menampilkan artikel terbit dan mencari berdasarkan slug, sedangkan
 * admin perlu melihat draft dan mencari berdasarkan id - tanpa ini, draft yang
 * id-nya terlupa tidak akan pernah bisa ditemukan lagi untuk disunting.
 */
const router = Router();

router.use(authMiddleware, requireRole("ADMIN"));

router.get(
  "/articles",
  validateMiddleware(adminListArticleQuerySchema),
  articleController.adminList,
);

router.get(
  "/articles/:id",
  validateMiddleware(articleIdParamSchema),
  articleController.adminDetail,
);

export default router;
