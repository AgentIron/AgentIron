import { For, type Component } from "solid-js";
import { TransitionGroup } from "solid-transition-group";
import { useNotification } from "@context/NotificationContext";
import { NotificationToast } from "./NotificationToast";

export const NotificationStack: Component = () => {
  const { notifications, dismiss } = useNotification();

  return (
    <div
      class="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 pointer-events-none"
      aria-live="polite"
    >
      <TransitionGroup name="toast">
        <For each={notifications()}>
          {(notification) => (
            <div class="pointer-events-auto">
              <NotificationToast
                notification={notification}
                onDismiss={dismiss}
              />
            </div>
          )}
        </For>
      </TransitionGroup>
    </div>
  );
};
