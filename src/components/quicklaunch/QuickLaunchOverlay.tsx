import type { Component } from "solid-js";

// Custom quick launch built with tinykeys + fuse.js
// Activated via global shortcut (default: Ctrl+Space)
export const QuickLaunchOverlay: Component = () => {
  return (
    <div class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60">
      <div class="w-full max-w-xl rounded-xl border border-border-default bg-bg-secondary shadow-2xl">
        <input
          type="text"
          placeholder="Type a command..."
          class="w-full rounded-t-xl border-b border-border-default bg-transparent px-5 py-4 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none"
          autofocus
        />
        <div class="p-2 text-sm text-text-tertiary">
          <p class="px-3 py-2">No recent commands.</p>
        </div>
      </div>
    </div>
  );
};
