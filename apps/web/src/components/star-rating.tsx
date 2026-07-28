export default function StarRating({ value, size = 13 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <span style={{ color: "var(--color-gold)", fontSize: size }}>
      {"★".repeat(rounded)}
      {"☆".repeat(5 - rounded)}
    </span>
  );
}
