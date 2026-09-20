import express from "express";
import helmet from "helmet";
import cors from "cors";

import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import healthRoutes from "./routes/health.routes";
import { requestIdMiddleware } from "./middlewares/request-id.middleware";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middlewares/error.middleware";
import { globalLimiter } from "./middlewares/rate-limit.middleware";

const app = express();

// Dipercaya berada di belakang satu reverse proxy (rate limiter membaca IP asli).
app.set("trust proxy", 1);

// 1. Request id untuk penelusuran log (NF-07)
app.use(requestIdMiddleware);

// 2. Security & CORS
app.use(helmet());
app.use(
  cors({
    // CORS_ORIGIN kosong hanya mungkin di luar production (dijaga oleh env schema).
    origin: env.CORS_ORIGIN.length > 0 ? env.CORS_ORIGIN : true,
    credentials: true,
  }),
);

// 3. Rate limiting global (limiter yang lebih ketat dipasang per route)
app.use(globalLimiter);

// 4. Body parser
app.use(express.json({ limit: "100kb" }));

// 5. Routes
app.use("/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);

// 6. Handler 404 & error global
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
