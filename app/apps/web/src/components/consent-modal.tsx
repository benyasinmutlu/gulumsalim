"use client";

import { useEffect, useRef, useState } from "react";
import { ClientApiError, fetchJson } from "@/lib/client-api";
import Modal from "./modal";

interface CmsPageLite {
  slug: string;
  title: string;
  content: string;
}

// Yasal olarak zorunlu onaylarda (müşteri Üyelik Sözleşmesi+KVKK, satıcı
// 4 belge) düz bir checkbox+link yeterli değil - kullanıcı belgeyi gerçekten
// GÖRMELİ. Bu modal belgeleri çeker, kullanıcı en alta kadar kaydırmadan
// "Okudum, Onaylıyorum" butonu aktif olmaz (bkz. kullanıcı isteği).
export default function ConsentModal({
  open,
  onClose,
  onAccept,
  title,
  slugs,
}: {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  title: string;
  slugs: string[];
}) {
  const [pages, setPages] = useState<CmsPageLite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setPages(null);
    setError(null);
    setScrolledToBottom(false);
    Promise.all(slugs.map((slug) => fetchJson<CmsPageLite>(`/pages/${slug}`)))
      .then(setPages)
      .catch((err) => setError(err instanceof ClientApiError ? err.message : "Belge yüklenemedi, lütfen tekrar deneyin"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!pages) return;
    const el = contentRef.current;
    if (!el) return;
    // İçerik kaydırma gerektirmeyecek kadar kısaysa (ör. küçük ekran
    // dışında zaten tamamı görünüyorsa) baştan okunmuş sayılır.
    if (el.scrollHeight <= el.clientHeight + 4) setScrolledToBottom(true);
  }, [pages]);

  function handleScroll() {
    const el = contentRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setScrolledToBottom(true);
  }

  function handleAccept() {
    onAccept();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div
        ref={contentRef}
        onScroll={handleScroll}
        style={{
          maxHeight: "55vh",
          overflowY: "auto",
          paddingRight: 10,
          marginBottom: 16,
          borderBottom: "1px solid rgba(0,0,0,.08)",
        }}
      >
        {error && <p className="error-text">{error}</p>}
        {!error && !pages && (
          <p style={{ fontSize: 13, color: "var(--color-text-light)", textAlign: "center", padding: "20px 0" }}>Yükleniyor...</p>
        )}
        {pages?.map((page, i) => (
          <div key={page.slug} style={{ marginBottom: i < pages.length - 1 ? 28 : 8 }}>
            <h3 style={{ marginBottom: 10 }}>{page.title}</h3>
            <div
              style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-text-light)" }}
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          </div>
        ))}
      </div>

      {pages && !scrolledToBottom && (
        <p style={{ fontSize: 12, color: "var(--color-text-light)", textAlign: "center", marginBottom: 10 }}>
          <i className="fas fa-arrow-down" /> Onaylamak için belgeyi sonuna kadar okuyun
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!scrolledToBottom}
        onClick={handleAccept}
      >
        Okudum, Onaylıyorum
      </button>
    </Modal>
  );
}
