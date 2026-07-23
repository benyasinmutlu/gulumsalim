"use client";

import { useState } from "react";

// vendor/boot.php'deki hamburger + overlay mobil menü açma/kapama
// davranışının karşılığı - .hamburger ve .overlay sınıfları CSS'te vardı
// ama hiçbir yerde render edilmiyordu, bu yüzden mobilde sidebar hiç
// açılamıyordu (bkz. re-audit bulgusu).
export default function VendorSidebarToggle() {
  const [open, setOpen] = useState(false);

  function toggle(next: boolean) {
    setOpen(next);
    document.getElementById("vendorSidebar")?.classList.toggle("open", next);
  }

  return (
    <>
      <button className="hamburger" onClick={() => toggle(!open)} aria-label="Menü">
        <i className="fas fa-bars" />
      </button>
      {open && <div className="overlay open" onClick={() => toggle(false)} />}
    </>
  );
}
