"use client";

// Kayıt formlarındaki zorunlu sözleşme onayının (checkbox yerine) kart
// görünümü - müşteri/satıcı kaydında 3 yerde (kayıt, satıcı kaydı,
// bireysel satıcı ol) aynı tasarım tekrar ediyor.
export default function ConsentDocumentCard({
  label,
  accepted,
  onOpen,
}: {
  label: string;
  accepted: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        border: `1px solid ${accepted ? "rgba(46,125,50,.3)" : "rgba(224,64,160,.2)"}`,
        borderRadius: 12,
        background: accepted ? "rgba(46,125,50,.05)" : "rgba(224,64,160,.04)",
      }}
    >
      <i
        className={accepted ? "fas fa-circle-check" : "far fa-file-lines"}
        style={{ fontSize: 22, color: accepted ? "#2e7d32" : "var(--color-primary)" }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-light)" }}>
          {accepted ? "Okudum, onayladım" : "Devam etmek için okuyup onaylamalısınız"}
        </div>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onOpen} style={{ whiteSpace: "nowrap" }}>
        {accepted ? "Tekrar Görüntüle" : "İncele ve Onayla"}
      </button>
    </div>
  );
}
