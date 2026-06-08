import { Show, type Component } from "solid-js";
import {
  TbOutlineServer,
  TbOutlineHistory,
  TbOutlineInfoCircle,
} from "solid-icons/tb";
import { useUI } from "@context/UIContext";
import { useSettings } from "@context/SettingsContext";
import { useMcp } from "@context/McpContext";
import { DirectoryIndicator } from "./DirectoryIndicator";
import { ModelSwitcher } from "./ModelSwitcher";
import { ContextIndicator } from "./ContextIndicator";
import { StatusIndicator } from "./StatusIndicator";

export const StatusBar: Component = () => {
  const { rightPane, toggleRightPane } = useUI();
  const { settings } = useSettings();
  const { serverStatuses } = useMcp();

  const mcpServerCount = () => settings.mcpServers.length;
  const connectedCount = () => serverStatuses().filter((s) => s.health === "Connected").length;
  const hasError = () => serverStatuses().some((s) => s.health === "Error");

  const mcpButtonColor = () => {
    if (rightPane() === "mcp") return "text-accent bg-accent-muted";
    if (hasError()) return "text-error hover:bg-bg-hover";
    if (connectedCount() > 0) return "text-success hover:bg-bg-hover";
    return "text-text-secondary hover:text-text-primary hover:bg-bg-hover";
  };

  const toggleColor = (active: boolean) =>
    active
      ? "text-accent bg-accent-muted"
      : "text-text-secondary hover:text-text-primary hover:bg-bg-hover";

  return (
    <div class="flex items-center gap-2 mt-1.5 px-1 text-text-secondary">
      {/* Left zone — switchable settings */}
      <div class="flex items-center gap-1 min-w-0">
        <DirectoryIndicator />
        <div class="w-px h-4 bg-border-subtle" />
        <ModelSwitcher />
        <div class="w-px h-4 bg-border-subtle" />
        <ContextIndicator />
      </div>

      {/* Center zone — animated status indicator */}
      <div class="flex-1 flex justify-center">
        <StatusIndicator />
      </div>

      {/* Right zone — panel toggles */}
      <div class="flex items-center gap-1">
        <button
          onClick={() => toggleRightPane("mcp")}
          class={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${mcpButtonColor()}`}
          title="MCP Servers"
        >
          <TbOutlineServer size={14} />
          <Show when={mcpServerCount() > 0}>
            <span>
              {connectedCount() > 0
                ? `${connectedCount()}/${mcpServerCount()}`
                : mcpServerCount()}
            </span>
          </Show>
        </button>
        <button
          onClick={() => toggleRightPane("tools")}
          class={`p-1.5 rounded-md transition-colors ${toggleColor(rightPane() === "tools")}`}
          title="Tool History"
        >
          <TbOutlineHistory size={14} />
        </button>
        <button
          onClick={() => toggleRightPane("model")}
          class={`p-1.5 rounded-md transition-colors ${toggleColor(rightPane() === "model")}`}
          title="Model Info"
        >
          <TbOutlineInfoCircle size={14} />
        </button>
      </div>
    </div>
  );
};
