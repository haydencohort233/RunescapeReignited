// Shared display formatting — pure functions, no engine dependency, usable
// from any component. Centralized so "how big numbers look" only needs
// tuning in one place as the game's numbers grow.

/** The player's "exact numbers" display setting (lib/preferences.ts):
 *  1,234,567 everywhere instead of 1.23M. Off by default. */
let exactNumbers = false;

export function setExactNumbers(on: boolean): void {
  exactNumbers = on;
}

/** 1,234 stays as-is; 12,340 -> "12.3K"; 1,200,000 -> "1.2M"; etc.
 *  Falls back to plain toLocaleString() below 1000, so it's safe to apply
 *  everywhere uniformly without visually changing small numbers. With
 *  exact numbers on, always the full whole number. */
export function formatNumber(n: number, decimals = 2): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1000 || exactNumbers) return Math.floor(n).toLocaleString();

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

export function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/** XP amounts keep one decimal (bones give 4.5), unlike counts. */
export function formatXp(xp: number): string {
  return xp < 1000 ? xp.toLocaleString(undefined, { maximumFractionDigits: 1 }) : formatNumber(xp);
}
