import { useGame } from "../engine/GameEngineContext";
import type { GameNotification } from "../engine/types";
import RichText from "./Richtext";

function toastClass(n: GameNotification): string {
  if (n.type === "achievement") return "toast toast-achievement";
  if (n.severity === "error") return "toast toast-error";
  if (n.severity === "warning") return "toast toast-warning";
  return "toast";
}

export default function NotificationList({
  filter,
}: {
  /** Only render notifications passing this predicate — used by
   *  NotificationOverlay to split achievements into their own zone. */
  filter?: (n: GameNotification) => boolean;
}) {
  const { engine, notifications } = useGame();
  const visible = filter ? notifications.filter(filter) : notifications;
  if (visible.length === 0) return null;

  return (
    <ul className="toast-list" aria-live="polite">
      {visible
        .slice()
        .reverse()
        .map((n) => (
          <li
            key={n.id}
            className={toastClass(n)}
            onClick={() => engine.notifications.dismiss(n.id)}
            title="Click to dismiss"
          >
            <span>
              {n.type === "achievement" && "🏆 "}
              <RichText text={n.message} />
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                engine.notifications.dismiss(n.id);
              }}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </li>
        ))}
    </ul>
  );
}
