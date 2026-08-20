import { refundItemPayment, refundPayment, verifyRefundSignature } from "../orders/iyzico.client";
import { claimRefundForRelease, commitRefundRelease, resetRefundReleaseClaim, MissingPaymentInfoError } from "./admin-refunds.repository";

export class RefundApiError extends Error {}

// bkz. kullanıcı isteği: "ürün satıcıya teslim edildiğinden emin
// olduğumuzda müşteriye parasını iade edeceğiz" - dış API çağrısı (iyzico)
// bilerek DB transaction'ının DIŞINDA yapılır (bkz. admin-refunds.
// repository.ts commitRefundRelease yorumu): önce gerçek para iadesi
// başarıyla tamamlanır, SONRA veritabanı bunu yansıtır. Tersi sıralama
// (önce DB, sonra iyzico) tutarsız bir duruma yol açardı - iyzico çağrısı
// başarısız olsa bile veritabanı "iade edildi" derdi.
export async function releaseRefund(refundId: number, adminIp: string) {
  const info = await claimRefundForRelease(refundId);

  let result;
  try {
    result = info.refundTarget.mode === "item"
      ? await refundItemPayment({ paymentTransactionId: info.refundTarget.id, price: info.itemTotal, ip: adminIp })
      : await refundPayment({ paymentId: info.refundTarget.id, price: info.itemTotal, ip: adminIp });
  } catch {
    // iyzico iade servisleri idempotent degildir. Ag hatasinda istegin bankada
    // islenip islenmedigi bilinemez; otomatik tekrar cift iadeye yol acabilecegi
    // icin kayit 'refunding' kalir ve saglayici panelinde kontrol gerekir.
    throw new RefundApiError("İade sonucu belirsiz. Tekrar denemeden önce iyzico panelinden işlemi kontrol edin.");
  }
  if (result.status !== "success") {
    if (result.retryable === true) await resetRefundReleaseClaim(info.refundId);
    throw new RefundApiError(result.errorMessage ?? "İade işlemi başarısız oldu");
  }
  if (!verifyRefundSignature(result)) {
    throw new RefundApiError("İade yanıtının imzası doğrulanamadı. iyzico panelinden işlemi kontrol edin.");
  }

  return commitRefundRelease(info.refundId, info.orderItemId, info.vendorId, info.vendorNetEarning);
}

export { MissingPaymentInfoError };
