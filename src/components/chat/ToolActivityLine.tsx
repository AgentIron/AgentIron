import { Show, type Component } from "solid-js";
import { TbOutlineCheck, TbOutlineX } from "solid-icons/tb";
import { toolIcon, formatArgsSummary, isReadOnlyTool } from "./toolUtils";
import type { ToolEvent } from "@/types/agent";

interface ToolActivityLineProps {
  event: ToolEvent;
}

export const ToolActivityLine: Component<ToolActivityLineProps> = (props) => {
  const isCompleted = () =>
    props.event.type === "tool_result" && props.event.status === "Completed";
  const isError = () =>
    props.event.type === "tool_result" &&
    (props.event.status === "Failed" || props.event.status === "Error");
  const isRunning = () => !isCompleted() && !isError();
  const dimmed = () => isReadOnlyTool(props.event.toolName);

  const summary = () => formatArgsSummary(props.event.toolName, props.event.arguments);

  return (
    <div
      class={`flex items-center gap-2 ml-10 py-0.5 text-xs ${
        dimmed() ? "opacity-50" : ""
      }`}
    >
      {toolIcon(props.event.toolName)}
      <span class="text-text-primary font-medium">{props.event.toolName}</span>
      <Show when={summary()}>
        <span class="text-text-tertiary font-mono truncate max-w-[40%]">{summary()}</span>
      </Show>
      <span class="ml-auto flex-shrink-0">
        <Show when={isRunning()}>
          <span class="tool-spinner" />
        </Show>
        <Show when={isCompleted()}>
          <TbOutlineCheck size={12} class="text-success" />
        </Show>
        <Show when={isError()}>
          <TbOutlineX size={12} class="text-error" />
        </Show>
      </span>
    </div>
  );
};
