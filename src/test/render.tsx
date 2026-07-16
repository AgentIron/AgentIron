import { type Component, type JSX } from "solid-js";
import { render } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { vi } from "vitest";
import { mockCommands, resetMockCommands } from "./commands";

function installCommandMocks() {
  vi.mocked(invoke).mockImplementation((command, args) => {
    const values = (args ?? {}) as Record<string, unknown>;
    switch (command) {
      case "get_shared_config_error": return mockCommands.getSharedConfigError();
      case "list_profiles": return mockCommands.listProfiles();
      case "get_profile": return mockCommands.getProfile(values.id);
      case "save_profile": return mockCommands.saveProfile(values.id, values.profile);
      case "delete_profile": return mockCommands.deleteProfile(values.id);
      case "profile_impact": return mockCommands.profileImpact(values.profileId);
      case "list_prompts": return mockCommands.listPrompts();
      case "get_prompt": return mockCommands.getPrompt(values.id);
      case "create_prompt": return mockCommands.createPrompt(values.input);
      case "save_prompt": return mockCommands.savePrompt(values.id, values.prompt);
      case "rename_prompt": return mockCommands.renamePrompt(values.id, values.newDisplayName);
      case "delete_prompt": return mockCommands.deletePrompt(values.id);
      case "prompt_impact": return mockCommands.promptImpact(values.promptId);
      case "list_credentials": return mockCommands.listCredentials();
      case "set_api_key": return mockCommands.setApiKey(values.providerSlug, values.apiKey);
      case "delete_credential": return mockCommands.deleteCredential(values.providerSlug);
      case "seed_default_profiles": return mockCommands.seedDefaultProfiles();
      case "restore_default_profiles": return mockCommands.restoreDefaultProfiles();
      case "load_settings_rows": return mockCommands.loadSettingsRows();
      case "save_setting_row": return mockCommands.saveSettingRow(values.key, values.value);
      default: return Promise.reject(new Error(`Unexpected Tauri command: ${command}`));
    }
  });
}

/**
 * Render a Solid component wrapped in the providers it needs for testing.
 *
 * The command module is mocked automatically so no real Tauri IPC happens.
 * Call `resetMockCommands()` in `afterEach` to clear call history.
 */
export function renderWithProviders<T extends JSX.Element>(
  component: () => T,
  options?: { providers?: Component<{ children: JSX.Element }>[] },
) {
  installCommandMocks();
  const providers = options?.providers ?? [];

  let tree = component;
  for (const Provider of [...providers].reverse()) {
    const current = tree;
    tree = (() => <Provider>{current() as JSX.Element}</Provider>) as () => T;
  }

  return render(tree);
}

export { mockCommands, resetMockCommands };
