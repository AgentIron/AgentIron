import { Show, createEffect, createMemo, createSignal, type Component } from "solid-js";
import { Transition } from "solid-transition-group";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { ChatArea } from "@components/chat/ChatArea";
import { SettingsPanel } from "@components/settings/SettingsPanel";
import { AgentsWorkspace } from "@components/agents/AgentsWorkspace";
import { useAgent } from "@context/AgentContext";
import { useSettings } from "@context/SettingsContext";
import { useUI } from "@context/UIContext";
import { useNotification } from "@context/NotificationContext";
import { parseModelSlug } from "@lib/models";

export const AppShell: Component = () => {
  const { state: agentState, createAgentForTab } = useAgent();
  const { loaded, authStatusesLoaded, isProviderConfigured, apiKeyForProvider, settings, allModels } = useSettings();
  const { currentView } = useUI();
  const { notify } = useNotification();
  const [initialAgentCreating, setInitialAgentCreating] = createSignal(false);

  const defaultModel = createMemo(() => parseModelSlug(settings.defaultModel, allModels()));
  const defaultProviderConfigured = createMemo(() => isProviderConfigured(defaultModel().providerId));

  // Auto-create a tab on first load when the default model's provider is configured.
  let autoCreatedFor: string | null = null;
  createEffect(() => {
    const { providerId, modelId } = defaultModel();
    const autoCreateKey = `${providerId}/${modelId}`;
    const apiKey = apiKeyForProvider(providerId);

    if (
      loaded() &&
      authStatusesLoaded() &&
      defaultProviderConfigured() &&
      !agentState.activeTabId &&
      autoCreatedFor !== autoCreateKey &&
      !initialAgentCreating()
    ) {
      autoCreatedFor = autoCreateKey;
      setInitialAgentCreating(true);
      const enabledMcp = settings.mcpServers.filter((s) => s.enabledByDefault);
      createAgentForTab(
        crypto.randomUUID(),
        apiKey,
        modelId,
        undefined,
        providerId,
        enabledMcp,
      ).catch((err) => {
        console.error("Failed to auto-create tab:", err);
        notify("error", "Failed to start agent", { message: String(err) });
      }).finally(() => {
        setInitialAgentCreating(false);
      });
    }
  });

  return (
    <Show when={loaded()} fallback={<LoadingScreen />}>
      <div class="flex h-screen bg-bg-primary text-text-primary">
        <Sidebar />
        <div class="flex flex-1 flex-col">
          <TabBar />
          <main class="flex-1 min-h-0 flex">
            <Transition name="fade" mode="outin">
              <Show
                when={currentView() === "settings"}
                fallback={
                  <Show when={currentView() === "agents"} fallback={
                    <Show
                      when={defaultProviderConfigured()}
                      fallback={<DefaultProviderPrompt />}
                    >
                      <Show
                        when={agentState.activeTabId}
                        fallback={<NoActiveAgentFallback starting={initialAgentCreating()} />}
                      >
                        <ChatArea />
                      </Show>
                    </Show>
                  }>
                    <AgentsWorkspace />
                  </Show>
                }
              >
                <SettingsPanel />
              </Show>
            </Transition>
          </main>
        </div>
      </div>
    </Show>
  );
};

const LoadingScreen: Component = () => (
  <div class="flex items-center justify-center h-screen bg-bg-primary text-text-tertiary animate-fade-in">
    <p class="text-sm">Loading...</p>
  </div>
);

const DefaultProviderPrompt: Component = () => {
  const { setCurrentView } = useUI();

  return (
    <div class="flex flex-1 items-center justify-center">
      <div class="max-w-sm space-y-4 text-center">
        <h2 class="text-lg font-semibold">Default provider not configured</h2>
        <p class="text-sm text-text-tertiary">
          Configure the default model provider or choose a different default model to start chatting.
        </p>
        <button
          onClick={() => setCurrentView("settings")}
          class="rounded-lg bg-accent px-4 py-2.5 text-sm text-void transition-colors hover:bg-accent-hover"
        >
          Open Settings
        </button>
      </div>
    </div>
  );
};

const NoActiveAgentFallback: Component<{ starting: boolean }> = (props) => (
  <div class="flex flex-1 items-center justify-center text-text-tertiary">
    <p class="text-sm">
      {props.starting ? "Starting agent..." : "No active agent. Use + to start a new tab."}
    </p>
  </div>
);
