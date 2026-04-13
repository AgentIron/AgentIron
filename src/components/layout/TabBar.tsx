import { For, createSignal, type Component } from "solid-js";
import { useAgent } from "@context/AgentContext";
import { useSettings } from "@context/SettingsContext";
import { useUI } from "@context/UIContext";
import { parseModelSlug } from "@lib/models";
import { Tab } from "./Tab";

export const TabBar: Component = () => {
  const { state, setActiveTab, createAgentForTab, renameConnection } = useAgent();
  const { activeApiKey, settings, allModels } = useSettings();
  const { setCurrentView } = useUI();
  const [creating, setCreating] = createSignal(false);

  const handleNewTab = async () => {
    if (!activeApiKey() || creating()) return;
    setCreating(true);
    try {
      const tabId = crypto.randomUUID();
      const { providerId, modelId } = parseModelSlug(settings.defaultModel, allModels());
      const enabledMcp = settings.mcpServers.filter((s) => s.enabledByDefault);
      await createAgentForTab(tabId, activeApiKey(), modelId, undefined, providerId, enabledMcp);
      setCurrentView("chat");
    } catch (err) {
      console.error("Failed to create agent:", err);
      alert(`Failed to create agent: ${err}`);
    } finally {
      setCreating(false);
    }
  };

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    setCurrentView("chat");
  };

  return (
    <div class="flex items-center border-b border-border-default bg-bg-secondary px-2 h-10">
      <For each={state.connections}>
        {(conn) => (
          <Tab
            label={conn.customName || conn.model || conn.name}
            active={conn.id === state.activeTabId}
            onClick={() => handleTabClick(conn.id)}
            onRename={(name) => renameConnection(conn.id, name)}
          />
        )}
      </For>
      <button
        onClick={handleNewTab}
        disabled={!activeApiKey() || creating()}
        class="ml-1 px-2 py-1 text-text-tertiary hover:text-text-primary text-sm rounded hover:bg-bg-hover transition-colors disabled:opacity-50"
      >
        {creating() ? "..." : "+"}
      </button>
    </div>
  );
};
