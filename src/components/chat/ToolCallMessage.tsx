import { Show, createSignal, type Component } from "solid-js";
import {
  TbOutlineChevronDown,
  TbOutlineChevronRight,
} from "solid-icons/tb";
import { toolIcon, formatArgsSummary } from "./toolUtils";
import { renderArgsDetail, renderResult } from "./ToolDetailRenderers";
import type { ToolEvent } from "@/types/agent";

interface ToolCallMessageProps {
  event: ToolEvent;
  tabId: string;
}

export const ToolCallMessage: Component<ToolCallMessageProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);

  const isToolResult = () => props.event.type === "tool_result";

  const statusColor = () => {
    if (isToolResult()) {
      return props.event.status === "Completed" ? "text-success" : "text-error";
    }
    if (props.event.type === "approval_request") return "text-warning";
    return "text-accent";
  };

  const statusLabel = () => {
    if (props.event.type === "approval_request") return "Awaiting approval";
    if (isToolResult()) return props.event.status;
    return "Running";
  };

  const summary = () => formatArgsSummary(props.event.toolName, props.event.arguments);

  return (
    <div class="mb-3 ml-10 rounded-lg border border-border-subtle bg-bg-secondary overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded())}
        class="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-bg-hover transition-colors"
      >
        {toolIcon(props.event.toolName)}
        <span class="font-medium text-text-primary">{props.event.toolName}</span>
        <Show when={summary()}>
          <span class="text-text-tertiary font-mono truncate max-w-[40%]">{summary()}</span>
        </Show>
        <span class={`ml-auto flex-shrink-0 ${statusColor()}`}>{statusLabel()}</span>
        <span class="text-text-tertiary flex-shrink-0">
          {expanded() ? <TbOutlineChevronDown size={14} /> : <TbOutlineChevronRight size={14} />}
        </span>
      </button>

      <Show when={expanded()}>
        <div class="border-t border-border-subtle px-3 py-2 space-y-2">
          <Show when={props.event.arguments}>
            {renderArgsDetail(props.event.toolName, props.event.arguments)}
          </Show>
          <Show when={isToolResult() && props.event.result !== undefined}>
            <div class="pt-1 border-t border-border-subtle">
              <span class="text-xs text-text-tertiary">Result:</span>
              <div class="mt-1">
                {renderResult(props.event.toolName, props.event.result)}
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};
