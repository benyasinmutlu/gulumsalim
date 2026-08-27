import { buildApp } from "./app";
import { env } from "./config/env";
import { ensureProductsIndex } from "./lib/meilisearch";
import { startBulkImportWorker, stopBulkImportWorker } from "./lib/queue/workers/bulk-import.worker";
import { startOutboxDrainer, stopOutboxDrainer } from "./modules/integrations/outbox-drainer";
import { startReconcileJob, stopReconcileJob } from "./modules/integrations/reconcile.job";
import { startMerchantFeedScheduler, stopMerchantFeedScheduler } from "./modules/integrations/merchant-feed.scheduler";
import { startOrderReconciliationJob } from "./modules/orders/order-reconciliation.scheduler";

const app = buildApp();

// Toplu içe-aktarma worker'ı (in-process): kuyruğa düşen büyük import işlerini
// arka planda işler. API restart'ında BullMQ işleri Redis'ten devam ettirir.
startBulkImportWorker();

// Stok senkron outbox drainer (in-process, interval): merkez stok değişince
// yazılan olayları kanallara (İkas/Trendyol) push eder. Anahtar yoksa bekletir.
startOutboxDrainer();

// Periyodik mutabakat (30 dk): kanal stoklarını merkezle karşılaştırıp kaçan
// senkronu düzeltir. Anahtar yoksa no-op (yapılandırılmamış kanalı atlar).
startReconcileJob();

// Resmi XML/CSV/JSON katalog kaynaklarini kosullu HTTP + lease ile ceker.
// Kaynak yoksa no-op; bozuk/bayat feed stoklari guvenli bicimde sifirlar.
startMerchantFeedScheduler(app.log);

// Meilisearch geçici olarak erişilemez olsa bile API ayağa kalkmalı -
// index ayarları bir sonraki başarılı çağrıda yine uygulanabilir.
ensureProductsIndex().catch((err) => app.log.warn({ err }, "Meilisearch index ayarları uygulanamadı"));

// Varsayılan loopback bind: API dış interface'e açılmaz (nginx zaten 127.0.0.1
// üzerinden proxy yapıyor). Defense-in-depth; gerekirse API_HOST ile değiştirilir.
const host = process.env.API_HOST ?? "127.0.0.1";

let orderReconcileJob: { stop: () => void } | null = null;

app
  .listen({ port: env.PORT, host })
  .then(() => {
    orderReconcileJob = startOrderReconciliationJob(app);
  })
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
    stopOutboxDrainer();
    stopReconcileJob();
    stopMerchantFeedScheduler();
    orderReconcileJob?.stop();
    Promise.all([app.close(), stopBulkImportWorker()])
      .then(() => {
        clearTimeout(timer);
        process.exit(0);
      })
      .catch(() => process.exit(1));
  });
}
