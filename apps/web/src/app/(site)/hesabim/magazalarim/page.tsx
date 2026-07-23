import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { FollowedVendor } from "@/lib/types";

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
    <div className="form-card">
      <h3>Takip Ettiğim Mağazalar</h3>
      {vendors.length === 0 ? (
        <p style={{ fontSize: "0.9rem" }}>Henüz hiçbir mağazayı takip etmiyorsunuz.</p>
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
    </div>
  );
}
