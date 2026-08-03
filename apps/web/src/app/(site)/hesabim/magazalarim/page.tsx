import Link from "next/link";
import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { FollowedVendor } from "@/lib/types";

export const metadata: Metadata = { title: "Takip Ettiğim Mağazalar | Gülüm Şalım" };

async function getFollowedVendors(): Promise<FollowedVendor[]> {
  try {
    return await apiFetchJson<FollowedVendor[]>("/my/followed-vendors");
  } catch {
    return [];
  }
}

export default async function FollowedVendorsPage() {
  const vendors = await getFollowedVendors();

  return (
    <>
      <div className="account-page-header">
        <div className="account-page-header-icon">
          <i className="fas fa-store" />
        </div>
        <div>
          <h3>Takip Ettiğim Mağazalar</h3>
          <div className="account-page-subtitle">{vendors.length > 0 ? `${vendors.length} mağaza` : "Takip ettiğiniz satıcılar"}</div>
        </div>
      </div>
      {vendors.length === 0 ? (
        <div className="form-card account-empty-state">
          <i className="fas fa-store" />
          <p>Henüz hiçbir mağazayı takip etmiyorsunuz.</p>
          <Link href="/magazalar" className="btn btn-primary btn-sm">
            Mağazaları Keşfet
          </Link>
        </div>
      ) : (
        <div className="store-grid">
          {vendors.map((v) => (
            <Link key={v.id} href={`/${v.storeSlug}`} className="store-card">
              <div className="store-cover">
                <div className="store-avatar">
                  {v.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.logo} alt={v.storeName} />
                  ) : (
                    v.storeName.charAt(0)
                  )}
                </div>
              </div>
              <div className="store-body">
                <div className="store-name">{v.storeName}</div>
                <div className="store-meta">
                  <span>{v.productCount} ürün</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
