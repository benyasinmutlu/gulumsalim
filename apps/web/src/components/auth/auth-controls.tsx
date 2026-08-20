"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import styles from "./auth.module.css";

interface AuthFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  icon?: string; // Font Awesome sınıfı, ör. "fas fa-envelope"
  type?: "text" | "email" | "tel" | "password";
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: "text" | "email" | "tel" | "numeric" | "search";
  extra?: ReactNode; // input altında (ör. "Şifremi Unuttum?")
}

// Kendi göster/gizle durumunu yöneten kontrollü input. type="password"
// olduğunda otomatik olarak göz ikonu toggle'ı gösterir.
export function AuthField({
  label,
  value,
  onValueChange,
  icon,
  type = "text",
  required,
  minLength,
  autoComplete,
  placeholder,
  inputMode,
  extra,
}: AuthFieldProps) {
  const isPassword = type === "password";
  const [show, setShow] = useState(false);
  const effectiveType = isPassword ? (show ? "text" : "password") : type;

  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label} {required && <span className={styles.req}>*</span>}
      </label>
      <div className={styles.inputWrap}>
        {icon && <i className={`${icon} ${styles.inputIcon}`} aria-hidden />}
        <input
          className={`${styles.input} ${icon ? "" : styles.noIcon}`}
          type={effectiveType}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          inputMode={inputMode}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.pwToggle}
            onClick={() => setShow((v) => !v)}
            aria-label="Şifreyi göster/gizle"
          >
            <i className={show ? "fas fa-eye-slash" : "fas fa-eye"} aria-hidden />
          </button>
        )}
      </div>
      {extra && <div className={styles.fieldExtra}>{extra}</div>}
    </div>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className={styles.row2}>{children}</div>;
}

export function AuthSectionTitle({ children }: { children: ReactNode }) {
  return <div className={styles.sectionTitle}>{children}</div>;
}

export function AuthAlert({ children, variant = "error" }: { children: ReactNode; variant?: "error" | "success" }) {
  return (
    <div className={`${styles.alert} ${variant === "success" ? styles.alertSuccess : ""}`} role="alert">
      <i className={variant === "success" ? "fas fa-check-circle" : "fas fa-exclamation-circle"} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function AuthSubmit({
  loading,
  loadingLabel,
  children,
}: {
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}) {
  return (
    <button type="submit" className={styles.submit} disabled={loading}>
      {loading && <span className={styles.spinner} aria-hidden />}
      {loading ? loadingLabel ?? "Gönderiliyor..." : children}
    </button>
  );
}

export function AuthConsent({
  checked,
  onCheckedChange,
  children,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className={styles.consent}>
      <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.link}>
      {children}
    </Link>
  );
}
