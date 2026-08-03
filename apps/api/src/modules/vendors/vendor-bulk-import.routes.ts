import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { detectImportColumns, importProductsFromCsv, importProductsFromFile, type ColumnMapping } from "./vendor-bulk-import.service";

const mappingSchema = z
  .object({
    name: z.string(),
    basePrice: z.string(),
    categorySlug: z.string(),
    description: z.string(),
    brand: z.string(),
    compareAtPrice: z.string(),
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
    const { csvText, dryRun, mapping } = pasteImportSchema.parse(request.body);
    const results = await importProductsFromCsv(request.session.vendorId!, csvText, dryRun ?? false, mapping);
    return reply.status(dryRun ? 200 : 201).send({ results, dryRun: dryRun ?? false });
  });
};

export default vendorBulkImportRoutes;
