import { For, Show, createSignal, type Component } from "solid-js";
import {
  TbOutlineX,
  TbOutlineHistory,
  TbOutlineChevronDown,
  TbOutlineChevronRight,
} from "solid-icons/tb";
import { useUI } from "@context/UIContext";
import { useChat } from "@context/ChatContext";
import { useAgent } from "@context/AgentContext";
import {
  toolIcon,
  formatScriptActivityLabel,
  formatScriptActivitySummary,
  isCompactionTool,
} from "./toolUtils";
import { renderArgsDetail, renderResult, renderCompactionResult } from "./ToolDetailRenderers";
import type { ToolEvent } from "@/types/agent";

export const ToolHistoryPanel: Component = () => {
  const { closeRightPane } = useUI();
  const { getToolHistory } = useChat();
  const { state: agentState } = useAgent();

  const history = () => getToolHistory(agentState.activeTabId ?? "");

  return (
    <div class="w-80 flex-shrink-0 border-l border-border-default bg-bg-secondary flex flex-col h-full">
      <div class="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div class="flex items-center gap-2">
          <TbOutlineHistory size={16} class="text-text-tertiary" />
          <span class="text-sm font-medium text-text-primary">Tool History</span>
        </div>
        <button
          onClick={() => closeRightPane()}
          class="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <TbOutlineX size={16} />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <Show
          when={history().length > 0}
          fallback={
            <div class="text-center py-8">
              <TbOutlineHistory size={32} class="mx-auto text-text-tertiary mb-2" />
              <p class="text-sm text-text-tertiary">No tool calls yet</p>
              <p class="text-xs text-text-tertiary mt-1">
                Tool activity for this tab will appear here.
              </p>
            </div>
          }
        >
          <For each={history()}>
            {(entry) => <ToolHistoryRow event={entry.toolEvent!} />}
          </For>
        </Show>
      </div>
    </div>
  );
};

const ToolHistoryRow: Component<{ event: ToolEvent }> = (props) => {
  const [open, setOpen] = createSignal(false);

  const isResult = () => props.event.type === "tool_result";
  const isScriptActivity = () => props.event.type === "script_activity";
  const statusLabel = () =>
    isResult() || isScriptActivity() ? props.event.status : "Running";
  const statusColor = () => {
    if (isResult() || isScriptActivity()) {
      return props.event.status === "Completed" ? "text-success" : "text-error";
    }
    return "text-accent";
  };
  const title = () =>
    isScriptActivity()
      ? formatScriptActivityLabel(props.event.activityType)
      : props.event.toolName;
  const detailSummary = () =>
    isScriptActivity() ? formatScriptActivitySummary(props.event.detail) : "";

  return (
    <div class="rounded-lg border border-border-subtle bg-bg-secondary/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open())}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-bg-hover transition-colors"
      >
        {toolIcon(props.event.toolName)}
        <span class="font-medium text-text-primary truncate">{title()}</span>
        <Show when={detailSummary()}>
          <span class="text-text-tertiary font-mono truncate max-w-[40%]">{detailSummary()}</span>
        </Show>
        <span class={`ml-auto flex-shrink-0 ${statusColor()}`}>{statusLabel()}</span>
        <span class="text-text-tertiary flex-shrink-0">
          {open() ? <TbOutlineChevronDown size={12} /> : <TbOutlineChevronRight size={12} />}
        </span>
      </button>
      <Show when={open()}>
        <div class="border-t border-border-subtle px-3 py-2 space-y-2">
          <Show when={props.event.arguments}>
            {renderArgsDetail(props.event.toolName, props.event.arguments)}
          </Show>
          <Show when={isScriptActivity() && props.event.detail !== undefined}>
            <div class="pt-1 border-t border-border-subtle">
              <span class="text-xs text-text-tertiary">Details:</span>
              <pre class="mt-1 bg-bg-primary rounded p-2 overflow-x-auto font-mono text-text-secondary text-xs max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(props.event.detail, null, 2)}
              </pre>
            </div>
          </Show>
          <Show when={isResult() && props.event.result !== undefined}>
            <div class="pt-1 border-t border-border-subtle">
              <span class="text-xs text-text-tertiary">Result:</span>
              <div class="mt-1">
                {(isCompactionTool(props.event.toolName) &&
                  renderCompactionResult(props.event.result)) ||
                  renderResult(props.event.toolName, props.event.result)}
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};
