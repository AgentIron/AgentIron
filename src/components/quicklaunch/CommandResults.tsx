import type { Component } from "solid-js";

interface CommandResultsProps {
  results: Array<{ label: string; description?: string }>;
}

export const CommandResults: Component<CommandResultsProps> = (props) => {
  return (
    <div class="p-2">
      {props.results.map((result) => (
        <button class="w-full text-left px-3 py-2 rounded-md text-sm text-text-primary hover:bg-bg-hover transition-colors">
          <span>{result.label}</span>
          {result.description && (
            <span class="ml-2 text-text-tertiary">{result.description}</span>
          )}
        </button>
      ))}
    </div>
  );
};
