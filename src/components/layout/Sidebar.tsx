import type { Component, JSX } from "solid-js";
import {
  TbOutlineMessage,
  TbOutlineRobot,
  TbOutlineCalendarEvent,
  TbOutlineSettings,
} from "solid-icons/tb";
import { useUI } from "@context/UIContext";

export const Sidebar: Component = () => {
  const { currentView, setCurrentView } = useUI();

  return (
    <aside class="w-56 flex-shrink-0 border-r border-border-default bg-bg-secondary flex flex-col">
      <div class="px-4 py-4 text-sm font-semibold tracking-wide text-text-secondary uppercase">
        AgentIron
      </div>
      <nav class="flex-1 px-2 space-y-1">
        <SidebarItem
          label="Chat"
          icon={<TbOutlineMessage size={16} />}
          active={currentView() === "chat"}
          onClick={() => setCurrentView("chat")}
        />
        <SidebarItem
          label="Agents"
          icon={<TbOutlineRobot size={16} />}
        />
        <SidebarItem
          label="Tasks"
          icon={<TbOutlineCalendarEvent size={16} />}
        />
      </nav>
      <div class="px-2 pb-3 pt-3 border-t border-border-subtle">
        <button
          onClick={() => setCurrentView(currentView() === "settings" ? "chat" : "settings")}
          class={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
            currentView() === "settings"
              ? "bg-accent-muted text-accent"
              : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          }`}
        >
          <TbOutlineSettings size={16} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};

interface SidebarItemProps {
  label: string;
  icon?: JSX.Element;
  active?: boolean;
  onClick?: () => void;
}

const SidebarItem: Component<SidebarItemProps> = (props) => {
  return (
    <button
      onClick={() => props.onClick?.()}
      class={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
        props.active
          ? "bg-bg-hover text-text-primary"
          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      }`}
    >
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
};
