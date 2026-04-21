import { For, createSignal, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  TbOutlineKey,
  TbOutlineUser,
  TbOutlinePlug,
  TbOutlineServer,
  TbOutlineBrain,
} from "solid-icons/tb";
import { ProviderSettings } from "./ProviderSettings";
import { UserSettings } from "./UserSettings";
import { PluginsSettings } from "./PluginsSettings";
import { McpSettings } from "./McpSettings";
import { SkillsSettings } from "./SkillsSettings";
import type { JSX } from "solid-js";

type Section = "providers" | "mcp" | "user" | "plugins" | "skills";

const SECTIONS: { id: Section; label: string; icon: JSX.Element }[] = [
  { id: "providers", label: "Providers", icon: <TbOutlineKey size={15} /> },
  { id: "mcp", label: "MCP Servers", icon: <TbOutlineServer size={15} /> },
  { id: "skills", label: "Skills", icon: <TbOutlineBrain size={15} /> },
  { id: "user", label: "User", icon: <TbOutlineUser size={15} /> },
  { id: "plugins", label: "Plugins", icon: <TbOutlinePlug size={15} /> },
];

const SECTION_COMPONENTS: Record<Section, Component> = {
  providers: ProviderSettings,
  mcp: McpSettings,
  user: UserSettings,
  plugins: PluginsSettings,
  skills: SkillsSettings,
};

export const SettingsPanel: Component = () => {
  const [activeSection, setActiveSection] = createSignal<Section>("providers");

  return (
    <div class="flex h-full">
      <div class="w-48 flex-shrink-0 border-r border-border-subtle p-3 space-y-1">
        <div class="px-3 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wide">
          Settings
        </div>
        <For each={SECTIONS}>
          {(section) => (
            <button
              onClick={() => setActiveSection(section.id)}
              class={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                activeSection() === section.id
                  ? "bg-bg-hover text-text-primary"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              {section.icon}
              <span>{section.label}</span>
            </button>
          )}
        </For>
      </div>
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-xl mx-auto">
          <Dynamic component={SECTION_COMPONENTS[activeSection()]} />
        </div>
      </div>
    </div>
  );
};
