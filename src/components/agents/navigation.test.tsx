import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { type Component } from "solid-js";
import { UIProvider, useUI } from "@context/UIContext";

// Helper component to expose UI state in tests
const StateProbe: Component = () => {
  const ui = useUI();
  return (
    <div>
      <span data-testid="current-view">{ui.currentView()}</span>
      <span data-testid="agents-section">{ui.agentsSection()}</span>
    </div>
  );
};

// Minimal sidebar for navigation tests
const TestSidebar: Component = () => {
  const { currentView, setCurrentView } = useUI();
  return (
    <nav>
      <button
        data-testid="nav-chat"
        onClick={() => setCurrentView("chat")}
        class={currentView() === "chat" ? "active" : ""}
      >
        Chat
      </button>
      <button
        data-testid="nav-agents"
        onClick={() => setCurrentView("agents")}
        class={currentView() === "agents" ? "active" : ""}
      >
        Agents
      </button>
      <button
        data-testid="nav-settings"
        onClick={() => setCurrentView("settings")}
        class={currentView() === "settings" ? "active" : ""}
      >
        Settings
      </button>
    </nav>
  );
};

describe("UIContext navigation", () => {
  it("starts with chat view and profiles section", () => {
    const { getByTestId } = render(() => (
      <UIProvider>
        <StateProbe />
      </UIProvider>
    ));
    expect(getByTestId("current-view").textContent).toBe("chat");
    expect(getByTestId("agents-section").textContent).toBe("profiles");
  });

  it("switches to agents view", () => {
    const { getByTestId } = render(() => (
      <UIProvider>
        <TestSidebar />
        <StateProbe />
      </UIProvider>
    ));
    fireEvent.click(getByTestId("nav-agents"));
    expect(getByTestId("current-view").textContent).toBe("agents");
  });

  it("switches between views", () => {
    const { getByTestId } = render(() => (
      <UIProvider>
        <TestSidebar />
        <StateProbe />
      </UIProvider>
    ));
    fireEvent.click(getByTestId("nav-agents"));
    expect(getByTestId("current-view").textContent).toBe("agents");
    fireEvent.click(getByTestId("nav-settings"));
    expect(getByTestId("current-view").textContent).toBe("settings");
    fireEvent.click(getByTestId("nav-chat"));
    expect(getByTestId("current-view").textContent).toBe("chat");
  });
});

describe("ConfigManagementContext", () => {
  it("reports zero profiles when list is empty", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([]);
      if (cmd === "list_prompts") return Promise.resolve([]);
      if (cmd === "list_credentials") return Promise.resolve([]);
      if (cmd === "get_shared_config_error") return Promise.resolve(null);
      return Promise.resolve([]);
    });

    const { useConfigManagement, ConfigManagementProvider } = await import(
      "@context/ConfigManagementContext"
    );

    const Probe: Component = () => {
      const mgmt = useConfigManagement();
      return (
        <div>
          <span data-testid="zero-profiles">{mgmt.zeroProfiles() ? "zero" : "has"}</span>
        </div>
      );
    };

    const { getByTestId } = render(() => (
      <ConfigManagementProvider>
        <Probe />
      </ConfigManagementProvider>
    ));

    await vi.waitFor(() => {
      expect(getByTestId("zero-profiles").textContent).toBe("zero");
    });
  });

  it("reports has profiles when at least one ready profile exists", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockProfile = {
      status: "ready" as const,
      entry: {
        id: "explore",
        profile: {
          name: "Explore",
          kind: "runtimeDefault" as const,
          tools: { kind: "inherit" as const },
          skills: { kind: "inherit" as const },
          approval: "perTool" as const,
        },
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    };

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([mockProfile]);
      if (cmd === "list_prompts") return Promise.resolve([]);
      if (cmd === "list_credentials") return Promise.resolve([]);
      if (cmd === "get_shared_config_error") return Promise.resolve(null);
      return Promise.resolve([]);
    });

    const { useConfigManagement, ConfigManagementProvider } = await import(
      "@context/ConfigManagementContext"
    );

    const Probe: Component = () => {
      const mgmt = useConfigManagement();
      return (
        <div>
          <span data-testid="zero-profiles">{mgmt.zeroProfiles() ? "zero" : "has"}</span>
        </div>
      );
    };

    const { getByTestId } = render(() => (
      <ConfigManagementProvider>
        <Probe />
      </ConfigManagementProvider>
    ));

    await vi.waitFor(() => {
      expect(getByTestId("zero-profiles").textContent).toBe("has");
    });
  });

  it("sets configInitError when shared config fails to initialize", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const initError = "Credential encryption is unavailable. Set AGENTIRON_CONFIG_ENCRYPTION_KEY.";
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_shared_config_error") return Promise.resolve(initError);
      return Promise.resolve([]);
    });

    const { useConfigManagement, ConfigManagementProvider } = await import(
      "@context/ConfigManagementContext"
    );

    const Probe: Component = () => {
      const mgmt = useConfigManagement();
      return (
        <div>
          <span data-testid="config-init-error">{mgmt.configInitError() ?? "none"}</span>
          <span data-testid="zero-profiles">{mgmt.zeroProfiles() ? "zero" : "has"}</span>
        </div>
      );
    };

    const { getByTestId } = render(() => (
      <ConfigManagementProvider>
        <Probe />
      </ConfigManagementProvider>
    ));

    await vi.waitFor(() => {
      expect(getByTestId("config-init-error").textContent).toContain("encryption");
    });
    // zeroProfiles returns false during config init error to avoid
    // false recovery state.
    expect(getByTestId("zero-profiles").textContent).toBe("has");
  });

  it("per-resource errors do not suppress zero-profile recovery", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_shared_config_error") return Promise.resolve(null);
      if (cmd === "list_profiles") return Promise.resolve([]);
      if (cmd === "list_prompts") return Promise.reject("Prompt load error");
      if (cmd === "list_credentials") return Promise.reject("Credential load error");
      return Promise.resolve([]);
    });

    const { useConfigManagement, ConfigManagementProvider } = await import(
      "@context/ConfigManagementContext"
    );

    const Probe: Component = () => {
      const mgmt = useConfigManagement();
      return (
        <div>
          <span data-testid="zero-profiles">{mgmt.zeroProfiles() ? "zero" : "has"}</span>
        </div>
      );
    };

    const { getByTestId } = render(() => (
      <ConfigManagementProvider>
        <Probe />
      </ConfigManagementProvider>
    ));

    // Even though prompts and credentials failed, profile-based
    // zero-profile detection should still work.
    await vi.waitFor(() => {
      expect(getByTestId("zero-profiles").textContent).toBe("zero");
    });
  });
});
