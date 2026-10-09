import NotificationList from "./NotificationList";

/** Mounted once, outside the tab-switching area, so notifications float
 *  above every view (not just the Game tab). Achievements get their own
 *  bottom-center zone — visually distinct from the ambient top-right
 *  status stream, since an achievement is a bigger deal than "you made 3
 *  more bows." */
export default function NotificationOverlay() {
  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          width: 320,
          maxHeight: "80vh",
          overflowY: "auto",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <NotificationList filter={(n) => n.type !== "achievement"} />
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          width: 360,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <NotificationList filter={(n) => n.type === "achievement"} />
        </div>
      </div>
    </>
  );
}