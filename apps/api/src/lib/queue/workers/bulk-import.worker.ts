import { Worker, type Job } from "bullmq";
import { createQueueConnection } from "../connection";
import { QUEUE_BULK_IMPORT, type BulkImportJobData } from "../queues";
import { importRows, type CanonicalField } from "../../../modules/vendors/vendor-bulk-import.service";

// Toplu içe-aktarma worker'ı (in-process, app boot'ta başlatılır). Kuyruğa
// düşen işleri sırayla işler; DB insert'leri burada olur, HTTP isteği beklemez.
// concurrency=2: aynı anda en fazla 2 iş (DB'yi boğmadan makul paralellik).
let worker: Worker<BulkImportJobData> | null = null;

export function startBulkImportWorker(): Worker<BulkImportJobData> {
  if (worker) return worker;
  worker = new Worker<BulkImportJobData>(
    QUEUE_BULK_IMPORT,
    async (job: Job<BulkImportJobData>) => {
      const { vendorId, rows, enrichMissing } = job.data;
      const results = await importRows(vendorId, rows as Record<CanonicalField, string>[], enrichMissing === true);
      const created = results.filter((r) => r.status === "created").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      return { total: results.length, created, skipped, results };
    },
    { connection: createQueueConnection(), concurrency: 2 },
  );

  worker.on("failed", (job, err) => {
    // Basit hata logu (pino app logger'ı worker kapsamında yok - stderr yeter).
    console.error(`[bulk-import worker] job ${job?.id} başarısız:`, err?.message);
  });

  return worker;
}

export async function stopBulkImportWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
