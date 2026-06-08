import { type Component } from "solid-js";
import { useChat, type ChatStatus } from "@context/ChatContext";
import { useAgent } from "@context/AgentContext";

interface StatusPresentation {
  label: string;
  /** Static text color token. */
  color: string;
  /** Static dot color token. */
  dotColor: string;
  /** Animation class from index.css, if any. */
  animation?: string;
  /** Dot-specific animation class from index.css, if any. */
  dotAnimation?: string;
}

const PRESENTATION: Record<ChatStatus, StatusPresentation> = {
  ready: { label: "Ready", color: "text-text-tertiary", dotColor: "bg-text-tertiary" },
  thinking: { label: "Thinking", color: "text-accent", dotColor: "bg-accent", animation: "status-thinking", dotAnimation: "status-dot-pulse" },
  // The streaming class paints its own animated gradient text, so no color token.
  streaming: { label: "Streaming", color: "", dotColor: "bg-accent", animation: "status-streaming", dotAnimation: "status-dot-streaming" },
  compacting: { label: "Compacting", color: "text-warning", dotColor: "bg-warning", animation: "status-compacting", dotAnimation: "status-dot-pulse" },
  error: { label: "Error", color: "text-error", dotColor: "bg-error", animation: "status-error", dotAnimation: "status-dot-error" },
  waiting: { label: "Waiting", color: "text-accent", dotColor: "bg-accent", animation: "status-thinking", dotAnimation: "status-dot-pulse" },
};

export const StatusIndicator: Component = () => {
  const { getStatus } = useChat();
  const { state: agentState } = useAgent();

  const status = () => getStatus(agentState.activeTabId ?? "");
  const presentation = () => PRESENTATION[status()];

  return (
    <span
      class="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide select-none"
      title={`Agent status: ${presentation().label}`}
    >
      <span
        aria-hidden="true"
        class={`h-1.5 w-1.5 rounded-full ${presentation().dotColor} ${presentation().dotAnimation ?? ""}`}
      />
      <span class={`${presentation().color} ${presentation().animation ?? ""}`}>
        {presentation().label}
      </span>
    </span>
  );
};
