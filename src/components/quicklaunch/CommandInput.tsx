import type { Component } from "solid-js";

export const CommandInput: Component = () => {
  return (
    <input
      type="text"
      placeholder="Type a command..."
      class="w-full bg-transparent px-5 py-4 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none"
      autofocus
    />
  );
};
