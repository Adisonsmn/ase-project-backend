import { Router } from "express";
import { buildOpenApiDocument } from "../docs/openapi";

const router = Router();

// Dibangun sekali saat modul dimuat; schema tidak berubah saat runtime.
const document = buildOpenApiDocument();

router.get("/openapi.json", (_req, res) => {
  res.status(200).json(document);
});

const SCALAR_CDN = "https://cdn.jsdelivr.net";

router.get("/", (_req, res) => {
  // Helmet memasang CSP default yang memblokir script dari CDN. Halaman ini
  // hanya memuat viewer dokumentasi, jadi CSP-nya dilonggarkan khusus di sini
  // dan tidak memengaruhi endpoint lain.
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${SCALAR_CDN}`,
      `style-src 'self' 'unsafe-inline' ${SCALAR_CDN}`,
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      "connect-src 'self'",
    ].join("; "),
  );

  res.status(200).type("html").send(`<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Edukasi Literasi Keuangan</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="${SCALAR_CDN}/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '/api/v1/docs/openapi.json',
      });
    </script>
  </body>
</html>`);
});

export default router;
