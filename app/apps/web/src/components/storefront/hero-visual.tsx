"use client";

import dynamic from "next/dynamic";
import styles from "./storefront.module.css";

// three yalnız istemcide ve hero göründükten sonra yüklenir (ilk bundle'a
// girmez, LCP'yi bloklamaz). Yüklenene kadar atmosferik parıltı zaten görünür.
const HeroGem3D = dynamic(() => import("./hero-gem-3d"), { ssr: false, loading: () => null });

export default function HeroVisual() {
  return (
    <div className={`${styles.heroStageWrap} ${styles.reveal}`}>
      <div className={styles.gemStage}>
        <div className={styles.gemGlow} aria-hidden />
        <div className={styles.gemMount}>
          <HeroGem3D />
        </div>
      </div>
      <div className={styles.heroFloat}>
        <span className={styles.heroFloatIcon}>
          <i className="fas fa-star" />
        </span>
        <div>
          <b>Binlerce mutlu müşteri</b>
          <small>4.8 / 5 memnuniyet</small>
        </div>
      </div>
    </div>
  );
}
