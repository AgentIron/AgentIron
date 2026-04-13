// Global shortcut registration via @tauri-apps/plugin-global-shortcut
// Used for quick launch activation (default: Ctrl+Space)

export async function registerQuickLaunch(
  shortcut: string,
  callback: () => void,
): Promise<void> {
  try {
    const { register } = await import("@tauri-apps/plugin-global-shortcut");
    await register(shortcut, (event) => {
      if (event.state === "Pressed") {
        callback();
      }
    });
  } catch {
    // Plugin not available (e.g., mobile or web)
    console.warn("Global shortcuts not available on this platform");
  }
}

export async function unregisterShortcut(shortcut: string): Promise<void> {
  try {
    const { unregister } = await import("@tauri-apps/plugin-global-shortcut");
    await unregister(shortcut);
  } catch {
    // Ignore
  }
}
