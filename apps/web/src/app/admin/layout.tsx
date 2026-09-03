import "./admin.css";

// gulumsalim.com'daki /admin/* (login + panel) her zaman ayrı bir admin.css
// yükler - müşteri sitesinin (globals.css) tasarımından tamamen bağımsız.
// Next.js route bazlı CSS bölme sayesinde bu dosya sadece /admin/*
// sayfalarında yükleniyor.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-body">
      {children}
    </div>
  );
}
