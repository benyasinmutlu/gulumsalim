import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://test:test@127.0.0.1:5432/gulumsalim_test",
      REDIS_URL: "redis://127.0.0.1:6379/15",
      SESSION_SECRET: "test-only-session-secret-32-characters",
      MEILISEARCH_URL: "http://127.0.0.1:7700",
      MEILISEARCH_API_KEY: "test-only",
      DISCOVERY_SERVICE_URL: "http://127.0.0.1:8081",
      DISCOVERY_SERVICE_SECRET: "test-only",
      IYZICO_API_KEY: "sandbox-test",
      IYZICO_SECRET_KEY: "sandbox-test",
      IYZICO_BASE_URL: "https://sandbox-api.iyzipay.com",
      SITE_URL: "http://127.0.0.1:3001",
      UPLOADS_DIR: "./test-uploads",
      SMTP_HOST: "127.0.0.1",
      SMTP_USER: "test-only",
      SMTP_PASS: "test-only",
      SMTP_FROM: "test@example.com",
    },
  },
});
