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
3. PTT'ye her gönderi için sabit ve benzersiz müşteri referansı verilir.
4. `kabulEkle2` başarılıysa barkod shipment ve sipariş kalemlerine yazılır.
5. Ağ zaman aşımı gibi sonucu belirsiz bir hata olursa kayıt otomatik tekrar
   gönderilmez; `registration_pending` durumuna alınır ve referansla sorgulanır.
6. Takip worker'ı barkod/referansla PTT hareketlerini günceller. PTT cevabı
   finansal hakedişi tek başına serbest bırakmaz; mevcut teslimat/ödeme kontrolü
   korunur.

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
