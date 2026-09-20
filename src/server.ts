import app from "./app";
import { env } from "./config/env";
import { prisma } from "./config/database";
import { logger } from "./utils/logger";

const server = app.listen(env.PORT, () => {
  logger.info("Server berjalan", {
    url: `http://localhost:${env.PORT}`,
    env: env.NODE_ENV,
  });
});

const shutdown = (signal: string) => {
  logger.info("Mematikan server", { signal });

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  // Paksa keluar jika koneksi tidak tertutup dalam 10 detik.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", error);
  process.exit(1);
});
