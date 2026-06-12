import type { JSX } from "solid-js";
import {
  TbOutlineFile,
  TbOutlineFileText,
  TbOutlinePencil,
  TbOutlineSearch,
  TbOutlineCode,
  TbOutlineTerminal,
  TbOutlineBrandPython,
  TbOutlineWorldWww,
  TbOutlineArchive,
} from "solid-icons/tb";
import { formatTokenCount } from "@lib/models";

export function toolIcon(name: string | undefined, size = 14): JSX.Element {
  const cls = "flex-shrink-0";
  if (isCompactionTool(name)) {
    return <TbOutlineArchive size={size} class={`${cls} text-accent`} />;
  }
  switch (name) {
    case "read":
      return <TbOutlineFileText size={size} class={`${cls} text-amber-light`} />;
    case "write":
      return <TbOutlineFile size={size} class={`${cls} text-amber-light`} />;
    case "edit":
      return <TbOutlinePencil size={size} class={`${cls} text-amber-light`} />;
    case "glob":
      return <TbOutlineSearch size={size} class={`${cls} text-success`} />;
    case "grep":
      return <TbOutlineCode size={size} class={`${cls} text-success`} />;
    case "bash":
    case "powershell":
      return <TbOutlineTerminal size={size} class={`${cls} text-text-secondary`} />;
    case "python_exec":
      return <TbOutlineBrandPython size={size} class={`${cls} text-warning`} />;
    case "webfetch":
      return <TbOutlineWorldWww size={size} class={`${cls} text-amber-light`} />;
    default:
      return <TbOutlineTerminal size={size} class={`${cls} text-text-tertiary`} />;
  }
}

// ── Compaction classification ──
//
// iron-core emits compaction lifecycle events as synthetic tool results with
// toolName "compaction". These helpers detect them and pull token metrics from
// the result so the transcript can render a distinct compaction entry.

const COMPACTION_TOOL_NAMES = new Set(["compact", "compaction"]);

export function isCompactionTool(name: string | undefined): boolean {
  return name ? COMPACTION_TOOL_NAMES.has(name) : false;
}

export interface CompactionMetrics {
  tokensBefore?: number;
  tokensAfter?: number;
  method?: string;
}

/** Extract compaction token metrics from a tool result, tolerating naming variants. */
export function extractCompactionMetrics(result: unknown): CompactionMetrics | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const num = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const value = r[key];
      if (typeof value === "number") return value;
    }
    return undefined;
  };
  const tokensBefore = num("tokens_before", "tokensBefore");
  const tokensAfter = num("tokens_after", "tokensAfter");
  const method = typeof r.method === "string" ? r.method : undefined;
  if (tokensBefore === undefined && tokensAfter === undefined && !method) return null;
  return { tokensBefore, tokensAfter, method };
}

/** "12.4k → 8.1k tokens" when both endpoints are known. */
export function formatCompactionDelta(metrics: CompactionMetrics): string {
  const { tokensBefore, tokensAfter } = metrics;
  if (tokensBefore !== undefined && tokensAfter !== undefined) {
    return `${formatTokenCount(tokensBefore)} → ${formatTokenCount(tokensAfter)} tokens`;
  }
  if (tokensAfter !== undefined) return `${formatTokenCount(tokensAfter)} tokens`;
  if (tokensBefore !== undefined) return `${formatTokenCount(tokensBefore)} tokens`;
  return "";
}

export function formatArgsSummary(toolName: string | undefined, args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;

  switch (toolName) {
    case "read":
    case "write":
    case "edit":
      return (a.path as string) || "";
    case "glob":
      return (a.pattern as string) || "";
    case "grep":
      return `/${a.pattern || ""}/${a.path ? ` in ${a.path}` : ""}`;
    case "bash":
    case "powershell":
      return truncate((a.command as string) || "", 80);
    case "python_exec":
      return truncate((a.code as string) || (a.script as string) || "", 60);
    case "webfetch":
      return (a.url as string) || "";
    default:
      return "";
  }
}

export function formatScriptActivityLabel(activityType: string | undefined): string {
  switch (activityType) {
    case "ScriptStarted":
      return "Python script started";
    case "ScriptPhase":
      return "Python script phase";
    case "ScriptCompleted":
      return "Python script completed";
    case "ChildToolCallStarted":
      return "Child tool call started";
    case "ChildToolCallCompleted":
      return "Child tool call completed";
    case "ChildToolCallFailed":
      return "Child tool call failed";
    default:
      return "Python script activity";
  }
}

export function formatScriptActivitySummary(detail: unknown): string {
  if (typeof detail === "string") return truncate(detail, 80);
  if (!detail || typeof detail !== "object") return "";

  const record = detail as Record<string, unknown>;
  const text = [record.message, record.phase, record.tool_name, record.summary]
    .find((value) => typeof value === "string" && value.length > 0);
  return typeof text === "string" ? truncate(text, 80) : "";
}

// ── Tool classification ──

const READ_ONLY_TOOLS = new Set(["glob", "grep", "read"]);

export function isReadOnlyTool(name: string | undefined): boolean {
  return name ? READ_ONLY_TOOLS.has(name) : false;
}

export interface ToolGroupSummary {
  totalCount: number;
  nameCounts: Record<string, number>;
  allCompleted: boolean;
  hasErrors: boolean;
  allReadOnly: boolean;
}

export function buildToolGroupSummary(events: import("@/types/agent").ToolEvent[]): ToolGroupSummary {
  const nameCounts: Record<string, number> = {};
  let allCompleted = true;
  let hasErrors = false;
  let allReadOnly = true;

  for (const ev of events) {
    const name = ev.type === "script_activity"
      ? formatScriptActivityLabel(ev.activityType)
      : (ev.toolName || "unknown");
    nameCounts[name] = (nameCounts[name] || 0) + 1;
    if (ev.type !== "tool_result" && ev.type !== "script_activity") allCompleted = false;
    if (ev.type === "script_activity" && ev.status === "Running") allCompleted = false;
    if (ev.status === "Failed" || ev.status === "Error") hasErrors = true;
    if (ev.type !== "script_activity" && !isReadOnlyTool(name)) allReadOnly = false;
  }

  return {
    totalCount: events.length,
    nameCounts,
    allCompleted,
    hasErrors,
    allReadOnly,
  };
}

export function formatToolCounts(nameCounts: Record<string, number>): string {
  return Object.entries(nameCounts)
    .map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
    .join(", ");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "...";
}
