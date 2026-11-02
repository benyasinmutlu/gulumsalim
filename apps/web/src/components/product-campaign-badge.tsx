"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { bestCampaignForProduct } from "@/lib/campaign-match";
import type { ActiveCampaign } from "@/lib/types";

const CAMPAIGN_CACHE_TTL_MS = 60_000;
let campaignsPromise: Promise<ActiveCampaign[]> | null = null;
let campaignsCache: { value: ActiveCampaign[]; expiresAt: number } | null = null;

function getCampaigns(): Promise<ActiveCampaign[]> {
  if (campaignsCache && campaignsCache.expiresAt > Date.now()) return Promise.resolve(campaignsCache.value);
  campaignsPromise ??= fetchJson<ActiveCampaign[]>("/campaigns")
    .then((value) => {
      campaignsCache = { value, expiresAt: Date.now() + CAMPAIGN_CACHE_TTL_MS };
      return value;
    })
    .catch(() => [])
    .finally(() => {
      campaignsPromise = null;
    });
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
    const refresh = () => {
      getCampaigns().then((campaigns) => {
        if (active) setCampaign(bestCampaignForProduct(campaigns, { id: productId, categorySlug, vendorSlug }));
      });
    };
    refresh();
    const timer = window.setInterval(refresh, CAMPAIGN_CACHE_TTL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
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
