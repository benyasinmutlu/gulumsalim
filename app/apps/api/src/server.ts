import { buildApp } from "./app";
import { env } from "./config/env";
import { ensureProductsIndex } from "./lib/meilisearch";

const app = buildApp();

// Meilisearch geçici olarak erişilemez olsa bile API ayağa kalkmalı -
// index ayarları bir sonraki başarılı çağrıda yine uygulanabilir.
ensureProductsIndex().catch((err) => app.log.warn({ err }, "Meilisearch index ayarları uygulanamadı"));

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
