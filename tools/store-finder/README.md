# Mağaza Bulucu (Store Finder)

Satıcı kazanımı için işletme iletişim bilgisi toplama araçları.

## İki ayrı iş var

| Aşama | Ne | Durum |
|-------|-----|-------|
| **1. Zenginleştirme** (harvest) | Elindeki site/alan adı listesinden e-posta + telefon + IG handle çıkar | ✅ **Çalışıyor** (`harvest-contacts.mjs`) |
| **2. Keşif** (discovery) | Sıfırdan yeni butik/mağaza BUL | ⚠️ Kaynağa göre — aşağıya bak |

## 1. Zenginleştirme — bugün kullanılabilir

```bash
node harvest-contacts.mjs seeds.txt > sonuc.csv
node harvest-contacts.mjs seeds.txt --delay 800 --timeout 12000
```

`seeds.txt`: her satıra bir site/alan adı (`http` olmasa da olur, `#` yorum).
Çıktı CSV: `seed, domain, emails, phones, instagram, status`. Sıfır bağımlılık
(Node 18+). Ana sayfa + `/iletisim`, `/contact`, `/hakkimizda`… sayfalarını
kibarca tarar, mailto öncelikli e-posta çıkarır, çöp adresleri (görsel/örnek/
izleme) eler.

## 2. Keşif — kaynak seçimi (dürüst değerlendirme)

- **Google Places API (önerilen, yasal):** "kadın giyim butik <şehir>" gibi
  aramalarla işletme adı/site/telefon döndürür → çıktısını `harvest`'e ver.
  API key gerekir (ücretli, cömert ücretsiz kota). En sağlam yol.
- **Instagram:** butikler çoğunlukla burada AMA scraping ToS ihlali + login
  duvarı + IP ban riski taşır; kalıcı/güvenilir bir crawler kırılgandır.
  Güvenli kullanım: elle/yarı-otomatik profil linklerini toplayıp (bio'daki
  site linkiyle) `harvest`'e vermek. Otomatik toplu IG kazıma önerilmez.
- **Manuel liste:** Pazar yerleri, kategori dizinleri, kendi araştırman →
  site listesini `seeds.txt`'e koy, `harvest` zenginleştirsin. En düşük risk.

## Yasal (önemli)

Toplanan iletişim bilgisi işletmelerin KENDİ sitesinde açıkça yayınladığıdır.
Ticari e-posta göndermek Türkiye'de **İYS + KVKK**'ya tabidir: tacir/esnafa ön
onaysız gönderebilirsin ama **her iletide opt-out (ret hakkı) + İYS kaydı**
zorunlu. robots.txt / ToS'a saygı göster, agresif tarama yapma.

## Sonraki adım (istenirse)
- Google Places keşif modülü (`discover-places.mjs`) — key verilince.
- Çıktıyı doğrudan bir "outreach" tablosuna yazma + gönderim takibi (opt-out).
