import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import { errorMiddleware } from "./middlewares/error.middleware";

const app = express();

// 1. Security & CORS Middlewares
app.use(helmet());
app.use(cors());

// 2. Rate Limiting Middleware (100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    message: "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// 3. Body Parser
app.use(express.json());

// 4. API Routes (Versioning /api/v1)
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);

// Shortcut Routes for Backward Compatibility
app.use("/auth", authRoutes);
app.use("/users", userRoutes);

// 5. Global Error Handler Middleware
app.use(errorMiddleware);

export default app;