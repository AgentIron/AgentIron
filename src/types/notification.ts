export type NotificationSeverity = "info" | "success" | "warning" | "error";

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface Notification {
  id: string;
  severity: NotificationSeverity;
  title: string;
  message?: string;
  action?: NotificationAction;
  createdAt: number;
}
