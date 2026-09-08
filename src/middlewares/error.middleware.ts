import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/app.error";

export const errorMiddleware: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Data request tidak valid.",
      errors: error.flatten(),
    });
  }

  console.error(error);

  return res.status(500).json({
    message: "Terjadi kesalahan pada server.",
  });
};
