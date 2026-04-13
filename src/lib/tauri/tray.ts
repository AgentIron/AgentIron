// Tray icon management
// The tray is set up on the Rust side (lib.rs).
// This module provides frontend helpers if needed.

export function isTraySupported(): boolean {
  // Tray is only available on desktop
  return !("ontouchstart" in window);
}
