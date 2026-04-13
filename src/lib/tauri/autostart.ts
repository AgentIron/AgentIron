// Autostart management via @tauri-apps/plugin-autostart

export async function enableAutostart(): Promise<void> {
  const { enable } = await import("@tauri-apps/plugin-autostart");
  await enable();
}

export async function disableAutostart(): Promise<void> {
  const { disable } = await import("@tauri-apps/plugin-autostart");
  await disable();
}

export async function isAutostartEnabled(): Promise<boolean> {
  const { isEnabled } = await import("@tauri-apps/plugin-autostart");
  return isEnabled();
}
