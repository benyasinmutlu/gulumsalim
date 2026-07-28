import nodemailer from "nodemailer";
import { env } from "../config/env";

// info@gulumsalim.com kutusu uzerinden STARTTLS ile gonderim - eski
// gulumsalim.com sitesinin hosting'inde zaten var olan bir mail kutusu,
// yeni site de ayni domain'e (gulumsalim.com) tasindigi icin bu kutu
// dogrudan kullaniliyor.
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

export async function sendMail(to: string, subject: string, html: string) {
  await transporter.sendMail({ from: env.SMTP_FROM, to, subject, html });
}
