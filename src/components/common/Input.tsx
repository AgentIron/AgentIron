import type { Component } from "solid-js";

interface InputProps {
  placeholder?: string;
  value?: string;
  onInput?: (value: string) => void;
  type?: string;
}

export const Input: Component<InputProps> = (props) => {
  return (
    <input
      type={props.type ?? "text"}
      placeholder={props.placeholder}
      value={props.value ?? ""}
      onInput={(e) => props.onInput?.(e.currentTarget.value)}
      class="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
    />
  );
};
