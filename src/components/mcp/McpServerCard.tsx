import { Show, type Component } from "solid-js";
import { TbFillCircle, TbOutlineChevronRight } from "solid-icons/tb";
import { useMcp } from "@context/McpContext";
import type { McpServerConfig, McpServerStatus } from "@/types/settings";

interface McpServerCardProps {
  server: McpServerConfig;
  status?: McpServerStatus;
  onClick: () => void;
}

export const McpServerCard: Component<McpServerCardProps> = (props) => {
  const { toggleServer } = useMcp();

  const healthColor = () => {
    if (!props.status) return "text-text-tertiary";
    switch (props.status.health) {
      case "Connected": return "text-success";
      case "Connecting": return "text-warning";
      case "Error": return "text-error";
      case "Disabled": return "text-text-tertiary";
      default: return "text-text-tertiary";
    }
  };

  const healthLabel = () => {
    if (!props.status) {
      return props.server.enabledByDefault ? "Pending" : "Disabled";
    }
    return props.status.health;
  };

  const isEnabled = () => props.status?.enabled ?? props.server.enabledByDefault;
  const toolCount = () => props.status?.discoveredTools?.length ?? 0;

  return (
    <div class="rounded-lg border border-border-subtle bg-bg-tertiary overflow-hidden">
      <div class="flex items-center gap-3 px-3 py-2.5">
        <TbFillCircle size={8} class={healthColor()} />
        <div
          class="flex-1 min-w-0 cursor-pointer"
          onClick={() => props.onClick()}
        >
          <div class="text-sm font-medium text-text-primary truncate">{props.server.label}</div>
          <div class="flex items-center gap-2 text-xs text-text-tertiary">
            <span>{healthLabel()}</span>
            <Show when={toolCount() > 0}>
              <span>· {toolCount()} tools</span>
            </Show>
          </div>
          <Show when={props.status?.health === "Error" && props.status?.lastError}>
            <div class="text-xs text-error truncate mt-0.5">
              {props.status!.lastError}
            </div>
          </Show>
        </div>
        <div
          class="flex-shrink-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            toggleServer(props.server.id, !isEnabled());
          }}
        >
          <div
            class={`relative w-8 h-5 rounded-full transition-colors ${
              isEnabled() ? "bg-accent" : "bg-bg-elevated"
            }`}
          >
            <span class={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              isEnabled() ? "translate-x-3" : ""
            }`} />
          </div>
        </div>
        <TbOutlineChevronRight
          size={14}
          class="text-text-tertiary flex-shrink-0 cursor-pointer"
          onClick={props.onClick}
        />
      </div>
    </div>
  );
};
