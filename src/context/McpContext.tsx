import {
  createContext,
  useContext,
  createEffect,
  onCleanup,
  type Component,
  type JSX,
} from "solid-js";
import { createStore } from "solid-js/store";
import { getMcpStatus, setMcpServerEnabled, reconnectMcpServer } from "@lib/tauri/commands";
import { useAgent } from "@context/AgentContext";
import { useUI } from "@context/UIContext";
import { useSettings } from "@context/SettingsContext";
import type { McpServerStatus } from "@/types/settings";

interface McpState {
  statuses: Record<string, McpServerStatus>;
}

interface McpContextValue {
  state: McpState;
  serverStatuses: () => McpServerStatus[];
  getServerStatus: (id: string) => McpServerStatus | undefined;
  toggleServer: (serverId: string, enabled: boolean) => Promise<void>;
  retryServer: (serverId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const McpContext = createContext<McpContextValue>();

export const McpProvider: Component<{ children: JSX.Element }> = (props) => {
  const [state, setState] = createStore<McpState>({ statuses: {} });
  const { state: agentState } = useAgent();
  const { mcpPaneOpen } = useUI();
  const { updateMcpServer } = useSettings();

  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const refresh = async () => {
    const tabId = agentState.activeTabId;
    if (!tabId) {
      return;
    }

    try {
      const statuses = await getMcpStatus(tabId);
      const map: Record<string, McpServerStatus> = {};
      for (const s of statuses) {
        map[s.id] = s;
      }
      setState("statuses", map);
    } catch (e) {
      console.warn("[McpContext] Failed to get MCP status:", e);
    }
  };

  // Poll when the MCP pane is open and an agent is active
  createEffect(() => {
    const isOpen = mcpPaneOpen();
    const tabId = agentState.activeTabId;
    const shouldPoll = isOpen && !!tabId;

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }

    if (shouldPoll) {
      // Refresh immediately, then poll
      refresh();
      pollTimer = setInterval(refresh, 5000);
    }
  });

  // Also refresh when the active tab changes
  createEffect(() => {
    const tabId = agentState.activeTabId;
    if (tabId) {
      refresh();
    }
  });

  onCleanup(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  const value: McpContextValue = {
    state,
    serverStatuses: () => Object.values(state.statuses),
    getServerStatus: (id) => state.statuses[id],
    toggleServer: async (serverId, enabled) => {
      const tabId = agentState.activeTabId;
      if (tabId) {
        try {
          await setMcpServerEnabled(tabId, serverId, enabled);
        } catch (e) {
          console.error("Failed to toggle MCP server:", e);
        }
      }
      updateMcpServer(serverId, { enabledByDefault: enabled });
      await refresh();
    },
    retryServer: async (serverId) => {
      const tabId = agentState.activeTabId;
      if (tabId) {
        try {
          await reconnectMcpServer(tabId, serverId);
        } catch (e) {
          console.error("Failed to reconnect MCP server:", e);
        }
      }
      await refresh();
    },
    refresh,
  };

  return (
    <McpContext.Provider value={value}>{props.children}</McpContext.Provider>
  );
};

export const useMcp = () => {
  const ctx = useContext(McpContext);
  if (!ctx) throw new Error("useMcp must be used within McpProvider");
  return ctx;
};
