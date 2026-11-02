# PTT Kargo entegrasyonu işletim notu

## Yapılandırma

Kimlik bilgileri repoya yazılmaz. API servisinin secret ortamında aşağıdaki
değerler tanımlanır:

```dotenv
PTT_ENV=test
PTT_CUSTOMER_ID=...
PTT_PASSWORD=...
PTT_TIMEOUT_MS=15000
PTT_TRACKING_POLL_INTERVAL_MS=900000
```

Test kabulü ve PTT onayı tamamlandıktan sonra yalnız `PTT_ENV=production`
değiştirilir. Test ve production servis adresleri uygulama içinde HTTPS olarak
ayrılmıştır.

## Güvenli gönderi akışı

1. Ödeme kesinleşince sipariş ve satıcı bazında tek `shipment` oluşturulur.
2. Satıcı gönderim profili ve alıcı snapshot'ı doğrulanır.
3. PTT'ye her gönderi için sabit ve benzersiz müşteri referansı verilir. PTT
   kabul ekibinin önerisine uygun olarak referans yalnız ASCII harf ve rakamdan
   oluşur; tire, boşluk veya başka noktalama işareti kullanılmaz.
4. `kabulEkle2` başarılıysa barkod shipment ve sipariş kalemlerine yazılır.
5. Ağ zaman aşımı gibi sonucu belirsiz bir hata olursa kayıt otomatik tekrar
   gönderilmez; `registration_pending` durumuna alınır ve referansla sorgulanır.
6. Takip worker'ı barkod/referansla PTT hareketlerini günceller. PTT cevabı
   finansal hakedişi tek başına serbest bırakmaz; mevcut teslimat/ödeme kontrolü
   korunur.

İstek, PTT sözleşmesindeki alan sınırlarını dış çağrıdan önce doğrular. Gönderici
ülke kodu Türkiye için sabit `052`, ödeme şekli sözleşmeli mahsup için `MH` ve
telefonlar baştaki `0` olmadan 10 hanedir. Ürün ağırlık/ölçüleri varsayılan paket
bilgisidir; satıcı sipariş ekranında paketlenmiş gerçek ölçülerle değiştirebilir.

## Ücret ayrımı

Admin paneldeki **Platform Kargo Bedeli / Satıcı**, müşterinin checkout'ta
ödediği pazaryeri bedelidir ve satıcı başına uygulanır. Bu değer PTT tarifesi
değildir. `kabulEkle2` sözleşmesindeki `ucret` alanı opsiyoneldir ve PTT gerçek
taşıma ücretini kabul anında kendi sözleşmesi, tartım ve ölçümüne göre yeniden
hesaplar; bu nedenle uygulama PTT'ye uydurma bir ücret göndermez. PTT sözleşmeli
fiyatını checkout'ta kullanmak istenirse PTT'den ayrı bir canlı fiyat servisi ve
fiyat mutabakatı alınmalıdır.

PTT'nin ek dokümanındaki `referansVeriSil` çağrısı client katmanında bulunur.
Yalnız hatalı yüklenmiş ve PTT tarafından fiziksel kabulü henüz yapılmamış veri
içindir; sipariş iptalini otomatik olarak dış servise taşımak güvenli olmadığı
için operasyon akışına otomatik bağlanmamıştır.

## Test ortamı doğrulaması

Secret'lar shell ortamında tanımlıyken:

```powershell
pnpm --filter @gulumsalim/api ptt:verify:test
```

Script yalnız test ortamında çalışır ve çıktı olarak PTT'ye iletilecek referans
ile barkodu verir. Şifreyi veya tam SOAP gövdesini loglamaz.

## Operasyonel durumlar

- `not_registered`: PTT çağrısı yapılmadı.
- `registering`: Tek kabul çağrısı çalışıyor.
- `registration_pending`: Dış çağrının sonucu belirsiz; tekrar POST edilmeden
  referansla uzlaştırılıyor.
- `registration_failed`: PTT kesin bir doğrulama hatası döndürdü; veri
  düzeltildikten sonra yeniden denenebilir.
- `registered` / `tracking` / `delivered`: PTT barkodu hazır ve takip ediliyor.

`provider_last_error` alanı yalnız güvenli hata kodu/açıklaması tutar; PTT
parolası, SOAP istek gövdesi veya müşteri secret'ı saklanmaz.
