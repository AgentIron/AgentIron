import { type Component, type JSX } from "solid-js";
import { render } from "@solidjs/testing-library";
import { mockCommands, resetMockCommands } from "./commands";

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
  const providers = options?.providers ?? [];

  let tree = component;
  for (const Provider of [...providers].reverse()) {
    const current = tree;
    tree = (() => <Provider>{current() as JSX.Element}</Provider>) as () => T;
  }

  return render(tree);
}

export { mockCommands, resetMockCommands };
