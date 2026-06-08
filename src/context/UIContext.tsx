import { createContext, useContext, createSignal, type Component, type JSX } from "solid-js";

export type AppView = "chat" | "settings";

/** Which right-side panel is currently shown (only one at a time). */
export type RightPane = "mcp" | "tools" | "model" | null;

interface UIContextValue {
  sidebarOpen: () => boolean;
  setSidebarOpen: (open: boolean) => void;
  quickLaunchOpen: () => boolean;
  setQuickLaunchOpen: (open: boolean) => void;
  currentView: () => AppView;
  setCurrentView: (view: AppView) => void;
  rightPane: () => RightPane;
  /** Open the given pane, or close it if it is already open (mutually exclusive). */
  toggleRightPane: (pane: Exclude<RightPane, null>) => void;
  closeRightPane: () => void;
  /** Convenience accessor: true when the MCP pane is the active right pane. */
  mcpPaneOpen: () => boolean;
}

const UIContext = createContext<UIContextValue>();

export const UIProvider: Component<{ children: JSX.Element }> = (props) => {
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [quickLaunchOpen, setQuickLaunchOpen] = createSignal(false);
  const [currentView, setCurrentView] = createSignal<AppView>("chat");
  const [rightPane, setRightPane] = createSignal<RightPane>(null);

  const toggleRightPane = (pane: Exclude<RightPane, null>) =>
    setRightPane((current) => (current === pane ? null : pane));
  const closeRightPane = () => setRightPane(null);

  const value: UIContextValue = {
    sidebarOpen,
    setSidebarOpen,
    quickLaunchOpen,
    setQuickLaunchOpen,
    currentView,
    setCurrentView,
    rightPane,
    toggleRightPane,
    closeRightPane,
    mcpPaneOpen: () => rightPane() === "mcp",
  };

  return (
    <UIContext.Provider value={value}>{props.children}</UIContext.Provider>
  );
};

export const useUI = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
};
