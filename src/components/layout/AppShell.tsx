import { Show, createEffect, type Component } from "solid-js";
import { Transition } from "solid-transition-group";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { ChatArea } from "@components/chat/ChatArea";
import { ApiKeyPrompt } from "@components/settings/ApiKeyPrompt";
import { SettingsPanel } from "@components/settings/SettingsPanel";
import { useAgent } from "@context/AgentContext";
import { useSettings } from "@context/SettingsContext";
import { useUI } from "@context/UIContext";
import { parseModelSlug } from "@lib/models";

export const AppShell: Component = () => {
  const { state: agentState, createAgentForTab } = useAgent();
  const { loaded, hasConfiguredProvider, activeApiKey, settings, allModels } = useSettings();
  const { currentView } = useUI();

  // Auto-create a tab on first load when a provider is configured
  let autoCreated = false;
  createEffect(() => {
    if (
      loaded() &&
      hasConfiguredProvider() &&
      activeApiKey() &&
      !agentState.activeTabId &&
      !autoCreated
    ) {
      autoCreated = true;
      const { providerId, modelId } = parseModelSlug(settings.defaultModel, allModels());
      const enabledMcp = settings.mcpServers.filter((s) => s.enabledByDefault);
      createAgentForTab(
        crypto.randomUUID(),
        activeApiKey(),
        modelId,
        undefined,
        providerId,
        enabledMcp,
      ).catch((err) => console.error("Failed to auto-create tab:", err));
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
                  <Show
                    when={hasConfiguredProvider()}
                    fallback={<ApiKeyPrompt />}
                  >
                    <Show
                      when={agentState.activeTabId}
                      fallback={
                        <div class="flex-1 flex items-center justify-center text-text-tertiary">
                          <p class="text-sm">Starting agent...</p>
                        </div>
                      }
                    >
                      <ChatArea />
                    </Show>
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
