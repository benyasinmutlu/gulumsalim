import { buildApp } from "./app";
import { env } from "./config/env";
import { ensureProductsIndex } from "./lib/meilisearch";
import { startBulkImportWorker, stopBulkImportWorker } from "./lib/queue/workers/bulk-import.worker";

const app = buildApp();

// Toplu içe-aktarma worker'ı (in-process): kuyruğa düşen büyük import işlerini
// arka planda işler. API restart'ında BullMQ işleri Redis'ten devam ettirir.
startBulkImportWorker();

// Meilisearch geçici olarak erişilemez olsa bile API ayağa kalkmalı -
// index ayarları bir sonraki başarılı çağrıda yine uygulanabilir.
ensureProductsIndex().catch((err) => app.log.warn({ err }, "Meilisearch index ayarları uygulanamadı"));

// Varsayılan loopback bind: API dış interface'e açılmaz (nginx zaten 127.0.0.1
// üzerinden proxy yapıyor). Defense-in-depth; gerekirse API_HOST ile değiştirilir.
const host = process.env.API_HOST ?? "127.0.0.1";

app
  .listen({ port: env.PORT, host })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

// Graceful shutdown: systemd restart/stop SIGTERM gönderir; in-flight istekleri
// tamamlayıp Fastify'ı (onClose hook'larıyla birlikte) düzgün kapatır.
let shuttingDown = false;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ sig }, "graceful shutdown başladı");
    const timer = setTimeout(() => process.exit(1), 10_000).unref();
    Promise.all([app.close(), stopBulkImportWorker()])
      .then(() => {
        clearTimeout(timer);
        process.exit(0);
      })
      .catch(() => process.exit(1));
  });
}
