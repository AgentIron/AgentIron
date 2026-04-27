import type { Component } from "solid-js";

export const AgentConfig: Component = () => {
  return (
    <div class="space-y-4">
      <h2 class="text-sm font-semibold text-text-secondary">Agent Configuration</h2>
      <p class="text-sm text-text-tertiary">
        AgentIron runs agents in-process for security and performance. Transport selection is not configurable.
      </p>
      <div class="text-xs text-text-tertiary bg-surface rounded p-2">
        Transport: <span class="font-medium text-text-secondary">in-process</span>
      </div>
    </div>
  );
};
