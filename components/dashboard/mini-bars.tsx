// Twelve monthly totals as tiny bars. Months from `changeMonth` on are drawn in
// the accent color. The text alternative lists every month and amount.

export function MiniBars({
  monthly,
  changeMonth,
  label,
  lang,
  width = 84,
  height = 28,
}: {
  monthly: { month: string; cents: number }[];
  changeMonth: string | null;
  label: string;
  lang: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...monthly.map((m) => m.cents), 1);
  const gap = 2;
  const bw = (width - gap * (monthly.length - 1)) / monthly.length;
  const fmt = new Intl.DateTimeFormat(lang, { month: "short", year: "numeric", timeZone: "UTC" });
  const desc = monthly
    .map((m) => `${fmt.format(new Date(`${m.month}-01T00:00:00Z`))}: $${(m.cents / 100).toFixed(2)}`)
    .join(", ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}. ${desc}`} className="shrink-0">
      {monthly.map((m, i) => {
        const h = m.cents ? Math.max(2, Math.round((m.cents / max) * (height - 2))) : 1;
        const changed = changeMonth !== null && m.month >= changeMonth;
        return (
          <rect
            key={m.month}
            x={i * (bw + gap)}
            y={height - h}
            width={bw}
            height={h}
            rx={1}
            fill={m.cents ? (changed ? "var(--accent)" : "var(--muted)") : "var(--line)"}
            opacity={m.cents && !changed ? 0.55 : 1}
          />
        );
      })}
    </svg>
  );
}
