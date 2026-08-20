import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./auth.module.css";

export interface AuthPerk {
  icon: string; // Font Awesome sınıfı
  label: string;
}

export interface AuthTab {
  label: string;
  href?: string;
  active?: boolean;
}

interface AuthLayoutProps {
  headline: ReactNode; // <em> ile vurgulanabilir
  lede: string;
  perks?: AuthPerk[];
  tabs?: AuthTab[];
  title: string;
  subtitle: string;
  children: ReactNode; // form
  footer?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

// Premium split-screen auth kabuğu (soft-luxury editorial). Sol: marka +
// atmosfer (mesh gradient + grain + orb'lar, staggered reveal). Sağ: form
// kartı. Sunucu bileşeni - form (client) children olarak geçilir.
export default function AuthLayout({
  headline,
  lede,
  perks = [],
  tabs,
  title,
  subtitle,
  children,
  footer,
  backHref = "/",
  backLabel = "Ana Sayfa",
}: AuthLayoutProps) {
  return (
    <div className={styles.shell}>
      <Link href={backHref} className={styles.back}>
        <i className="fas fa-arrow-left" aria-hidden /> {backLabel}
      </Link>

      <aside className={styles.brand}>
        <span className={`${styles.orb} ${styles.orb1}`} aria-hidden />
        <span className={`${styles.orb} ${styles.orb2}`} aria-hidden />
        <div className={styles.brandInner}>
          <Link href="/" className={`${styles.logo} ${styles.reveal}`}>
            <span className={styles.logoMark}>🌸</span>
            <span className={styles.logoName}>Gülüm Şalım</span>
          </Link>
          <h1 className={`${styles.headline} ${styles.reveal}`}>{headline}</h1>
          <p className={`${styles.lede} ${styles.reveal}`}>{lede}</p>
          {perks.length > 0 && (
            <ul className={`${styles.perks} ${styles.reveal}`}>
              {perks.map((perk) => (
                <li key={perk.label} className={styles.perk}>
                  <span className={styles.perkIcon}>
                    <i className={perk.icon} aria-hidden />
                  </span>
                  {perk.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className={styles.panel}>
        <div className={`${styles.card} ${styles.reveal}`}>
          {tabs && tabs.length > 0 && (
            <nav className={styles.tabs}>
              {tabs.map((tab) =>
                tab.href && !tab.active ? (
                  <Link key={tab.label} href={tab.href} className={styles.tab}>
                    {tab.label}
                  </Link>
                ) : (
                  <span key={tab.label} className={`${styles.tab} ${tab.active ? styles.tabActive : ""}`}>
                    {tab.label}
                  </span>
                ),
              )}
            </nav>
          )}
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>{subtitle}</p>
          {children}
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      </main>
    </div>
  );
}
