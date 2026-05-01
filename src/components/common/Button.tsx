import type { Component, JSX } from "solid-js";

interface ButtonProps {
  children: JSX.Element;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
}

export const Button: Component<ButtonProps> = (props) => {
  const base = "px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50";
  const variants = {
    primary: "bg-accent text-void hover:bg-accent-hover hover:shadow-[0_0_12px_rgba(217,119,6,0.25)]",
    secondary: "border border-border-default text-text-primary hover:border-amber/30 hover:bg-surface-light",
    ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-light",
  };

  return (
    <button
      class={`${base} ${variants[props.variant ?? "primary"]}`}
      onClick={() => props.onClick?.()}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
};
