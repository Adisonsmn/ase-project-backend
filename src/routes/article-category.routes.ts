import { Router } from "express";
import * as articleController from "../controllers/article.controller";

const router = Router();

// Publik, sama seperti daftar artikel: dipakai untuk tombol filter kategori.
router.get("/", articleController.categories);

export default router;
