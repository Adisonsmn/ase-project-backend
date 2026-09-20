import type { RequestHandler } from "express";
import * as healthService from "../services/health.service";

export const live: RequestHandler = (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

export const ready: RequestHandler = async (_req, res, next) => {
  try {
    const database = await healthService.checkDatabase();

    res.status(database.ok ? 200 : 503).json({
      status: database.ok ? "ok" : "degraded",
      checks: { database },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
