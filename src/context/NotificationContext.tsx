import {
  createContext,
  useContext,
  createSignal,
  onCleanup,
  type Component,
  type JSX,
} from "solid-js";
import type {
  Notification,
  NotificationSeverity,
} from "@/types/notification";

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS: Record<NotificationSeverity, number | null> = {
  info: 3000,
  success: 3000,
  warning: 6000,
  error: null,
};

interface NotificationContextValue {
  notifications: () => Notification[];
  notify: (
    severity: NotificationSeverity,
    title: string,
    opts?: { message?: string; action?: Notification["action"] },
  ) => void;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue>();

export const NotificationProvider: Component<{ children: JSX.Element }> = (
  props,
) => {
  const [notifications, setNotifications] = createSignal<Notification[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const recentKeys = new Map<string, number>();

  const scheduleDismiss = (id: string, severity: NotificationSeverity) => {
    const ms = AUTO_DISMISS_MS[severity];
    if (ms === null) return;
    const handle = setTimeout(() => dismiss(id), ms);
    timers.set(id, handle);
  };

  const dismiss = (id: string) => {
    const timer = timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const dedupeKey = (
    severity: NotificationSeverity,
    title: string,
    message?: string,
  ) => `${severity}:${title}:${message ?? ""}`;

  const notify = (
    severity: NotificationSeverity,
    title: string,
    opts?: { message?: string; action?: Notification["action"] },
  ) => {
    const key = dedupeKey(severity, title, opts?.message);
    const now = Date.now();
    const lastTime = recentKeys.get(key);
    if (lastTime !== undefined && now - lastTime < 1000) {
      return;
    }
    recentKeys.set(key, now);

    const notification: Notification = {
      id: crypto.randomUUID(),
      severity,
      title,
      message: opts?.message,
      action: opts?.action,
      createdAt: now,
    };

    setNotifications((prev) => {
      const next = [...prev, notification];
      return next.length > MAX_VISIBLE ? next.slice(-MAX_VISIBLE) : next;
    });

    scheduleDismiss(notification.id, severity);
  };

  onCleanup(() => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });

  const value: NotificationContextValue = {
    notifications,
    notify,
    dismiss,
  };

  return (
    <NotificationContext.Provider value={value}>
      {props.children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotification must be used within NotificationProvider",
    );
  return ctx;
};

export const notifyInfo = (
  ctx: NotificationContextValue,
  title: string,
  opts?: { message?: string; action?: Notification["action"] },
) => ctx.notify("info", title, opts);

export const notifySuccess = (
  ctx: NotificationContextValue,
  title: string,
  opts?: { message?: string; action?: Notification["action"] },
) => ctx.notify("success", title, opts);

export const notifyWarning = (
  ctx: NotificationContextValue,
  title: string,
  opts?: { message?: string; action?: Notification["action"] },
) => ctx.notify("warning", title, opts);

export const notifyError = (
  ctx: NotificationContextValue,
  title: string,
  opts?: { message?: string; action?: Notification["action"] },
) => ctx.notify("error", title, opts);
