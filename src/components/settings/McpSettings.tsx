import { For, Show, createSignal, type Component } from "solid-js";
import {
  TbOutlinePlus,
  TbOutlineTrash,
  TbOutlineServer,
  TbOutlinePencil,
} from "solid-icons/tb";
import { useSettings } from "@context/SettingsContext";
import { useAgent } from "@context/AgentContext";
import { reconnectMcpServer, registerMcpServer } from "@lib/tauri/commands";
import type { McpServerConfig } from "@/types/settings";

/** Parse "KEY=VALUE" lines into a Record */
function parseKeyValuePairs(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
  return result;
}

function formatKeyValuePairs(record?: Record<string, string>): string {
  if (!record) return "";
  return Object.entries(record).map(([k, v]) => `${k}=${v}`).join("\n");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "server";
}

export const McpSettings: Component = () => {
  const { settings, addMcpServer, updateMcpServer, removeMcpServer } = useSettings();
  const { state: agentState } = useAgent();

  // Form state
  const [formOpen, setFormOpen] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [name, setName] = createSignal("");
  const [transport, setTransport] = createSignal<"stdio" | "http" | "http_sse">("stdio");
  const [command, setCommand] = createSignal("");
  const [args, setArgs] = createSignal("");
  const [workingDir, setWorkingDir] = createSignal("");
  const [envVars, setEnvVars] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [headers, setHeaders] = createSignal("");

  const isEditing = () => editingId() !== null;

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setName("");
    setTransport("stdio");
    setCommand("");
    setArgs("");
    setWorkingDir("");
    setEnvVars("");
    setUrl("");
    setHeaders("");
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (server: McpServerConfig) => {
    setEditingId(server.id);
    setName(server.label);
    setTransport(server.transport);
    setCommand(server.command || "");
    setArgs((server.args || []).join("\n"));
    setWorkingDir(server.workingDir || "");
    setEnvVars(formatKeyValuePairs(server.env));
    setUrl(server.url || "");
    setHeaders(formatKeyValuePairs(server.headers));
    setFormOpen(true);
  };

  const handleSave = () => {
    const label = name().trim();
    if (!label) return;

    const server: Partial<McpServerConfig> = {
      label,
      transport: transport(),
      enabledByDefault: true,
    };

    if (transport() === "stdio") {
      server.command = command().trim();
      const argList = args().split("\n").filter(Boolean);
      if (argList.length) server.args = argList;
      const wd = workingDir().trim();
      if (wd) server.workingDir = wd;
      const env = parseKeyValuePairs(envVars());
      if (Object.keys(env).length) server.env = env;
      // Clear HTTP fields
      server.url = undefined;
      server.headers = undefined;
    } else {
      server.url = url().trim();
      const hdrs = parseKeyValuePairs(headers());
      if (Object.keys(hdrs).length) server.headers = hdrs;
      // Clear stdio fields
      server.command = undefined;
      server.args = undefined;
      server.env = undefined;
      server.workingDir = undefined;
    }

    if (isEditing()) {
      const id = editingId()!;
      const existing = settings.mcpServers.find((s) => s.id === id);
      if (!existing) return;

      const updatedServer: McpServerConfig = {
        ...existing,
        ...server,
        id,
        enabledByDefault: existing.enabledByDefault,
      };

      updateMcpServer(id, updatedServer);

      for (const conn of agentState.connections) {
        registerMcpServer(conn.id, updatedServer)
          .then(() => reconnectMcpServer(conn.id, id))
          .catch((e) =>
            console.error(`Failed to update MCP server on tab ${conn.id}:`, e),
          );
      }
    } else {
      // Create new
      let id = slugify(label);
      if (settings.mcpServers.some((s) => s.id === id)) {
        id = `${id}-${Date.now().toString(36).slice(-4)}`;
      }
      const fullServer: McpServerConfig = {
        id,
        enabledByDefault: true,
        ...server,
      } as McpServerConfig;

      addMcpServer(fullServer);

      // Hot-register on all active agent tabs
      for (const conn of agentState.connections) {
        registerMcpServer(conn.id, fullServer).catch((e) =>
          console.error(`Failed to register MCP server on tab ${conn.id}:`, e),
        );
      }
    }

    resetForm();
  };

  const canSave = () => {
    if (!name().trim()) return false;
    if (transport() === "stdio" && !command().trim()) return false;
    if (transport() !== "stdio" && !url().trim()) return false;
    return true;
  };

  return (
    <div class="space-y-8">
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-text-primary">MCP Servers</h2>
            <p class="text-xs text-text-tertiary mt-1">
              Connect to Model Context Protocol servers for additional tools.
            </p>
          </div>
          <Show when={!formOpen()}>
            <button
              onClick={openAdd}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-accent text-void hover:bg-accent-hover transition-colors"
            >
              <TbOutlinePlus size={14} />
              Add Server
            </button>
          </Show>
        </div>

        {/* Add/Edit Server Form */}
        <Show when={formOpen()}>
          <div class="rounded-lg border border-accent/30 bg-bg-secondary p-4 space-y-3">
            <div class="text-xs font-medium text-text-secondary">
              {isEditing() ? "Edit Server" : "New Server"}
            </div>

            <div class="space-y-1">
              <label class="text-xs font-medium text-text-secondary">Name</label>
              <input
                type="text"
                placeholder="Filesystem Server"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                class="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-medium text-text-secondary">Transport</label>
              <div class="flex gap-2">
                <For each={["stdio", "http", "http_sse"] as const}>
                  {(t) => (
                    <button
                      onClick={() => setTransport(t)}
                      class={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                        transport() === t
                          ? "bg-accent text-void"
                          : "bg-bg-elevated text-text-secondary hover:bg-bg-hover"
                      }`}
                    >
                      {t === "stdio" ? "Stdio" : t === "http" ? "HTTP" : "HTTP+SSE"}
                    </button>
                  )}
                </For>
              </div>
              <Show when={transport() === "http"}>
                <p class="text-xs text-text-tertiary mt-1">
                  Streamable HTTP &mdash; request/response with optional SSE streaming. Recommended for most servers.
                </p>
              </Show>
              <Show when={transport() === "http_sse"}>
                <p class="text-xs text-text-tertiary mt-1">
                  Persistent SSE connection for server-to-client messages with HTTP POST for client-to-server. Use only if the server requires it.
                </p>
              </Show>
            </div>

            <Show when={transport() === "stdio"}>
              <div class="space-y-3">
                <div class="space-y-1">
                  <label class="text-xs font-medium text-text-secondary">Command</label>
                  <p class="text-xs text-text-tertiary">Executable name or full path. PATH is inherited automatically.</p>
                  <input
                    type="text"
                    placeholder="npx"
                    value={command()}
                    onInput={(e) => setCommand(e.currentTarget.value)}
                    class="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none font-mono"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-medium text-text-secondary">Arguments</label>
                  <p class="text-xs text-text-tertiary">One argument per line. No quoting needed — spaces in values are handled automatically.</p>
                  <textarea
                    rows="3"
                    placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/path/to/allowed dir"}
                    value={args()}
                    onInput={(e) => setArgs(e.currentTarget.value)}
                    class="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none font-mono resize-none"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-medium text-text-secondary">Working Directory (optional)</label>
                  <input
                    type="text"
                    placeholder="/path/to/dir"
                    value={workingDir()}
                    onInput={(e) => setWorkingDir(e.currentTarget.value)}
                    class="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none font-mono"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-medium text-text-secondary">Environment Variables (optional)</label>
                  <p class="text-xs text-text-tertiary">KEY=VALUE per line. PATH, HOME, and system vars are inherited automatically.</p>
                  <textarea
                    rows="2"
                    placeholder={"API_KEY=sk-...\nDEBUG=true"}
                    value={envVars()}
                    onInput={(e) => setEnvVars(e.currentTarget.value)}
                    class="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none font-mono resize-none"
                  />
                </div>
              </div>
            </Show>

            <Show when={transport() === "http" || transport() === "http_sse"}>
              <div class="space-y-3">
                <div class="space-y-1">
                  <label class="text-xs font-medium text-text-secondary">URL</label>
                  <input
                    type="text"
                    placeholder="http://localhost:3000"
                    value={url()}
                    onInput={(e) => setUrl(e.currentTarget.value)}
                    class="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none font-mono"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-medium text-text-secondary">Headers (optional)</label>
                  <p class="text-xs text-text-tertiary">KEY=VALUE per line. Common for authentication tokens.</p>
                  <textarea
                    rows="2"
                    placeholder={"Authorization=Bearer sk-...\nX-Custom-Header=value"}
                    value={headers()}
                    onInput={(e) => setHeaders(e.currentTarget.value)}
                    class="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none font-mono resize-none"
                  />
                </div>
              </div>
            </Show>

            <div class="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={!canSave()}
                class="px-4 py-1.5 rounded-md text-xs bg-accent text-void hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {isEditing() ? "Save" : "Add"}
              </button>
              <button
                onClick={resetForm}
                class="px-4 py-1.5 rounded-md text-xs bg-bg-elevated text-text-secondary hover:bg-bg-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Show>

        {/* Server List */}
        <For each={settings.mcpServers}>
          {(server) => (
            <div class="rounded-lg border border-border-default bg-bg-secondary p-4">
              <div class="flex items-center gap-3">
                <TbOutlineServer size={16} class="text-text-tertiary flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-text-primary">{server.label}</div>
                  <div class="text-xs text-text-tertiary font-mono truncate">
                    {server.transport === "stdio"
                      ? `${server.command} ${(server.args || []).join(" ")}`
                      : server.url}
                  </div>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary">
                  {server.transport === "stdio" ? "Stdio" : server.transport === "http" ? "HTTP" : "SSE"}
                </span>
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => updateMcpServer(server.id, { enabledByDefault: !server.enabledByDefault })}
                    class={`relative w-9 h-5 rounded-full transition-colors ${
                      server.enabledByDefault ? "bg-accent" : "bg-bg-elevated"
                    }`}
                  >
                    <span class={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      server.enabledByDefault ? "translate-x-4" : ""
                    }`} />
                  </button>
                  <button
                    onClick={() => openEdit(server)}
                    class="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
                    title="Edit server"
                  >
                    <TbOutlinePencil size={14} />
                  </button>
                  <button
                    onClick={() => removeMcpServer(server.id)}
                    class="p-1 rounded text-text-tertiary hover:text-error hover:bg-error/10 transition-colors"
                    title="Remove server"
                  >
                    <TbOutlineTrash size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </For>

        <Show when={settings.mcpServers.length === 0 && !formOpen()}>
          <div class="rounded-lg border border-border-subtle border-dashed bg-bg-secondary/50 p-6 text-center">
            <p class="text-sm text-text-tertiary">
              No MCP servers configured. Click "Add Server" to connect to one.
            </p>
          </div>
        </Show>
      </section>
    </div>
  );
};
