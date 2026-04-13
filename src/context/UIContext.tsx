import { createContext, useContext, createSignal, type Component, type JSX } from "solid-js";

export type AppView = "chat" | "settings";

interface UIContextValue {
  sidebarOpen: () => boolean;
  setSidebarOpen: (open: boolean) => void;
  quickLaunchOpen: () => boolean;
  setQuickLaunchOpen: (open: boolean) => void;
  currentView: () => AppView;
  setCurrentView: (view: AppView) => void;
  mcpPaneOpen: () => boolean;
  setMcpPaneOpen: (open: boolean) => void;
}

const UIContext = createContext<UIContextValue>();

export const UIProvider: Component<{ children: JSX.Element }> = (props) => {
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [quickLaunchOpen, setQuickLaunchOpen] = createSignal(false);
  const [currentView, setCurrentView] = createSignal<AppView>("chat");
  const [mcpPaneOpen, setMcpPaneOpen] = createSignal(false);

  const value: UIContextValue = {
    sidebarOpen,
    setSidebarOpen,
    quickLaunchOpen,
    setQuickLaunchOpen,
    currentView,
    setCurrentView,
    mcpPaneOpen,
    setMcpPaneOpen,
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
