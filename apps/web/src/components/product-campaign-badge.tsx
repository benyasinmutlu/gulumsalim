"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { bestCampaignForProduct } from "@/lib/campaign-match";
import type { ActiveCampaign } from "@/lib/types";

let campaignsPromise: Promise<ActiveCampaign[]> | null = null;

function getCampaigns(): Promise<ActiveCampaign[]> {
  campaignsPromise ??= fetchJson<ActiveCampaign[]>("/campaigns").catch(() => []);
  return campaignsPromise;
}

export default function ProductCampaignBadge({
  productId,
  categorySlug,
  vendorSlug,
  detail = false,
}: {
  productId: number;
  categorySlug: string;
  vendorSlug: string;
  detail?: boolean;
}) {
  const [campaign, setCampaign] = useState<ActiveCampaign | null>(null);

  useEffect(() => {
    let active = true;
    getCampaigns().then((campaigns) => {
      if (active) setCampaign(bestCampaignForProduct(campaigns, { id: productId, categorySlug, vendorSlug }));
    });
    return () => {
      active = false;
    };
  }, [productId, categorySlug, vendorSlug]);

  if (!campaign) return null;
  if (detail) {
    return (
      <div className="detail-campaign-note">
        <span className="badge badge-campaign">SEPETTE %{campaign.value} KAMPANYA</span>
        {campaign.minOrderAmount !== null && (
          <small>Minimum {campaign.minOrderAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ sepet tutarında geçerlidir.</small>
        )}
      </div>
    );
  }
  return <span className="badge badge-campaign">%{campaign.value} KAMPANYA</span>;
}
