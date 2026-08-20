import Link from "next/link";
import type { CampaignVendor } from "@/lib/types";

export default function CampaignVendorsSection({ vendors }: { vendors: CampaignVendor[] }) {
  if (vendors.length === 0) return null;

  return (
    <section className="popular-vendors-section">
      <div className="container">
        <div className="section-header section-header-flex">
          <h2 className="section-title">Kampanyalı Mağazalar</h2>
          <Link href="/kampanyalar" className="section-cta">Tümünü Gör</Link>
        </div>
        <div className="popular-vendors-row hscroll">
          {vendors.map((vendor) => (
            <Link key={vendor.vendorId} href={`/${vendor.storeSlug}`} className="popular-vendor-card" title={vendor.campaignName}>
              <div className="popular-vendor-avatar">
                {vendor.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vendor.logo} alt={vendor.storeName} />
                ) : vendor.storeName.charAt(0)}
              </div>
              <span className="popular-vendor-name">{vendor.storeName}</span>
              <span className="campaign-vendor-badge">{vendor.campaignLabel}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
