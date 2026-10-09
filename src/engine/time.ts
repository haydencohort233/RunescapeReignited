// Pure time utilities — no engine dependency, same as format.ts/xpCurve.ts.
// UTC-based resets: simplest to reason about, consistent regardless of
// where the player is, and doesn't trust the player's system timezone.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** A monotonically increasing integer — one value per UTC calendar day.
 *  Two timestamps in the same UTC day return the same number; crossing
 *  midnight UTC increments it. Storable as a plain number (fits the
 *  existing numeric `statistics` store) and comparable with `===` — no
 *  date-string parsing needed anywhere that uses this. */
export function getDailyPeriodNumber(now: number): number {
  return Math.floor(now / ONE_DAY_MS);
}

/** Ms remaining until the next UTC-midnight boundary. */
export function getMsUntilNextDailyReset(now: number): number {
  const currentPeriodStart = getDailyPeriodNumber(now) * ONE_DAY_MS;
  const nextPeriodStart = currentPeriodStart + ONE_DAY_MS;
  return nextPeriodStart - now;
}

/** "03:24:21" — for a countdown display. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}