import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { importProductsFromCsv } from "./vendor-bulk-import.service";

const pasteImportSchema = z.object({ csvText: z.string().min(1) });

const vendorBulkImportRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/vendor/products/bulk-import",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: { message: "CSV dosyası bulunamadı" } });
      }
      const buffer = await file.toBuffer();
      const csvText = buffer.toString("utf-8");
      const results = await importProductsFromCsv(request.session.vendorId!, csvText);
      return reply.status(201).send({ results });
    },
  );

  // vendor/bulk-import.php'deki "Excel'den kopyala-yapıştır" yönteminin
  // karşılığı - dosya yerine ham CSV/TSV metni JSON body ile gönderilir,
  // aynı ayrıştırma/ekleme mantığını (importProductsFromCsv) kullanır.
  app.post(
    "/vendor/products/bulk-import/paste",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { csvText } = pasteImportSchema.parse(request.body);
      const results = await importProductsFromCsv(request.session.vendorId!, csvText);
      return reply.status(201).send({ results });
    },
  );
};

export default vendorBulkImportRoutes;
