import { vi } from "vitest";

/**
 * Typed mock for the shared Tauri command module.
 *
 * Import `mockCommands` in a test file and override only the commands
 * that test needs. All command functions default to resolving `undefined`
 * so unrelated calls do not throw.
 *
 * Usage:
 * ```ts
 * mockCommands.listProfiles.mockResolvedValue({ ok: true, data: [...] });
 * mockCommands.saveProfile.mockRejectedValue(new Error("validation"));
 * ```
 */
export const mockCommands = {
  // Profile commands
  listProfiles: vi.fn(),
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  deleteProfile: vi.fn(),
  profileImpact: vi.fn(),

  // Prompt commands
  listPrompts: vi.fn(),
  getPrompt: vi.fn(),
  createPrompt: vi.fn(),
  savePrompt: vi.fn(),
  renamePrompt: vi.fn(),
  deletePrompt: vi.fn(),
  promptImpact: vi.fn(),

  // Credential commands
  listCredentials: vi.fn(),
  setApiKey: vi.fn(),
  deleteCredential: vi.fn(),

  // Seed / recovery
  seedDefaultProfiles: vi.fn(),
  restoreDefaultProfiles: vi.fn(),

  // Settings commands (existing)
  loadSettingsRows: vi.fn(),
  saveSettingRow: vi.fn(),
};

/**
 * Reset all command mocks between tests.
 */
export function resetMockCommands() {
  for (const key of Object.keys(mockCommands)) {
    (mockCommands as Record<string, ReturnType<typeof vi.fn>>)[key].mockReset();
  }
}
