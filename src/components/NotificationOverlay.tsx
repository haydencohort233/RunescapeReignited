import NotificationList from "./NotificationList";

/** Mounted once, outside the tab-switching area, so notifications float
 *  above every view. Achievements get their own bottom-center zone —
 *  visually distinct from the ambient top-right status stream, since an
 *  achievement is a bigger deal than "you made 3 more bows." */
export default function NotificationOverlay() {
  return (
    <>
      <div className="toast-zone toast-zone-top">
        <NotificationList filter={(n) => n.type !== "achievement"} />
      </div>
      <div className="toast-zone toast-zone-bottom">
        <NotificationList filter={(n) => n.type === "achievement"} />
      </div>
    </>
  );
}
