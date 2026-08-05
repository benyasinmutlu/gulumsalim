import { Queue } from "bullmq";
import { createQueueConnection } from "./connection";

// Kuyruk adları tek yerde (worker + üretici aynı adı kullanır).
export const QUEUE_BULK_IMPORT = "bulk-import";

// Toplu içe-aktarma işi: satıcı + kanonik satırlar (parse edilmiş). Worker
// bunları importRows ile DB'ye yazar. Büyük dosyalar isteği bloklamaz.
export interface BulkImportJobData {
  vendorId: number;
  rows: Record<string, string>[];
}

// Lazy singleton - ilk kullanımda bağlanır (import anında Redis'e bağlanmaz).
let bulkImportQueue: Queue<BulkImportJobData> | null = null;
export function getBulkImportQueue(): Queue<BulkImportJobData> {
  if (!bulkImportQueue) {
    bulkImportQueue = new Queue<BulkImportJobData>(QUEUE_BULK_IMPORT, {
      connection: createQueueConnection(),
      defaultJobOptions: {
        // Başarılı işleri 1 saat, başarısızları 24 saat tut (durum sorgulanabilsin),
        // sonra otomatik temizle - Redis şişmesin.
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
      },
    });
  }
  return bulkImportQueue;
}
