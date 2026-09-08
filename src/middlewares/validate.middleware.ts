import type { RequestHandler } from "express";
import type { z } from "zod";

export const validateMiddleware = (schema: z.ZodType): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });
    if (!result.success) {
      return next(result.error);
    }
    req.body = (result.data as { body: unknown }).body;
    next();
  };
};
