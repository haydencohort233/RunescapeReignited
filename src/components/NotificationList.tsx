import { useGame } from "../engine/GameEngineContext";
import type { GameNotification } from "../engine/types";
import RichText from "./Richtext";

export default function NotificationList({
  filter,
}: {
  /** Only render notifications passing this predicate — used by
   *  NotificationOverlay to split achievements into their own zone. */
  filter?: (n: GameNotification) => boolean;
}) {
  const { engine, notifications } = useGame();
  const visible = filter ? notifications.filter(filter) : notifications;

  return (
    <ul style={{ listStyle: "none", padding: 0, fontSize: 14, margin: 0 }}>
      {visible
        .slice()
        .reverse()
        .map((n) => (
          <li
            key={n.id}
            onClick={() => engine.notifications.dismiss(n.id)}
            title="Click to dismiss"
            style={{
              padding: "6px 8px",
              marginBottom: 4,
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              background:
                n.type === "achievement"
                  ? "#fff8e1"
                  : n.severity === "error"
                    ? "#fee2e2"
                    : n.severity === "warning"
                      ? "#fef3c7"
                      : "#e0f2fe",
              border: n.type === "achievement" ? "1px solid #d4af37" : undefined,
            }}
          >
            <span>
              {n.type === "achievement" && "🏆 "}
              <RichText text={n.message} />
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                engine.notifications.dismiss(n.id);
              }}
              aria-label="Dismiss notification"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: "2px 4px",
              }}
            >
              ×
            </button>
          </li>
        ))}
    </ul>
  );
}