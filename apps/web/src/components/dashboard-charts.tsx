"use client";

import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailySalesPoint, OrderStatusCount } from "@/lib/types";

const PIE_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#22c55e", "#e23b52", "#64748b"];

function formatDayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
}

function formatTl(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ₺";
}

// bkz. kullanıcı isteği (mockup): "satış grafiği" - satıcı raporlar
// sayfasındaki (reports-view.tsx) elle çizilmiş div bar grafiğin aksine,
// burada gerçek bir kütüphane (recharts) kullanılıyor - hem satıcı hem admin
// panelinde aynı bileşen, sadece renk parametreyle özelleştiriliyor (iki
// panel de farklı CSS değişken isim uzayı kullanıyor: --pr vs --admin-primary).
export function SalesLineChart({ data, color = "#151515" }: { data: DailySalesPoint[]; color?: string }) {
  const chartData = data.map((d) => ({ date: formatDayLabel(d.date), total: Number(d.total) }));
  const hasSales = chartData.some((d) => d.total > 0);

  if (!hasSales) {
    return (
      <div className="empty">
        <i className="fas fa-chart-line" />
        <p>Son 30 günde henüz ödemesi tamamlanmış bir satış yok.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d8d5ce" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 12 }} width={70} tickFormatter={(v) => formatTl(Number(v))} />
        <Tooltip
          formatter={(value) => [Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺", "Satış"]}
        />
        <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// bkz. kullanıcı isteği: "günlük tekil ziyaretçi sayısı (bugün/son 7 gün)" -
// SalesLineChart ile aynı desen, para birimi yerine düz sayı formatlanır.
export function VisitorsLineChart({ data, color = "#0ea5e9" }: { data: { date: string; count: number }[]; color?: string }) {
  const chartData = data.map((d) => ({ date: formatDayLabel(d.date), count: d.count }));
  const hasVisitors = chartData.some((d) => d.count > 0);

  if (!hasVisitors) {
    return (
      <div className="empty">
        <i className="fas fa-users" />
        <p>Son 7 günde henüz ziyaretçi verisi yok.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d8d5ce" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} width={40} allowDecimals={false} />
        <Tooltip formatter={(value) => [value, "Ziyaretçi"]} />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function OrderStatusPieChart({ data, statusLabels }: { data: OrderStatusCount[]; statusLabels: Record<string, string> }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="empty">
        <i className="fas fa-chart-pie" />
        <p>Henüz sipariş yok.</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({ name: statusLabels[d.status] ?? d.status, value: d.count }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={85}
          isAnimationActive={false}
          label={(entry) => `${entry.name}: ${entry.value}`}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
