import { For, Show, createSignal, type Component } from "solid-js";
import {
  TbOutlineCheck,
  TbOutlineAlertTriangle,
  TbOutlineChevronDown,
  TbOutlineChevronRight,
} from "solid-icons/tb";
import { toolIcon, buildToolGroupSummary, formatToolCounts } from "./toolUtils";
import { renderArgsDetail, renderResult } from "./ToolDetailRenderers";
import type { ChatEntry } from "@/types/message";
import type { ToolEvent } from "@/types/agent";

interface ToolActivitySummaryProps {
  entries: ChatEntry[];
}

export const ToolActivitySummary: Component<ToolActivitySummaryProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);

  const toolEvents = () =>
    props.entries
      .filter((e) => e.type === "tool_event" && e.toolEvent)
      .map((e) => e.toolEvent!);

  const summary = () => buildToolGroupSummary(toolEvents());
  const countLabel = () => formatToolCounts(summary().nameCounts);

  return (
    <div class={`ml-10 mb-3 ${summary().allReadOnly ? "opacity-50" : ""}`}>
      {/* Collapsed summary line */}
      <button
        onClick={() => setExpanded(!expanded())}
        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded-lg border border-border-subtle bg-bg-secondary/50 hover:bg-bg-hover transition-colors"
      >
        {summary().hasErrors ? (
          <TbOutlineAlertTriangle size={13} class="text-warning flex-shrink-0" />
        ) : (
          <TbOutlineCheck size={13} class="text-success flex-shrink-0" />
        )}
        <span class="text-text-secondary">
          {summary().totalCount} tool{summary().totalCount !== 1 ? "s" : ""}
        </span>
        <span class="text-text-tertiary">·</span>
        <span class="text-text-tertiary truncate">{countLabel()}</span>
        <span class="ml-auto text-text-tertiary flex-shrink-0">
          {expanded() ? <TbOutlineChevronDown size={13} /> : <TbOutlineChevronRight size={13} />}
        </span>
      </button>

      {/* Expanded accordion */}
      <div
        class="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ "grid-template-rows": expanded() ? "1fr" : "0fr" }}
      >
        <div class="overflow-hidden">
          <div class="mt-1 rounded-lg border border-border-subtle bg-bg-secondary overflow-hidden">
            <For each={toolEvents()}>
              {(event) => <ToolDetailItem event={event} />}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Individual tool detail in the expanded accordion ──

const ToolDetailItem: Component<{ event: ToolEvent }> = (props) => {
  const [open, setOpen] = createSignal(false);

  const isResult = () => props.event.type === "tool_result";
  const statusColor = () => {
    if (isResult()) {
      return props.event.status === "Completed" ? "text-success" : "text-error";
    }
    return "text-accent";
  };

  return (
    <div class="border-b border-border-subtle last:border-b-0">
      <button
        onClick={() => setOpen(!open())}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-bg-hover transition-colors"
      >
        {toolIcon(props.event.toolName)}
        <span class="font-medium text-text-primary">{props.event.toolName}</span>
        <span class={`ml-auto flex-shrink-0 ${statusColor()}`}>
          {isResult() ? props.event.status : "Running"}
        </span>
        <span class="text-text-tertiary flex-shrink-0">
          {open() ? <TbOutlineChevronDown size={12} /> : <TbOutlineChevronRight size={12} />}
        </span>
      </button>
      <Show when={open()}>
        <div class="border-t border-border-subtle px-3 py-2 space-y-2">
          <Show when={props.event.arguments}>
            {renderArgsDetail(props.event.toolName, props.event.arguments)}
          </Show>
          <Show when={isResult() && props.event.result !== undefined}>
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
