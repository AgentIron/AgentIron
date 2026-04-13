import type { Component } from "solid-js";

export const AgentList: Component = () => {
  return (
    <div class="space-y-2">
      <h2 class="text-sm font-semibold text-text-secondary">Connected Agents</h2>
      <p class="text-sm text-text-tertiary">No agents connected.</p>
    </div>
  );
};
