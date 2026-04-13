import { For, Show, createSignal, onMount, type Component } from "solid-js";
import { TbOutlineX, TbOutlineServer } from "solid-icons/tb";
import { useUI } from "@context/UIContext";
import { useSettings } from "@context/SettingsContext";
import { useMcp } from "@context/McpContext";
import { McpServerCard } from "./McpServerCard";
import { McpServerDetail } from "./McpServerDetail";
import type { McpServerConfig } from "@/types/settings";

export const McpPanel: Component = () => {
  const { setMcpPaneOpen } = useUI();
  const { settings } = useSettings();
  const { getServerStatus, refresh } = useMcp();
  const [selectedServer, setSelectedServer] = createSignal<McpServerConfig | null>(null);

  onMount(() => {
    refresh();
  });

  return (
    <div class="w-80 flex-shrink-0 border-l border-border-default bg-bg-secondary flex flex-col h-full">
      <Show
        when={selectedServer()}
        fallback={
          <>
            <div class="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <div class="flex items-center gap-2">
                <TbOutlineServer size={16} class="text-text-tertiary" />
                <span class="text-sm font-medium text-text-primary">MCP Servers</span>
              </div>
              <button
                onClick={() => setMcpPaneOpen(false)}
                class="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <TbOutlineX size={16} />
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-3 space-y-2">
              <Show
                when={settings.mcpServers.length > 0}
                fallback={
                  <div class="text-center py-8">
                    <TbOutlineServer size={32} class="mx-auto text-text-tertiary mb-2" />
                    <p class="text-sm text-text-tertiary">No MCP servers configured</p>
                    <p class="text-xs text-text-tertiary mt-1">
                      Add servers in Settings → MCP Servers
                    </p>
                  </div>
                }
              >
                <For each={settings.mcpServers}>
                  {(server) => (
                    <McpServerCard
                      server={server}
                      status={getServerStatus(server.id)}
                      onClick={() => setSelectedServer(server)}
                    />
                  )}
                </For>
              </Show>
            </div>
          </>
        }
      >
        {(server) => (
          <McpServerDetail
            server={server()}
            status={getServerStatus(server().id)}
            onBack={() => setSelectedServer(null)}
          />
        )}
      </Show>
    </div>
  );
};
