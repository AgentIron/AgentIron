import { Show, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  TbOutlineAlertCircle,
  TbOutlineAlertTriangle,
  TbOutlineCheck,
  TbOutlineInfoCircle,
  TbOutlineX,
} from "solid-icons/tb";
import type { Notification, NotificationSeverity } from "@/types/notification";

const SEVERITY_STYLES: Record<
  NotificationSeverity,
  { border: string; icon: Component<{ size: number; class?: string }>; iconColor: string }
> = {
  info: { border: "border-l-accent", icon: TbOutlineInfoCircle, iconColor: "text-accent" },
  success: { border: "border-l-success", icon: TbOutlineCheck, iconColor: "text-success" },
  warning: { border: "border-l-warning", icon: TbOutlineAlertTriangle, iconColor: "text-warning" },
  error: { border: "border-l-error", icon: TbOutlineAlertCircle, iconColor: "text-error" },
};

export const NotificationToast: Component<{
  notification: Notification;
  onDismiss: (id: string) => void;
}> = (props) => {
  const s = () => SEVERITY_STYLES[props.notification.severity];

  return (
    <div
      class={`flex gap-2.5 rounded-lg border border-border-default border-l-[3px] ${s().border} bg-surface-light p-3 shadow-xl min-w-[280px] max-w-[400px]`}
      role="alert"
    >
      <Dynamic component={s().icon} size={16} class={`mt-0.5 shrink-0 ${s().iconColor}`} />
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-text-primary leading-snug">
            {props.notification.title}
          </p>
          <button
            onClick={() => props.onDismiss(props.notification.id)}
            class="shrink-0 p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Dismiss notification"
          >
            <TbOutlineX size={14} />
          </button>
        </div>
        <Show when={props.notification.message}>
          <p class="mt-1 text-xs text-text-secondary leading-relaxed">
            {props.notification.message}
          </p>
        </Show>
        <Show when={props.notification.action}>
          <button
            onClick={() => props.notification.action?.onClick()}
            class="mt-2 px-2.5 py-1 rounded-md text-xs bg-bg-elevated text-text-secondary hover:bg-bg-hover transition-colors"
          >
            {props.notification.action?.label}
          </button>
        </Show>
      </div>
    </div>
  );
};
