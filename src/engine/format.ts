// Shared display formatting — pure functions, no engine dependency, usable
// from any component. Centralized so "how big numbers look" only needs
// tuning in one place as the game's numbers grow.

/** 1,234 stays as-is; 12,340 -> "12.3K"; 1,200,000 -> "1.2M"; etc.
 *  Falls back to plain toLocaleString() below 1000, so it's safe to apply
 *  everywhere uniformly without visually changing small numbers. */
export function formatNumber(n: number, decimals = 2): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1000) return Math.floor(n).toLocaleString();

  const units: { value: number; suffix: string }[] = [
    { value: 1e12, suffix: "T" },
    { value: 1e9, suffix: "B" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "K" },
  ];
  for (const unit of units) {
    if (abs >= unit.value) {
      const scaled = (abs / unit.value).toFixed(decimals).replace(/\.?0+$/, "");
      return `${sign}${scaled}${unit.suffix}`;
    }
  }
  return n.toLocaleString();
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}