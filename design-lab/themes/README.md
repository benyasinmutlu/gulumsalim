# Gülüm Şalım UI Tema Laboratuvarı

Bu klasör yalnız tasarım yönü seçmek için hazırlanmış, statik ve izole bir prototiptir. Üretim uygulamasına, API'ye veya canlı sunucuya bağlı değildir.

## Sabit kapsam: görsel tema, yeniden yerleşim değil

- Mevcut sayfa yapısı, paneller, yan menüler, navigasyon, butonların konumu ve kullanıcı akışları korunacaktır.
- Yalnızca renk paleti, yüzey, kenarlık, gölge, ikon tonu ve loading/empty/error gibi durumların görsel dili değişecektir.
- Üç seçenekte de tipografi, radius, spacing, panel/navigasyon yapısı ve tüm bileşen geometrisi birebir aynıdır.
- Ürün görsellerine renk filtresi uygulanmaz; ürünün gerçek rengi korunur.
- Bu prototipteki ekran örnekleri yeni bir bilgi mimarisi veya panel düzeni önermez; aynı tema dilinin mevcut bileşenlerde nasıl görüneceğini karşılaştırır.
- Akış güvenliği ve backend hardening çalışmaları tema değişikliğinden ayrı ele alınacak; görünür yerleşim keyfi biçimde değiştirilmeyecektir.

## Güvenli başlangıç noktası

- Canlı kaynakla uzlaştırılmış taban commit: `46d8af9`
- Geri dönüş etiketi: `codex/ui-baseline-20260903`
- Tasarım çalışma dalı: `codex/ui-redesign-lab-20260903`

## Tema seçenekleri

### 1. Sıcak Fildişi

Sıcak kırık beyaz, yumuşak kömür siyahı ve ölçülü taş vurgularıyla samimi bir butik hissi. Uzun süre gezinirken gözü yormaz; müşteri deneyimi için en dengeli seçenektir.

### 2. Kaşmir

Daha krem bir zemin, sıcak grej yüzeyler ve kahve alt tonlu koyu nötrler. Üçlü içinde en yumuşak ve ev sıcaklığına en yakın seçenektir.

### 3. Galeri

Daha açık beyaz yüzeyler, net siyah ve hafif sıcak gri çizgiler. Ürün görsellerini öne çıkaran, en sade ve moda galerisi hissi veren seçenektir.

## Önerilen sentez

İlk değerlendirme için **Sıcak Fildişi** önde: şıklık ve samimiyet dengesini en iyi kuruyor. **Kaşmir** daha sıcak, **Galeri** ise daha net ve minimal bir alternatif sunuyor. Son karar bütün kritik ekranlar aynı paletle görüldükten sonra verilecek.

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
