import { enqueueOutbox, getActiveListingsForProduct, getActiveListingsForVariant } from "./inventory-sync.repository";
import { exposedStock, type SalesChannel } from "./inventory-sync";

// Dış kanallara AÇIK edilecek stoktan düşülen güvenlik tamponu. Propagation
// gecikmesinde son ürünü iki yerde birden satmayı önler (bkz. inventory-sync).
const SAFETY_BUFFER = 1;

// Bir ürünün merkez stoğu değiştiğinde, o ürünün AKTİF listing'i olan tüm
// kanallara (tetikleyen kanal hariç) güncel (tamponlanmış) stoğu itmek üzere
// outbox olayları yazar. Worker bunları sırayla push eder. Hiç listing yoksa
// veya hiç kanal yapılandırılmamışsa sessizce hiçbir şey yapmaz (güvenli).
export async function enqueueStockSync(productId: number, currentStock: number, exceptChannel?: SalesChannel): Promise<void> {
  const listings = await getActiveListingsForProduct(productId);
  if (listings.length === 0) return;
  const target = exposedStock(currentStock, SAFETY_BUFFER);
  for (const l of listings) {
    if (exceptChannel && l.channel === exceptChannel) continue;
    await enqueueOutbox(l.id, target);
  }
}

// Varyant-bazlı: bir varyantın stoğu değişince o varyanta bağlı kanal
// listing'lerine (beden/renk satan Trendyol/İkas ilanları) yeni stoğu iter.
export async function enqueueVariantStockSync(variantId: number, currentStock: number, exceptChannel?: SalesChannel): Promise<void> {
  const listings = await getActiveListingsForVariant(variantId);
  if (listings.length === 0) return;
  const target = exposedStock(currentStock, SAFETY_BUFFER);
  for (const l of listings) {
    if (exceptChannel && l.channel === exceptChannel) continue;
    await enqueueOutbox(l.id, target);
  }
}
