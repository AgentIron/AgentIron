import type { Component } from "solid-js";

interface AgentCardProps {
  name: string;
  status: string;
  transport: string;
}

export const AgentCard: Component<AgentCardProps> = (props) => {
  return (
    <div class="rounded-lg border border-border-default bg-bg-tertiary p-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-text-primary">{props.name}</span>
        <span class="text-xs text-text-tertiary">{props.transport}</span>
      </div>
      <span class="text-xs text-text-secondary">{props.status}</span>
    </div>
  );
};
