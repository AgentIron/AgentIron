import type { Component } from "solid-js";
import { AppShell } from "@components/layout/AppShell";
import { AgentProvider } from "@context/AgentContext";
import { ChatProvider } from "@context/ChatContext";
import { UIProvider } from "@context/UIContext";
import { SettingsProvider } from "@context/SettingsContext";
import { ConfigManagementProvider } from "@context/ConfigManagementContext";
import { McpProvider } from "@context/McpContext";
import { NotificationProvider } from "@context/NotificationContext";
import { SkillCatalogProvider } from "@context/SkillCatalogContext";
import { NotificationStack } from "@components/NotificationStack";
import "./index.css";

const App: Component = () => {
  return (
    <SettingsProvider>
      <UIProvider>
        <NotificationProvider>
          <AgentProvider>
            <ConfigManagementProvider>
              <SkillCatalogProvider>
                <McpProvider>
                  <ChatProvider>
                    <AppShell />
                  </ChatProvider>
                </McpProvider>
              </SkillCatalogProvider>
            </ConfigManagementProvider>
          </AgentProvider>
          <NotificationStack />
        </NotificationProvider>
      </UIProvider>
    </SettingsProvider>
  );
};

export default App;
