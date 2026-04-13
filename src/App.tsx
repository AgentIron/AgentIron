import type { Component } from "solid-js";
import { AppShell } from "@components/layout/AppShell";
import { AgentProvider } from "@context/AgentContext";
import { ChatProvider } from "@context/ChatContext";
import { UIProvider } from "@context/UIContext";
import { SettingsProvider } from "@context/SettingsContext";
import { McpProvider } from "@context/McpContext";
import "./index.css";

const App: Component = () => {
  return (
    <SettingsProvider>
      <UIProvider>
        <AgentProvider>
          <McpProvider>
            <ChatProvider>
              <AppShell />
            </ChatProvider>
          </McpProvider>
        </AgentProvider>
      </UIProvider>
    </SettingsProvider>
  );
};

export default App;
