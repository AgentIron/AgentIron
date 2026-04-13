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
} from "solid-icons/tb";

export function toolIcon(name: string | undefined): JSX.Element {
  const size = 14;
  const cls = "flex-shrink-0";
  switch (name) {
    case "read":
      return <TbOutlineFileText size={size} class={`${cls} text-blue-400`} />;
    case "write":
      return <TbOutlineFile size={size} class={`${cls} text-amber-400`} />;
    case "edit":
      return <TbOutlinePencil size={size} class={`${cls} text-amber-400`} />;
    case "glob":
      return <TbOutlineSearch size={size} class={`${cls} text-emerald-400`} />;
    case "grep":
      return <TbOutlineCode size={size} class={`${cls} text-emerald-400`} />;
    case "bash":
    case "powershell":
      return <TbOutlineTerminal size={size} class={`${cls} text-purple-400`} />;
    case "python_exec":
      return <TbOutlineBrandPython size={size} class={`${cls} text-yellow-400`} />;
    case "webfetch":
      return <TbOutlineWorldWww size={size} class={`${cls} text-cyan-400`} />;
    default:
      return <TbOutlineTerminal size={size} class={`${cls} text-text-tertiary`} />;
  }
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
    const name = ev.toolName || "unknown";
    nameCounts[name] = (nameCounts[name] || 0) + 1;
    if (ev.type !== "tool_result") allCompleted = false;
    if (ev.status === "Failed" || ev.status === "Error") hasErrors = true;
    if (!isReadOnlyTool(name)) allReadOnly = false;
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
