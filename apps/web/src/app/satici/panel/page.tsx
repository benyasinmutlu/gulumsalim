import { apiFetchJson } from "@/lib/api";
import type { VendorWallet } from "@/lib/types";

function tl(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

export default async function VendorDashboardPage() {
  const wallet = await apiFetchJson<VendorWallet>("/vendor/wallet");

  return (
    <div>
      <div className="stat-cards">
        <div className="stat-card">
          <div className="label">Kullanılabilir Bakiye</div>
          <div className="value">{tl(wallet.walletBalance)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Toplam Ciro</div>
          <div className="value">{tl(wallet.totalGross)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Toplam Net Kazanç</div>
          <div className="value">{tl(wallet.totalNet)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Ödenen Toplam</div>
          <div className="value">{tl(wallet.totalPaidOut)}</div>
        </div>
      </div>
    </div>
  );
}
