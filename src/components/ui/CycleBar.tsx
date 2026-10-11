/** Progress through the item currently being made (one log burning, one
 *  tree being chopped), filling once per `timePerItemMs`. Animated in CSS
 *  from where it is right now, so it moves smoothly between the game's
 *  once-a-second updates; `itemIndex` restarts it for the next item. */
export function CycleBar({
  startedAt,
  timePerItemMs,
  itemIndex,
}: {
  startedAt: number;
  timePerItemMs: number;
  itemIndex: number;
}) {
  const into = Math.max(0, Date.now() - startedAt - itemIndex * timePerItemMs);
  return (
    <div className="progress-track cycle-track" aria-hidden="true">
      <div
        key={itemIndex}
        className="progress-fill cycle-fill"
        style={{
          animationDuration: `${timePerItemMs}ms`,
          animationDelay: `-${Math.min(into, timePerItemMs)}ms`,
        }}
      />
    </div>
  );
}
