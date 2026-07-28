"use client";

import { useState } from "react";

// boot.php'deki hamburger + overlay mobil menü açma/kapama davranışının
// karşılığı - .admin-sidebar-toggle ve .overlay sınıfları CSS'te vardı
// ama hiçbir yerde render edilmiyordu, bu yüzden mobilde sidebar hiç
// açılamıyordu (bkz. re-audit bulgusu).
export default function AdminSidebarToggle() {
  const [open, setOpen] = useState(false);

  function toggle(next: boolean) {
    setOpen(next);
    document.getElementById("adminSidebar")?.classList.toggle("active", next);
  }

  return (
    <>
      <button className="admin-sidebar-toggle" onClick={() => toggle(!open)} aria-label="Menü">
        <i className="fas fa-bars" />
      </button>
      {open && <div className="overlay show" onClick={() => toggle(false)} />}
    </>
  );
}
