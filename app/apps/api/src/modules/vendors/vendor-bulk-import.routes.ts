import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  detectImportColumns,
  importProductsFromCsv,
  importProductsFromFile,
  parseFileToRows,
  MAX_ASYNC_IMPORT_ROWS,
  type ColumnMapping,
} from "./vendor-bulk-import.service";
import { getBulkImportQueue } from "../../lib/queue/queues";

const mappingSchema = z
  .object({
    name: z.string(),
    basePrice: z.string(),
    categorySlug: z.string(),
    description: z.string(),
    brand: z.string(),
    compareAtPrice: z.string(),
    stock: z.string(),
    sizes: z.string(),
  })
  .partial();

const pasteImportSchema = z.object({ csvText: z.string().min(1), dryRun: z.boolean().optional(), mapping: mappingSchema.optional() });

function q(query: unknown, key: string): string | undefined {
  return (query as Record<string, string | undefined> | undefined)?.[key];
}

function parseMappingParam(raw: string | undefined): ColumnMapping | undefined {
  if (!raw) return undefined;
  try {
    return mappingSchema.parse(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

const vendorBulkImportRoutes: FastifyPluginAsync = async (app) => {
  // CSV / TSV / Excel(.xlsx) / JSON / JSONL. Sütunlar TR/EN takma adlarıyla
  // otomatik eşlenir; ?detect=1 dosyadaki HAM sütunları + otomatik tahmini
  // döner (frontend eşleme ekranı için, hiçbir şey eklenmez). ?mapping=<json>
  // kullanıcının seçtiği eşlemeyi (kanonik->ham başlık) uygular - böylece
  // alışılmadık sütun adları da içe aktarılabilir. ?dryRun=1 önizleme.
  app.post("/vendor/products/bulk-import", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: { message: "Dosya bulunamadı" } });
    }
    const buffer = await file.toBuffer();
    try {
      if (q(request.query, "detect") === "1") {
        return reply.status(200).send(await detectImportColumns(buffer, file.filename));
      }
      const dryRun = q(request.query, "dryRun") === "1";
      const mapping = parseMappingParam(q(request.query, "mapping"));
      const results = await importProductsFromFile(request.session.vendorId!, buffer, file.filename, dryRun, mapping);
      return reply.status(dryRun ? 200 : 201).send({ results, dryRun });
    } catch (err) {
      return reply.status(400).send({ error: { message: err instanceof Error ? err.message : "Dosya işlenemedi" } });
    }
  });

  app.post("/vendor/products/bulk-import/paste", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const parsed = pasteImportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { message: "Geçersiz istek: yapıştırılan tablo verisi boş olamaz." } });
    }
    const { csvText, dryRun, mapping } = parsed.data;
    try {
      const results = await importProductsFromCsv(request.session.vendorId!, csvText, dryRun ?? false, mapping);
      return reply.status(dryRun ? 200 : 201).send({ results, dryRun: dryRun ?? false });
    } catch (err) {
      return reply.status(400).send({ error: { message: err instanceof Error ? err.message : "Veri işlenemedi" } });
    }
  });

  // ASYNC toplu içe-aktarma (yüklü dosyalar için): dosyayı parse edip kuyruğa
  // koyar, hemen jobId döner. Worker arka planda işler - HTTP isteği beklemez.
  app.post("/vendor/products/bulk-import/async", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: { message: "Dosya bulunamadı" } });
    const buffer = await file.toBuffer();
    try {
      const mapping = parseMappingParam(q(request.query, "mapping"));
      const rows = await parseFileToRows(buffer, file.filename, mapping);
      if (rows.length === 0) return reply.status(400).send({ error: { message: "Dosyada satır bulunamadı" } });
      if (rows.length > MAX_ASYNC_IMPORT_ROWS)
        return reply.status(400).send({ error: { message: `En fazla ${MAX_ASYNC_IMPORT_ROWS} satır yüklenebilir (dosyada ${rows.length}).` } });
      const job = await getBulkImportQueue().add("import", { vendorId: request.session.vendorId!, rows });
      return reply.status(202).send({ jobId: job.id, total: rows.length });
    } catch (err) {
      return reply.status(400).send({ error: { message: err instanceof Error ? err.message : "Dosya işlenemedi" } });
    }
  });

  // İş durumu (satıcıya özel). state: waiting|active|completed|failed; tamamlanınca sonuç döner.
  app.get("/vendor/products/bulk-import/status/:jobId", { preHandler: app.requireVendor }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = await getBulkImportQueue().getJob(jobId);
    if (!job || job.data.vendorId !== request.session.vendorId) {
      return reply.status(404).send({ error: { message: "İş bulunamadı" } });
    }
    const state = await job.getState();
    return reply.send({ jobId: job.id, state, total: job.data.rows.length, result: job.returnvalue ?? null });
  });
};

export default vendorBulkImportRoutes;
