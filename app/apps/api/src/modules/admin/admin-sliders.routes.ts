import { FastifyPluginAsync } from "fastify";
import { InvalidImageError, saveImage } from "../../lib/image-upload";
import { deleteSlider, insertSlider, listAllSliders, updateSlider } from "./admin-content.repository";
import { contentIdParamsSchema, createSliderQuerySchema, updateSliderSchema } from "./admin-content.schemas";

const adminSlidersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/sliders", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listAllSliders());
  });

  app.post("/admin/sliders", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { linkUrl, title, subtitle, buttonText, textColor, textPosition } = createSliderQuerySchema.parse(
      request.query,
    );
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
    }
    const buffer = await file.toBuffer();

    try {
      const image = await saveImage("site/sliders", buffer, file.mimetype);
      const existing = await listAllSliders();
      const slider = await insertSlider({
        image,
        linkUrl,
        title,
        subtitle,
        buttonText,
        textColor,
        textPosition,
        sortOrder: existing.length,
      });
      return reply.status(201).send(slider);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return reply.status(400).send({ error: { message: err.message } });
      }
      throw err;
    }
  });

  app.patch("/admin/sliders/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = contentIdParamsSchema.parse(request.params);
    const input = updateSliderSchema.parse(request.body);
    const updated = await updateSlider(id, input);
    if (!updated) {
      return reply.status(404).send({ error: { message: "Slider bulunamadı" } });
    }
    return reply.send(updated);
  });

  app.delete("/admin/sliders/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = contentIdParamsSchema.parse(request.params);
    const deleted = await deleteSlider(id);
    if (!deleted) {
      return reply.status(404).send({ error: { message: "Slider bulunamadı" } });
    }
    return reply.send({ ok: true });
  });
};

export default adminSlidersRoutes;
