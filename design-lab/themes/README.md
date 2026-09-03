# Gülüm Şalım UI Tema Laboratuvarı

Bu klasör yalnız tasarım yönü seçmek için hazırlanmış, statik ve izole bir prototiptir. Üretim uygulamasına, API'ye veya canlı sunucuya bağlı değildir.

## Sabit kapsam: görsel tema, yeniden yerleşim değil

- Mevcut sayfa yapısı, paneller, yan menüler, navigasyon, butonların konumu ve kullanıcı akışları korunacaktır.
- Yalnızca renk paleti, tipografi, yüzeyler, kart görünümü, kenarlık, gölge, ikon tonu ve loading/empty/error gibi durumların görsel dili değişecektir.
- Bu prototipteki ekran örnekleri yeni bir bilgi mimarisi veya panel düzeni önermez; aynı tema dilinin mevcut bileşenlerde nasıl görüneceğini karşılaştırır.
- Akış güvenliği ve backend hardening çalışmaları tema değişikliğinden ayrı ele alınacak; görünür yerleşim keyfi biçimde değiştirilmeyecektir.

## Güvenli başlangıç noktası

- Canlı kaynakla uzlaştırılmış taban commit: `46d8af9`
- Geri dönüş etiketi: `codex/ui-baseline-20260903`
- Tasarım çalışma dalı: `codex/ui-redesign-lab-20260903`

## Tema seçenekleri

### 1. Fildişi Atelier

Sıcak kırık beyaz, siyah ve çok sınırlı bronz tonlarla editoryal butik hissi. Farklı kalitedeki ürün fotoğraflarını iyi taşır, alışveriş dönüşümü ve uzun form akışları için en güvenli seçenektir.

### 2. Noir Gallery

Sinematik siyah kabuk, açık metin ve platin vurgu. Premium koleksiyon ve kampanya sahnelerinde güçlüdür; tüm checkout ve yönetim ekranlarına yayılırsa günlük kullanımda yorucu olabilir.

### 3. Swiss Moda

Yüksek kontrast, keskin grid, düşük radius ve sınırlı bordo vurgu. Katalog, filtre, tablo ve yönetim ekranlarında çok güçlü; Fildişi kadar sıcak değildir.

## Önerilen sentez

Ana marka ve müşteri deneyimi için **Fildişi Atelier**, katalog/form/admin yoğunluğu için **Swiss Moda disiplini**, yalnız seçili premium kampanya alanları için sınırlı **Noir Gallery** kullanımı.

## Çalıştırma

Bu klasörde herhangi bir statik HTTP sunucusu başlatın. Örnek:

```powershell
python -m http.server 4175 --bind 127.0.0.1
```

Ardından `http://127.0.0.1:4175/` adresini açın. Üstteki üç düğme aynı içerik üzerinde temalar arasında geçiş yapar.

## Uygulama sırası

1. Tema seçimini ve semantik token sözleşmesini kesinleştir.
2. Mevcut Button, Input, Select, Modal, Drawer, Badge, ProductCard, Table ve StatePanel yapılarına ortak tema katmanını uygula.
3. Kritik müşteri akışlarının mevcut yerleşiminde tema tutarlılığını sağla: header/arama, liste/filtre, ürün detayı, sepet/checkout, üyelik.
4. Bireysel ürün girişi, kurumsal toplu yükleme/AI/feed, mağaza vitrini ve kampanyaların mevcut düzenini koruyarak görsel temayı uygula.
5. Satıcı ve admin panellerinin mevcut bilgi mimarisini ve kontrollerini koruyarak aynı tema ailesine geçir.
6. Loading/empty/error durumları, erişilebilirlik, responsive ve görsel regresyon testlerini release kapısına bağla.

## Tema bağımsız release blocker'ları

- Checkout sözleşme kabulünü son sepet/adres/veri sürümüne bağlama.
- Checkout başlangıcına idempotency anahtarı ekleme.
- Ödeme sonucu ekranında geçici API hatasını ödeme başarısızlığı saymama.
- IBAN değişimi ve hakediş için ek kimlik doğrulama ve bekleme/güvenlik bildirimi.
- Eksik medya veya zorunlu alanlarla ürünün yayına alınmasını merkezi policy ile engelleme.
- Gerçek loading/empty/error ayrımı, şifre sıfırlama hata doğruluğu, admin RBAC ve çoklu yönetici güvenliği.
- Deterministik masaüstü ve mobil E2E testlerini CI release kapısına ekleme.
