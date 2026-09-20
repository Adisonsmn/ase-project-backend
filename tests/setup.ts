/**
 * Nilai environment untuk test, dipasang sebelum modul apa pun mengimpor
 * src/config/env.ts. Didaftarkan lewat bunfig.toml (preload).
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_ACCESS_SECRET =
  "test-access-secret-yang-panjangnya-lebih-dari-32-karakter";
process.env.JWT_REFRESH_SECRET =
  "test-refresh-secret-yang-panjangnya-lebih-dari-32-karakter";
process.env.CORS_ORIGIN = "http://localhost:5173";
