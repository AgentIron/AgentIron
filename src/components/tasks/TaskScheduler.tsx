import type { Component } from "solid-js";

export const TaskScheduler: Component = () => {
  return (
    <div class="space-y-4">
      <h2 class="text-sm font-semibold text-text-secondary">Scheduled Tasks</h2>
      <p class="text-sm text-text-tertiary">No scheduled tasks yet.</p>
    </div>
  );
};
