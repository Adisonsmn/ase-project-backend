import type { RequestHandler } from "express";
import type { z } from "zod";

type ValidatedRequest = {
  body?: unknown;
  params?: unknown;
  query?: unknown;
};

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

    const data = result.data as ValidatedRequest;

    if (data.body !== undefined) {
      req.body = data.body;
    }

    // req.params dan req.query di Express 5 adalah getter-only, jadi hasil
    // parsing disimpan terpisah dan dibaca controller lewat req.validated.
    req.validated = data;

    next();
  };
};
