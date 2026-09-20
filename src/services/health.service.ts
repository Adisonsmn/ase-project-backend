import { prisma } from "../config/database";
import { logger } from "../utils/logger";

export const checkDatabase = async (): Promise<{
  ok: boolean;
  latencyMs: number;
}> => {
  const startedAt = performance.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    logger.error("Health check database gagal", error);
    return { ok: false, latencyMs: Math.round(performance.now() - startedAt) };
  }
};
