import { Show, For, type Component } from "solid-js";
import {
  TbOutlineArrowLeft,
  TbOutlineTerminal,
  TbOutlineWorldWww,
  TbFillCircle,
} from "solid-icons/tb";
import { useMcp } from "@context/McpContext";
import type { McpServerConfig, McpServerStatus } from "@/types/settings";

interface McpServerDetailProps {
  server: McpServerConfig;
  status?: McpServerStatus;
  onBack: () => void;
}

export const McpServerDetail: Component<McpServerDetailProps> = (props) => {
  const { toggleServer } = useMcp();

  const healthColor = () => {
    if (!props.status) return "text-text-tertiary";
    switch (props.status.health) {
      case "Connected": return "text-green-400";
      case "Connecting": return "text-yellow-400";
      case "Error": return "text-red-400";
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

  const enabled = () => props.status?.enabled ?? props.server.enabledByDefault;

  return (
    <>
      <div class="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
        <button
          onClick={() => props.onBack()}
          class="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <TbOutlineArrowLeft size={16} />
        </button>
        <span class="text-sm font-medium text-text-primary truncate">{props.server.label}</span>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status */}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <TbFillCircle size={8} class={healthColor()} />
            <span class="text-sm text-text-secondary">{healthLabel()}</span>
          </div>
          <button
            onClick={() => toggleServer(props.server.id, !enabled())}
            class={`relative w-9 h-5 rounded-full transition-colors ${
              enabled() ? "bg-accent" : "bg-bg-elevated"
            }`}
          >
            <span class={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              enabled() ? "translate-x-4" : ""
            }`} />
          </button>
        </div>

        {/* Error */}
        <Show when={props.status?.health === "Error" && props.status?.lastError}>
          <div>
            <h3 class="text-xs font-medium text-red-400 uppercase tracking-wide mb-1">Error</h3>
            <p class="text-xs text-red-300 font-mono bg-bg-tertiary rounded p-2 border border-red-900/30 break-all">
              {props.status!.lastError}
            </p>
          </div>
        </Show>

        {/* Description */}
        <Show when={props.server.description}>
          <div>
            <h3 class="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Description</h3>
            <p class="text-sm text-text-secondary">{props.server.description}</p>
          </div>
        </Show>

        {/* Transport */}
        <div>
          <h3 class="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Transport</h3>
          <div class="rounded-lg bg-bg-tertiary border border-border-subtle p-3 space-y-2">
            <div class="flex items-center gap-2">
              {props.server.transport === "stdio" ? (
                <TbOutlineTerminal size={14} class="text-purple-400" />
              ) : (
                <TbOutlineWorldWww size={14} class="text-cyan-400" />
              )}
              <span class="text-xs font-medium text-text-primary">
                {props.server.transport === "stdio"
                  ? "Stdio (subprocess)"
                  : props.server.transport === "http"
                  ? "HTTP"
                  : "HTTP + SSE"}
              </span>
            </div>
            <Show when={props.server.transport === "stdio"}>
              <div class="space-y-1">
                <DetailRow label="Command" value={props.server.command} mono />
                <Show when={props.server.args?.length}>
                  <DetailRow label="Args" value={props.server.args!.join(" ")} mono />
                </Show>
                <Show when={props.server.workingDir}>
                  <DetailRow label="Working Dir" value={props.server.workingDir} mono />
                </Show>
              </div>
            </Show>
            <Show when={props.server.transport !== "stdio"}>
              <DetailRow label="URL" value={props.server.url} mono />
            </Show>
          </div>
        </div>

        {/* Tools */}
        <div>
          <h3 class="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">
            Tools
            <Show when={props.status?.discoveredTools?.length}>
              <span class="ml-1 text-text-tertiary">({props.status!.discoveredTools.length})</span>
            </Show>
          </h3>
          <Show
            when={props.status?.discoveredTools?.length}
            fallback={
              <div class="rounded-lg bg-bg-tertiary border border-border-subtle p-4 text-center">
                <p class="text-xs text-text-tertiary">
                  {props.status?.health === "Connected"
                    ? "No tools discovered"
                    : props.status?.health === "Error"
                    ? "Server has errors — tools unavailable"
                    : "Tools will appear when the server connects"}
                </p>
              </div>
            }
          >
            <div class="space-y-1.5">
              <For each={props.status!.discoveredTools}>
                {(tool) => (
                  <div class="rounded-lg bg-bg-tertiary border border-border-subtle px-3 py-2.5">
                    <div class="text-xs font-mono font-medium text-text-primary">{tool.name}</div>
                    <Show when={tool.description}>
                      <p class="text-xs text-text-tertiary mt-0.5">{tool.description}</p>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Server ID */}
        <div>
          <h3 class="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Server ID</h3>
          <span class="text-xs text-text-tertiary font-mono">{props.server.id}</span>
        </div>
      </div>
    </>
  );
};

const DetailRow: Component<{ label: string; value?: string; mono?: boolean }> = (props) => (
  <Show when={props.value}>
    <div class="flex items-baseline gap-2 text-xs">
      <span class="text-text-tertiary flex-shrink-0">{props.label}:</span>
      <span class={`text-text-secondary ${props.mono ? "font-mono" : ""} break-all`}>{props.value}</span>
    </div>
  </Show>
);
