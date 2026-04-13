import { createContext, useContext, type Component, type JSX } from "solid-js";
import { createStore } from "solid-js/store";
import { createAgent, disconnectAgent } from "@lib/tauri/commands";
import { useSettings } from "@context/SettingsContext";
import type { AgentConnection } from "@/types/agent";
import type { McpServerConfig } from "@/types/settings";

interface AgentState {
  connections: AgentConnection[];
  activeTabId: string | null;
}

interface AgentContextValue {
  state: AgentState;
  setActiveTab: (tabId: string) => void;
  addConnection: (connection: AgentConnection) => void;
  removeConnection: (id: string) => void;
  createAgentForTab: (tabId: string, apiKey: string, model: string, workingDirectory?: string, providerId?: string, mcpServers?: McpServerConfig[]) => Promise<void>;
  changeWorkingDirectory: (tabId: string, apiKey: string, model: string, newDirectory: string, providerId?: string) => Promise<void>;
  changeModel: (tabId: string, apiKey: string, newModel: string, newProviderId: string) => Promise<void>;
  renameConnection: (tabId: string, newName: string) => void;
  activeConnection: () => AgentConnection | undefined;
}

const AgentContext = createContext<AgentContextValue>();

export const AgentProvider: Component<{ children: JSX.Element }> = (props) => {
  const { settings } = useSettings();
  const [state, setState] = createStore<AgentState>({
    connections: [],
    activeTabId: null,
  });

  const getConnection = (tabId: string) =>
    state.connections.find((c) => c.id === tabId);

  const getEnabledMcpServers = () =>
    settings.mcpServers.filter((s) => s.enabledByDefault);

  const replaceAgent = async (
    tabId: string,
    apiKey: string,
    model: string,
    workingDirectory?: string,
    providerId?: string,
    mcpServers?: McpServerConfig[],
  ) => {
    try { await disconnectAgent(tabId); } catch { /* ignore */ }
    setState("connections", (prev) => prev.filter((c) => c.id !== tabId));

    // Always include enabled MCP servers when creating/replacing an agent
    const effectiveMcp = mcpServers ?? getEnabledMcpServers();
    const conn = await createAgent(apiKey, model, tabId, workingDirectory, providerId, effectiveMcp);
    // Enrich connection with model/provider info
    const enriched: AgentConnection = { ...conn, model, providerId };
    setState("connections", (prev) => [...prev, enriched]);
    return enriched;
  };

  const value: AgentContextValue = {
    state,
    setActiveTab: (tabId) => setState("activeTabId", tabId),
    addConnection: (connection) =>
      setState("connections", (prev) => [...prev, connection]),
    removeConnection: (id) =>
      setState("connections", (prev) => prev.filter((c) => c.id !== id)),
    createAgentForTab: async (tabId, apiKey, model, workingDirectory?, providerId?, mcpServers?) => {
      const conn = await createAgent(apiKey, model, tabId, workingDirectory, providerId, mcpServers);
      const enriched: AgentConnection = { ...conn, model, providerId };
      setState("connections", (prev) => [...prev, enriched]);
      setState("activeTabId", tabId);
    },
    changeWorkingDirectory: async (tabId, apiKey, model, newDirectory, providerId?) => {
      await replaceAgent(tabId, apiKey, model, newDirectory, providerId);
    },
    changeModel: async (tabId, apiKey, newModel, newProviderId) => {
      const existing = getConnection(tabId);
      await replaceAgent(
        tabId,
        apiKey,
        newModel,
        existing?.workingDirectory,
        newProviderId,
      );
    },
    renameConnection: (tabId, newName) => {
      setState(
        "connections",
        (c) => c.id === tabId,
        "customName",
        newName || undefined,
      );
    },
    activeConnection: () =>
      state.connections.find((c) => c.id === state.activeTabId),
  };

  return (
    <AgentContext.Provider value={value}>{props.children}</AgentContext.Provider>
  );
};

export const useAgent = () => {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
};
