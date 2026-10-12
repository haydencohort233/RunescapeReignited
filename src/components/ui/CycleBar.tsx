import { useEffect, useState } from "react";

/** Progress through the item currently being made (one log burning, one
 *  tree being chopped), filling once per `timePerItemMs`. Animated in CSS
 *  from where it is right now, so it moves smoothly between the game's
 *  once-a-second updates, and restarts exactly when the next item starts
 *  rather than on the next update. `maxIndex` stops it at the last item
 *  of a batch. */
export function CycleBar({
  startedAt,
  timePerItemMs,
  maxIndex = Infinity,
}: {
  startedAt: number;
  timePerItemMs: number;
  maxIndex?: number;
}) {
  const [, rerender] = useState(0);
  const elapsed = Date.now() - startedAt;
  const itemIndex = Math.max(0, Math.min(maxIndex, Math.floor(elapsed / timePerItemMs)));

  // Wake up when this item ends, so the next one's fill starts on time.
  useEffect(() => {
    if (itemIndex >= maxIndex) return;
    const untilNext = startedAt + (itemIndex + 1) * timePerItemMs - Date.now();
    const timer = window.setTimeout(() => rerender((n) => n + 1), Math.max(0, untilNext) + 5);
    return () => window.clearTimeout(timer);
  }, [startedAt, timePerItemMs, itemIndex, maxIndex]);

  return (
    <div className="progress-track cycle-track" aria-hidden="true">
      <CycleFill key={`${startedAt}:${timePerItemMs}:${itemIndex}`} startedAt={startedAt} timePerItemMs={timePerItemMs} itemIndex={itemIndex} />
    </div>
  );
}

/** One item's fill. Its starting point is read once, when it mounts: the
 *  animation then runs on its own clock. Recomputing the delay on every
 *  re-render moved an animation that was already running, so it ran at
 *  double speed and jumped to the end. */
function CycleFill({ startedAt, timePerItemMs, itemIndex }: { startedAt: number; timePerItemMs: number; itemIndex: number }) {
  const [into] = useState(() => Math.max(0, Date.now() - startedAt - itemIndex * timePerItemMs));
  return (
    <div
      className="progress-fill cycle-fill"
      style={{
        animationDuration: `${timePerItemMs}ms`,
        animationDelay: `-${Math.min(into, timePerItemMs)}ms`,
      }}
    />
  );
}
