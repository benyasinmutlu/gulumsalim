#!/usr/bin/env node
// Mağaza bulucu — İLETİŞİM TOPLAYICI (contact harvester).
//
// Girdi: işletme web siteleri / alan adları (satır satır bir dosya). Her site
// için ana sayfa + olası iletişim sayfalarını çeker, e-posta / telefon /
// Instagram handle çıkarır, tekilleştirir, outreach için CSV üretir.
//
// Bağımlılık YOK (Node 18+ yerleşik fetch). Kibarca (rate-limit + timeout) tarar.
//
// Kullanım:
//   node harvest-contacts.mjs seeds.txt > sonuc.csv
//   node harvest-contacts.mjs seeds.txt --delay 800 --timeout 12000
//
// YASAL NOT: Bu araç yalnızca işletmelerin KENDİ sitelerinde AÇIKÇA yayınladığı
// iletişim bilgisini toplar. Türkiye'de ticari e-posta göndermek İYS + KVKK'ya
// tabidir (tacir/esnafa ön onaysız gönderilebilir ama opt-out + İYS kaydı şart).
// robots.txt / ToS'a saygı gösterin, agresif taramayın.

import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

// --- argümanlar ---
const args = process.argv.slice(2);
const seedFile = args.find((a) => !a.startsWith("--"));
const getOpt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const DELAY_MS = Number(getOpt("delay", "700"));
const TIMEOUT_MS = Number(getOpt("timeout", "12000"));

if (!seedFile) {
  console.error("Kullanım: node harvest-contacts.mjs <seeds.txt> [--delay 700] [--timeout 12000]");
  process.exit(1);
}

// Olası iletişim sayfaları (TR + EN). Ana sayfada e-posta yoksa denenir.
const CONTACT_PATHS = ["", "/iletisim", "/iletisim-bilgileri", "/contact", "/contact-us", "/hakkimizda", "/about", "/kurumsal"];

// Çöp/teknik e-postaları ele (görsel adları, örnek adresler, izleme servisleri).
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JUNK_EMAIL = /(sentry|wixpress|example\.|@2x|\.png|\.jpg|\.gif|\.webp|\.svg|your-email|domain\.com|email@)/i;
// TR telefon: 0(5xx)/+90 5xx ... ve sabit hatlar.
const PHONE_RE = /(?:\+?90[\s.-]?)?0?\s?\(?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
const IG_RE = /instagram\.com\/([A-Za-z0-9_.]+)/g;

function normalizeUrl(raw) {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; GulumSalimContactBot/1.0)" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function extract(html) {
  const emails = new Set();
  const phones = new Set();
  const instagrams = new Set();
  // mailto: öncelikli (en güvenilir)
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) emails.add(m[1].toLowerCase());
  for (const m of html.matchAll(EMAIL_RE)) if (!JUNK_EMAIL.test(m[0])) emails.add(m[0].toLowerCase());
  for (const m of html.matchAll(PHONE_RE)) phones.add(m[0].replace(/[\s.()-]/g, ""));
  for (const m of html.matchAll(IG_RE)) {
    const h = m[1];
    if (h && !["p", "reel", "explore", "accounts"].includes(h)) instagrams.add(h);
  }
  return { emails, phones, instagrams };
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function processSite(seed) {
  const base = normalizeUrl(seed);
  if (!base) return { seed, domain: "", emails: "", phones: "", instagram: "", status: "geçersiz-url" };

  const all = { emails: new Set(), phones: new Set(), instagrams: new Set() };
  let reached = false;

  for (const path of CONTACT_PATHS) {
    const url = new URL(path, base).href;
    const html = await fetchText(url);
    await sleep(DELAY_MS);
    if (!html) continue;
    reached = true;
    const found = extract(html);
    found.emails.forEach((e) => all.emails.add(e));
    found.phones.forEach((p) => all.phones.add(p));
    found.instagrams.forEach((i) => all.instagrams.add(i));
    // E-posta bulduysak erken çık (kibar tarama).
    if (all.emails.size > 0 && path !== "") break;
  }

  return {
    seed,
    domain: base.hostname.replace(/^www\./, ""),
    emails: [...all.emails].join(" | "),
    phones: [...all.phones].join(" | "),
    instagram: [...all.instagrams].slice(0, 3).join(" | "),
    status: !reached ? "ulaşılamadı" : all.emails.size ? "e-posta-bulundu" : "e-posta-yok",
  };
}

async function main() {
  const raw = await readFile(seedFile, "utf-8");
  const seeds = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  // CSV başlık
  const cols = ["seed", "domain", "emails", "phones", "instagram", "status"];
  console.log(cols.join(","));

  let done = 0;
  const summary = { "e-posta-bulundu": 0, "e-posta-yok": 0, "ulaşılamadı": 0, "geçersiz-url": 0 };
  for (const seed of seeds) {
    const row = await processSite(seed);
    summary[row.status] = (summary[row.status] || 0) + 1;
    console.log(cols.map((c) => csvCell(row[c])).join(","));
    done++;
    process.stderr.write(`\r[${done}/${seeds.length}] ${row.domain || seed} -> ${row.status}            `);
  }
  process.stderr.write(
    `\n\nÖzet: ${summary["e-posta-bulundu"]} e-posta bulundu, ${summary["e-posta-yok"]} sitede yok, ` +
      `${summary["ulaşılamadı"]} ulaşılamadı, ${summary["geçersiz-url"]} geçersiz.\n`,
  );
}

main().catch((e) => {
  console.error("Hata:", e.message);
  process.exit(1);
});
