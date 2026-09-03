import Link from "next/link";
import styles from "./storefront.module.css";

// Storefront bölüm başlığı: eyebrow + editoryal başlık + opsiyonel alt metin +
// "Tümünü gör" CTA. Tüm vitrin bölümlerinde tutarlı hiyerarşi için.
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  ctaHref,
  ctaLabel = "Tümünü gör",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className={styles.head}>
      <div className={styles.headText}>
        {eyebrow && <div className={styles.headEyebrow}>{eyebrow}</div>}
        <h2 className={styles.headTitle}>{title}</h2>
        {subtitle && <p className={styles.headSub}>{subtitle}</p>}
      </div>
      {ctaHref && (
        <Link href={ctaHref} className={styles.headCta}>
          {ctaLabel} <i className="fas fa-arrow-right" />
        </Link>
      )}
    </div>
  );
}
