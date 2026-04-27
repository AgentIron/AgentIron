import { createContext, createEffect, on, untrack, useContext, type Component, type JSX } from "solid-js";
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
  const { settings, loaded } = useSettings();
  const [state, setState] = createStore<AgentState>({
    connections: [],
    activeTabId: null,
  });
  let previousProviderCredentials: Record<string, string> | null = null;

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
    const conn = await createAgent(
      apiKey, model, tabId, workingDirectory, providerId, effectiveMcp,
      "in-process",
      settings.skills.trustProjectSkills,
      settings.skills.additionalSkillDirs,
    );
    // Enrich connection with model/provider info
    const enriched: AgentConnection = { ...conn, model, providerId };
    setState("connections", (prev) => [...prev, enriched]);
    return enriched;
  };

  createEffect(on(
    () => ({
      settingsLoaded: loaded(),
      providers: settings.providers.map((provider) => ({
        id: provider.id,
        enabled: provider.enabled,
        apiKey: provider.apiKey,
      })),
    }),
    ({ settingsLoaded, providers }) => {
      if (!settingsLoaded) return;

      const currentProviderCredentials = Object.fromEntries(
        providers.map((provider) => [provider.id, `${provider.enabled}:${provider.apiKey}`]),
      );

      if (!previousProviderCredentials) {
        previousProviderCredentials = currentProviderCredentials;
        return;
      }

      const changedProviderIds = providers
        .filter((provider) => previousProviderCredentials?.[provider.id] !== currentProviderCredentials[provider.id])
        .map((provider) => provider.id);

      previousProviderCredentials = currentProviderCredentials;

      if (changedProviderIds.length === 0) return;

      const affectedConnections = untrack(() =>
        state.connections.filter(
          (connection) =>
            !!connection.providerId
            && !!connection.model
            && changedProviderIds.includes(connection.providerId),
        ),
      );

      for (const connection of affectedConnections) {
        const provider = providers.find((candidate) => candidate.id === connection.providerId);
        const apiKey = provider?.enabled ? provider.apiKey.trim() : "";

        if (!provider || !apiKey || !connection.providerId || !connection.model) {
          continue;
        }

        replaceAgent(
          connection.id,
          apiKey,
          connection.model,
          connection.workingDirectory,
          connection.providerId,
        ).catch((error) => {
          console.error(`Failed to refresh credentials for tab ${connection.id}:`, error);
        });
      }
    },
  ));

  const value: AgentContextValue = {
    state,
    setActiveTab: (tabId) => setState("activeTabId", tabId),
    addConnection: (connection) =>
      setState("connections", (prev) => [...prev, connection]),
    removeConnection: (id) =>
      setState("connections", (prev) => prev.filter((c) => c.id !== id)),
    createAgentForTab: async (tabId, apiKey, model, workingDirectory?, providerId?, mcpServers?) => {
      const conn = await createAgent(
        apiKey, model, tabId, workingDirectory, providerId, mcpServers,
        "in-process",
        settings.skills.trustProjectSkills,
        settings.skills.additionalSkillDirs,
      );
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
