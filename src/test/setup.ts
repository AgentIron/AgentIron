import { vi } from "vitest";

// Provide a global mock for @tauri-apps/api/core invoke.
// Individual tests or test files can override specific commands
// via vi.mocked(invoke).mockImplementation(...) or the typed
// command-module mock in ./commands.ts.
export const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
}));
