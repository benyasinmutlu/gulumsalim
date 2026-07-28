import { refundPayment } from "../orders/iyzico.client";
import { commitRefundRelease, getRefundForRelease, MissingPaymentInfoError } from "./admin-refunds.repository";

export class RefundApiError extends Error {}

// bkz. kullanıcı isteği: "ürün satıcıya teslim edildiğinden emin
// olduğumuzda müşteriye parasını iade edeceğiz" - dış API çağrısı (iyzico)
// bilerek DB transaction'ının DIŞINDA yapılır (bkz. admin-refunds.
// repository.ts commitRefundRelease yorumu): önce gerçek para iadesi
// başarıyla tamamlanır, SONRA veritabanı bunu yansıtır. Tersi sıralama
// (önce DB, sonra iyzico) tutarsız bir duruma yol açardı - iyzico çağrısı
// başarısız olsa bile veritabanı "iade edildi" derdi.
export async function releaseRefund(refundId: number, adminIp: string) {
  const info = await getRefundForRelease(refundId);

  let result;
  try {
    result = await refundPayment({ paymentId: info.paymentTransactionId, price: info.itemTotal, ip: adminIp });
  } catch {
    throw new RefundApiError("Ödeme sağlayıcısına ulaşılamadı, lütfen birazdan tekrar deneyin");
  }
  if (result.status !== "success") {
    throw new RefundApiError(result.errorMessage ?? "İade işlemi başarısız oldu");
  }

  return commitRefundRelease(info.refundId, info.orderItemId, info.vendorId, info.vendorNetEarning);
}

export { MissingPaymentInfoError };
