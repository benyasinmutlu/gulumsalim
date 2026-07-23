"use client";

import { useState } from "react";
import StoreLayoutForm from "./store-layout-form";
import SlidesManager from "./slides-manager";
import SocialPostsManager from "./social-posts-manager";
import StorePreview from "./store-preview";

export default function VendorStoreLayoutPage() {
  const [refreshToken, setRefreshToken] = useState(0);
  const bump = () => setRefreshToken((n) => n + 1);

  return (
    <div className="store-layout-grid" style={{ display: "grid", gridTemplateColumns: "1fr 560px", gap: 20, alignItems: "start" }}>
      <div className="fc" style={{ gap: 20, minWidth: 0 }}>
        <StoreLayoutForm onSaved={bump} />
        <SlidesManager onSaved={bump} />
        <SocialPostsManager onSaved={bump} />
      </div>
      <StorePreview refreshToken={refreshToken} />
    </div>
  );
}
