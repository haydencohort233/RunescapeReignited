import type { GameNotification, NotificationSeverity, NotificationType } from "./types";
import { DEFAULT_NOTIFICATION_DURATIONS } from "./types";

const HISTORY_LIMIT = 200;

/**
 * A simple pub/sub queue. Engine code pushes notifications without knowing
 * anything about how (or whether) they get rendered. UI subscribes.
 *
 * Notifications can auto-dismiss (durationMs) or persist until the player
 * (or code) explicitly dismisses them — see DEFAULT_NOTIFICATION_DURATIONS
 * in types.ts for the default behavior per notification type.
 *
 * `replaceKey` lets a push replace an earlier still-active notification
 * instead of stacking alongside it — e.g. a new "while you were away"
 * summary replaces the previous one, a new "Woodcutting level up! Level 8"
 * replaces "...Level 7" rather than showing both. Scoped per key (an empty
 * Map costs nothing, and there are only ever a handful of distinct keys in
 * use — one per skill, one for offline summaries — so no cleanup needed).
 *
 * History is a separate, append-only log capped at HISTORY_LIMIT — replacing
 * or dismissing a live notification does NOT remove it from history, so
 * "what actually happened" stays reviewable even after the live toast is
 * gone.
 */
export class NotificationQueue {
  private notifications: GameNotification[] = [];
  private history: GameNotification[] = [];
  private listeners = new Set<(notifications: GameNotification[]) => void>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private replaceKeyToId = new Map<string, string>();
  private idCounter = 0;
  private showDevNotifications: boolean;

  constructor(options?: { showDevNotifications?: boolean }) {
    this.showDevNotifications = options?.showDevNotifications ?? false;
  }

  push(
    type: NotificationType,
    message: string,
    opts?: {
      severity?: NotificationSeverity;
      devOnly?: boolean;
      durationMs?: number | null;
      replaceKey?: string;
    }
  ): void {
    const durationMs =
      opts?.durationMs !== undefined ? opts.durationMs : DEFAULT_NOTIFICATION_DURATIONS[type];

    const notification: GameNotification = {
      id: `notif-${Date.now()}-${this.idCounter++}`,
      type,
      severity: opts?.severity ?? "info",
      message,
      timestamp: Date.now(),
      devOnly: opts?.devOnly ?? false,
      durationMs,
    };

    this.history.push(notification);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();

    if (notification.devOnly && !this.showDevNotifications) {
      // Still logged to history/console above, but doesn't emit to
      // subscribers or schedule a timer.
      if (typeof console !== "undefined") {
        console.debug("[dev notification]", notification.message);
      }
      return;
    }

    if (opts?.replaceKey) {
      const existingId = this.replaceKeyToId.get(opts.replaceKey);
      if (existingId) this.dismiss(existingId); // no-op if it already auto-dismissed
      this.replaceKeyToId.set(opts.replaceKey, notification.id);
    }

    this.notifications = [...this.notifications, notification];
    this.emit();

    if (typeof durationMs === "number" && durationMs > 0) {
      const timer = setTimeout(() => this.dismiss(notification.id), durationMs);
      this.timers.set(notification.id, timer);
    }
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.emit();
  }

  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.notifications = [];
    this.emit();
  }

  getAll(): GameNotification[] {
    return this.notifications;
  }

  /** Most-recent-first. Includes dismissed/replaced/expired notifications —
   *  this is the full record, not just what's currently showing. */
  getHistory(): GameNotification[] {
    return [...this.history].reverse();
  }

  subscribe(listener: (notifications: GameNotification[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.notifications);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.notifications);
  }
}