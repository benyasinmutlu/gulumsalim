// Mesafeli Satış Sözleşmesi + Ön Bilgilendirme Formu'nun gerçek sipariş
// bilgileriyle doldurulmuş HTML çıktısı. Hem checkout önizleme endpoint'i
// (POST /checkout/contract-preview, sipariş oluşmadan) hem gerçek sipariş
// anında (startCheckout, order.contractSnapshot) AYNI fonksiyonu çağırır -
// böylece müşteriye ödeme öncesi gösterilenle DB'ye yazılan birebir aynı
// olur (bkz. plan §2-3). `orderNumber` opsiyonel: önizlemede yok, gerçek
// siparişte var.

const PLATFORM = {
  unvan: "Skywo Group İnşaat Gıda Otomotiv Bilişim Sistemleri ve Uluslararası Ticaret Limited Şirketi",
  marka: "Gülüm Şalım",
  adres: "Sütlüce Mah. Şeker Kuyusu Sk. Gecekondu No:8 Beyoğlu / İstanbul",
  mersis: "0772169957600001",
  ticaretSicil: "1063946 / İstanbul Ticaret Sicil Müdürlüğü",
  vergi: "Kasımpaşa Vergi Dairesi – 7721699576",
  eposta: "info@gulumsalim.com",
  telefon: "+90 535 609 64 68",
};

export interface ContractBuyer {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  district: string;
  addressLine: string;
}

export interface ContractLineItem {
  productNameSnapshot: string;
  unitPrice: string;
  quantity: number;
  total: string;
}

export interface ContractVendorBlock {
  vendorId: number;
  storeName: string;
  taxId: string | null;
  legalAddress: string | null;
  items: ContractLineItem[];
  lineTotal: string;
}

export interface ContractInput {
  buyer: ContractBuyer;
  vendorBlocks: ContractVendorBlock[];
  subtotal: string;
  shippingFee: string;
  total: string;
  orderNumber?: string;
  date: Date;
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function renderVendorBlock(block: ContractVendorBlock, index: number): string {
  const rows = block.items
    .map(
      (item) =>
        `<tr><td style="padding:6px;border:1px solid #e5c9dc;">${esc(item.productNameSnapshot)}</td><td style="padding:6px;border:1px solid #e5c9dc;">${item.quantity}</td><td style="padding:6px;border:1px solid #e5c9dc;">${item.unitPrice} TL</td><td style="padding:6px;border:1px solid #e5c9dc;">${item.total} TL</td></tr>`,
    )
    .join("");
  return `<div style="margin:16px 0;padding:12px;border:1px solid #e5c9dc;border-radius:8px;">
<p style="margin:0 0 8px;"><strong>Satıcı ${index + 1}:</strong> ${esc(block.storeName)}</p>
<p style="margin:0 0 4px;font-size:0.9rem;">Vergi No / MERSİS No: ${block.taxId ? esc(block.taxId) : "—"}</p>
<p style="margin:0 0 8px;font-size:0.9rem;">Adres: ${block.legalAddress ? esc(block.legalAddress) : "—"}</p>
<table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
<thead><tr><th style="text-align:left;padding:6px;border:1px solid #e5c9dc;background:rgba(224,64,160,.06);">Ürün</th><th style="text-align:left;padding:6px;border:1px solid #e5c9dc;background:rgba(224,64,160,.06);">Adet</th><th style="text-align:left;padding:6px;border:1px solid #e5c9dc;background:rgba(224,64,160,.06);">Birim Fiyat</th><th style="text-align:left;padding:6px;border:1px solid #e5c9dc;background:rgba(224,64,160,.06);">Tutar</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="margin:8px 0 0;font-weight:600;">Satıcı Ara Toplamı: ${block.lineTotal} TL</p>
</div>`;
}

export function renderDistanceSalesContract(input: ContractInput): string {
  const { buyer, vendorBlocks, subtotal, shippingFee, total, orderNumber, date } = input;
  const vendorHtml = vendorBlocks.map(renderVendorBlock).join("");

  return `<div style="font-size:0.95rem;line-height:1.7;">
<h3>GÜLÜM ŞALIM MESAFELİ SATIŞ SÖZLEŞMESİ ve ÖN BİLGİLENDİRME FORMU</h3>
<p>${orderNumber ? `Sipariş No: <strong>${esc(orderNumber)}</strong> — ` : ""}Tarih: ${formatDate(date)}</p>

<h4>1. Aracı Hizmet Sağlayıcı (Platform)</h4>
<p>${esc(PLATFORM.unvan)} (${esc(PLATFORM.marka)})<br/>
Adres: ${esc(PLATFORM.adres)}<br/>
Mersis No: ${PLATFORM.mersis} — Ticaret Sicil: ${PLATFORM.ticaretSicil}<br/>
Vergi: ${PLATFORM.vergi}<br/>
E-posta: ${PLATFORM.eposta} — Telefon: ${PLATFORM.telefon}</p>

<h4>2. Alıcı</h4>
<p>${esc(buyer.fullName)}<br/>
Adres: ${esc(buyer.addressLine)}, ${esc(buyer.district)} / ${esc(buyer.city)}<br/>
Telefon: ${esc(buyer.phone)} — E-posta: ${esc(buyer.email)}</p>

<h4>3. Satıcı(lar) ve Sipariş Kalemleri</h4>
${vendorHtml}

<h4>4. Sipariş Özeti</h4>
<p>Ara Toplam: ${subtotal} TL<br/>
Kargo: ${Number(shippingFee) === 0 ? "Ücretsiz" : `${shippingFee} TL`}<br/>
<strong>Genel Toplam: ${total} TL</strong></p>

<h4>5. Cayma Hakkı</h4>
<p>ALICI, Ürünün tesliminden itibaren 14 (on dört) gün içinde, hiçbir gerekçe göstermeksizin cayma hakkına sahiptir. Kozmetik/parfüm, iç giyim-mayo/bikini ve küpe/hijyenik takı gibi bazı kategorilerde sağlık/hijyen gerekçesiyle cayma hakkı bulunmayabilir veya ürün ambalajının açılmamış olması şartı aranır; ayrıntılar için <a href="/iade-sartlari" target="_blank" rel="noopener noreferrer">İptal ve İade Politikası</a>'na bakınız.</p>

<h4>6. Teslimat, Ödeme ve Genel Hükümler</h4>
<p>Ödeme, Platform'un anlaşmalı ödeme kuruluşu altyapısı üzerinden tahsil edilir. Teslimat, yasal 30 (otuz) günlük azami süreyi aşmamak kaydıyla gerçekleştirilir. Detaylar için <a href="/teslimat-politikasi" target="_blank" rel="noopener noreferrer">Teslimat Politikası</a> ve <a href="/on-bilgilendirme-formu" target="_blank" rel="noopener noreferrer">Ön Bilgilendirme Formu</a>'na bakınız. İşbu sözleşmenin tam metni için <a href="/mesafeli-satis-sozlesmesi" target="_blank" rel="noopener noreferrer">Mesafeli Satış Sözleşmesi</a> sayfasını inceleyebilirsiniz.</p>

<p style="margin-top:16px;">ALICI, işbu Mesafeli Satış Sözleşmesi'ni ve Ön Bilgilendirme Formu'nu yukarıdaki gerçek sipariş bilgileriyle okuyup anladığını, sipariş onayı ile bu bilgileri edindiğini ve kabul ettiğini beyan eder.</p>
</div>`;
}
