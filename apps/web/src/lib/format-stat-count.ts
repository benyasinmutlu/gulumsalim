// bkz. denetim raporu madde 4: gerçek /site-stats sayısını AŞAĞI yuvarlar,
// asla olduğundan büyük göstermez - "500+" iddiası her zaman doğru kalır.
// Sunucu (lib/site-stats.ts) VE istemci bileşenlerinden ortak kullanılır,
// bu yüzden next/headers'a bağımlı hiçbir şey import etmez.
export function formatStatCount(n: number): string {
  if (n <= 0) return "0";
  if (n < 10) return String(n);
  let floor: number;
  if (n < 100) floor = Math.floor(n / 10) * 10;
  else if (n < 1000) floor = Math.floor(n / 50) * 50;
  else if (n < 10000) floor = Math.floor(n / 100) * 100;
  else floor = Math.floor(n / 1000) * 1000;
  return `${floor.toLocaleString("tr-TR")}+`;
}
