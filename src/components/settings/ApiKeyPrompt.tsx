import type { Component } from "solid-js";
import { TbOutlineSettings } from "solid-icons/tb";
import { useUI } from "@context/UIContext";

export const ApiKeyPrompt: Component = () => {
  const { setCurrentView } = useUI();

  return (
    <div class="flex items-center justify-center h-full">
      <div class="max-w-sm w-full text-center space-y-5 p-6">
        <div class="mx-auto w-12 h-12 rounded-full bg-accent-muted flex items-center justify-center">
          <TbOutlineSettings size={24} class="text-accent" />
        </div>
        <h2 class="text-lg font-semibold">Welcome to AgentIron</h2>
        <p class="text-sm text-text-tertiary">
          Configure a provider with an API key to get started.
        </p>
        <button
          onClick={() => setCurrentView("settings")}
          class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm text-void hover:bg-accent-hover transition-colors"
        >
          Open Provider Settings
        </button>
      </div>
    </div>
  );
};
