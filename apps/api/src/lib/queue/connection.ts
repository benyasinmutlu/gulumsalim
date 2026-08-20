import { Redis } from "ioredis";
import { env } from "../../config/env";

// BullMQ için ioredis bağlantısı. Worker'lar blocking komut (BRPOPLPUSH vb.)
// kullandığı için `maxRetriesPerRequest: null` ZORUNLU (aksi halde BullMQ hata
// verir). Mevcut REDIS_URL yeniden kullanılır - ayrı Redis sunucusu gerekmez.
export function createQueueConnection(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
