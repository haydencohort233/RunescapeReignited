import NotificationList from "./NotificationList";

/** Mounted once, outside the tab-switching area, so notifications float
 *  above every view. Status toasts stack up from the bottom-right corner,
 *  clear of the player sidebar when it's open. Achievements get their own
 *  zone at the top center, clear of that stack, since an
 *  achievement is a bigger deal than "you made 3 more bows." */
export default function NotificationOverlay() {
  return (
    <>
      <div className="toast-zone toast-zone-status">
        <NotificationList filter={(n) => n.type !== "achievement"} />
      </div>
      <div className="toast-zone toast-zone-achievement">
        <NotificationList filter={(n) => n.type === "achievement"} />
      </div>
    </>
  );
}
