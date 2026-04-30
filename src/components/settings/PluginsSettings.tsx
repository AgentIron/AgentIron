import { For, type Component } from "solid-js";
import {
  TbOutlineFileText,
  TbOutlineFile,
  TbOutlinePencil,
  TbOutlineSearch,
  TbOutlineCode,
  TbOutlineTerminal,
  TbOutlineBrandPython,
  TbOutlineWorldWww,
} from "solid-icons/tb";
import { BUILTIN_TOOLS, type BuiltinToolInfo } from "@lib/tools";
import type { JSX } from "solid-js";

function toolIcon(id: string): JSX.Element {
  const size = 16;
  switch (id) {
    case "read": return <TbOutlineFileText size={size} class="text-amber-light" />;
    case "write": return <TbOutlineFile size={size} class="text-amber-light" />;
    case "edit": return <TbOutlinePencil size={size} class="text-amber-light" />;
    case "glob": return <TbOutlineSearch size={size} class="text-success" />;
    case "grep": return <TbOutlineCode size={size} class="text-success" />;
    case "bash":
    case "powershell": return <TbOutlineTerminal size={size} class="text-text-secondary" />;
    case "python_exec": return <TbOutlineBrandPython size={size} class="text-warning" />;
    case "webfetch": return <TbOutlineWorldWww size={size} class="text-amber-light" />;
    default: return <TbOutlineTerminal size={size} class="text-text-tertiary" />;
  }
}

export const PluginsSettings: Component = () => {
  return (
    <div class="space-y-8">
      <section class="space-y-4">
        <div>
          <h2 class="text-base font-semibold text-text-primary">Tools</h2>
          <p class="text-xs text-text-tertiary mt-1">
            Built-in tools available to all agents. Plugin support coming soon.
          </p>
        </div>
        <div class="space-y-2">
          <For each={BUILTIN_TOOLS}>
            {(tool) => <ToolRow tool={tool} />}
          </For>
        </div>
      </section>
    </div>
  );
};

const ToolRow: Component<{ tool: BuiltinToolInfo }> = (props) => (
  <div class="flex items-center gap-3 rounded-lg bg-bg-secondary border border-border-subtle px-4 py-3">
    <div class="flex-shrink-0">{toolIcon(props.tool.id)}</div>
    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium text-text-primary">{props.tool.name}</div>
      <div class="text-xs text-text-tertiary">{props.tool.description}</div>
    </div>
    <span
      class={`text-xs px-2 py-0.5 rounded-full ${
        props.tool.requiresApproval
          ? "bg-warning/15 text-warning"
          : "bg-success/15 text-success"
      }`}
    >
      {props.tool.requiresApproval ? "Approval" : "Auto"}
    </span>
  </div>
);
