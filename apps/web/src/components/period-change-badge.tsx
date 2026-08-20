// bkz. kullanıcı isteği (mockup): istatistik kartlarının yanında "+12,6%"
// gibi bir önceki 30 güne göre değişim yüzdesi - null ise (önceki dönemde
// hiç veri yoksa, ya da hesaplanamayan bir metrikse) HİÇBİR ŞEY render
// edilmez, uydurma bir "%0" gösterilmez.
export default function PeriodChangeBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const isUp = value >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        fontWeight: 700,
        color: isUp ? "var(--color-success, #0ba36b)" : "var(--color-error, #e23b52)",
      }}
    >
      <i className={`fas fa-arrow-${isUp ? "up" : "down"}`} />
      {isUp ? "+" : ""}
      {value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  );
}
