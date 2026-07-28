"use client";

export default function LegalPagePrintButton() {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={() => window.print()}
      style={{ whiteSpace: "nowrap" }}
    >
      <i className="fas fa-print" /> Yazdır
    </button>
  );
}
