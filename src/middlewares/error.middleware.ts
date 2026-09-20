import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/app.error";
import { logger } from "../utils/logger";

/**
 * Mengubah ZodError menjadi { "field.path": ["pesan", ...] }.
 * Segmen awal "body" / "params" / "query" dibuang karena itu hanya pembungkus
 * internal dari validateMiddleware, bukan bagian dari payload yang dikirim user.
 */
const formatZodError = (error: ZodError): Record<string, string[]> => {
  const result: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.filter(
      (segment, index) =>
        !(
          index === 0 &&
          (segment === "body" || segment === "params" || segment === "query")
        ),
    );

    const key = path.length > 0 ? path.join(".") : "_";
    (result[key] ??= []).push(issue.message);
  }

  return result;
};

export const notFoundMiddleware: RequestHandler = (req, res) => {
  res.status(404).json({
    message: `Endpoint ${req.method} ${req.path} tidak ditemukan.`,
    requestId: req.requestId,
  });
};

export const errorMiddleware: ErrorRequestHandler = (
  error,
  req,
  res,
  _next,
) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Data request tidak valid.",
      errors: formatZodError(error),
      requestId: req.requestId,
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      requestId: req.requestId,
    });
  }

  logger.error("Unhandled error", error, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  });

  return res.status(500).json({
    message: "Terjadi kesalahan pada server.",
    requestId: req.requestId,
  });
};
