import type { RequestHandler } from "express";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Memberi setiap request sebuah id agar log 5xx dapat ditelusuri (NF-07).
 * Jika reverse proxy sudah mengirim X-Request-Id, nilainya dipakai ulang.
 */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incoming === "string" && incoming.length > 0
      ? incoming
      : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};
