// vendors.commissionRate ayarlanmamışsa (null) kullanılan platform
// varsayılan komisyon oranı (%). Satıcıya özel bir oran admin panelden
// atanmışsa bu değeri hiç etkilemez - sadece override'sız satıcılar için
// geçerlidir. vendor-orders.service.ts ve vendor-finance.repository.ts
// bu değeri bağımsız bağımsız tanımlıyordu (bkz. kullanıcı isteği:
// "komisyon oranını %5'ten %10'a çıkaralım"), tek kaynağa çıkarıldı.
export const DEFAULT_COMMISSION_RATE = 10;
