"use client";

import { useEffect, useState } from "react";

interface Props {
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  className?: string;
  onChange?: () => void;
}

// bkz. kullanıcı isteği: "admin panel ve satıcı panelinde tüm görseller
// kaydedilmeden önce önizlemesi olsun" - cihazdan seçilen dosyanın
// object URL'i anında (hiçbir yükleme/onaya gönderme olmadan) gösterilir.
// Mevcut form kodları dosyaya `inputRef.current.files` ile eriştiği için
// (kontrolsüz input deseni), bu bileşen sadece görsel katman ekler,
// gönderim mantığını değiştirmez.
export default function ImageDropPreview({ inputRef, label, hint, accept, multiple, className = "file-drop", onChange }: Props) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange() {
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    const files = inputRef.current?.files;
    if (!files || files.length === 0) {
      setPreviewUrls([]);
    } else {
      setPreviewUrls(Array.from(files).map((f) => URL.createObjectURL(f)));
    }
    onChange?.();
  }

  return (
    <div className={className}>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={handleChange} />
      {previewUrls.length === 0 ? (
        <>
          <i className="fas fa-image" />
          <p>{label}</p>
          {hint && <small>{hint}</small>}
        </>
      ) : (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          {previewUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt="Önizleme"
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(0,0,0,.08)" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
