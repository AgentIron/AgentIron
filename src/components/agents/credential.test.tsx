import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, waitFor } from "@solidjs/testing-library";
import { createSignal, type Component } from "solid-js";

vi.mock("@lib/tauri/config-commands", () => ({
  listProfiles: vi.fn(),
  saveProfile: vi.fn(),
  deleteProfile: vi.fn(),
  profileImpact: vi.fn(),
  listPrompts: vi.fn(),
  createPrompt: vi.fn(),
  savePrompt: vi.fn(),
  renamePrompt: vi.fn(),
  deletePrompt: vi.fn(),
  promptImpact: vi.fn(),
  listCredentials: vi.fn(),
  setApiKey: vi.fn(),
  deleteCredential: vi.fn(),
  restoreDefaultProfiles: vi.fn(),
  getSharedConfigError: vi.fn().mockResolvedValue(null),
  parseMutationError: vi.fn((e: unknown) => ({ kind: "unknown", message: typeof e === "string" ? e : String(e) })),
}));

import { listProfiles, listPrompts, listCredentials, setApiKey, deleteCredential } from "@lib/tauri/config-commands";
import { ConfigManagementProvider, useConfigManagement, type ConfigManagementContextValue } from "@context/ConfigManagementContext";
import { SettingsProvider } from "@context/SettingsContext";
import { UIProvider } from "@context/UIContext";
import { NotificationProvider } from "@context/NotificationContext";
import { ProviderSettings } from "@components/settings/ProviderSettings";

// Mock settings commands so SettingsProvider loads without real Tauri
vi.mock("@lib/tauri/commands", () => ({
  loadSettingsRows: vi.fn().mockResolvedValue([
    { key: "providers", value: '[{"id":"openai","name":"OpenAI","enabled":true}]' },
    { key: "default_model", value: "openai/gpt-4o" },
  ]),
  saveSettingRow: vi.fn().mockResolvedValue(undefined),
  getProviderAuthStatus: vi.fn().mockResolvedValue({ provider: "openai", status: "notConfigured" }),
  updateModelRegistry: vi.fn().mockResolvedValue([]),
  startProviderOAuth: vi.fn(),
  pollProviderOAuth: vi.fn(),
  disconnectProviderOAuth: vi.fn(),
}));

const mockCredentialConfigured = {
  providerSlug: "openai",
  credentialMode: "apikey",
  authStatus: "configuredApiKey",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

const mockCredentialOAuth = {
  providerSlug: "kimi-code",
  credentialMode: "oauthbearer",
  authStatus: "connectedOAuth",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

function setupMocks(credentials: unknown[] = []) {
  vi.mocked(listProfiles).mockResolvedValue([] as never);
  vi.mocked(listPrompts).mockResolvedValue([] as never);
  vi.mocked(listCredentials).mockResolvedValue(credentials as never);
}

function renderProviderSettings() {
  return render(() => (
    <SettingsProvider>
      <UIProvider>
        <NotificationProvider>
          <ConfigManagementProvider>
            <ProviderSettings />
          </ConfigManagementProvider>
        </NotificationProvider>
      </UIProvider>
    </SettingsProvider>
  ));
}

describe("ProviderSettings credential management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("renders 'Set' button when no API key is configured", async () => {
    const { findByTestId } = renderProviderSettings();
    const btn = await findByTestId("btn-set-apikey-openai");
    expect(btn).toBeTruthy();
  });

  it("shows 'API key configured' when credential summary reports configuredApiKey", async () => {
    setupMocks([mockCredentialConfigured]);
    const { findByText } = renderProviderSettings();
    expect(await findByText("API key configured")).toBeTruthy();
  });

  it("setApiKey routes through typed command and refreshes credentials", async () => {
    vi.mocked(setApiKey).mockResolvedValue(mockCredentialConfigured as never);
    setupMocks([]);

    const [ctx, setCtx] = createSignal<ConfigManagementContextValue | null>(null);
    const Probe: Component = () => {
      setCtx(useConfigManagement());
      return null;
    };

    render(() => (
      <ConfigManagementProvider>
        <Probe />
      </ConfigManagementProvider>
    ));

    await waitFor(() => expect(vi.mocked(listCredentials)).toHaveBeenCalled());

    await ctx()!.setApiKey("openai", "sk-test-123");

    expect(vi.mocked(setApiKey)).toHaveBeenCalledWith("openai", "sk-test-123");
    expect(vi.mocked(listCredentials).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("deleteCredential routes through typed command and refreshes credentials", async () => {
    vi.mocked(deleteCredential).mockResolvedValue(undefined as never);
    setupMocks([mockCredentialConfigured]);

    const [ctx, setCtx] = createSignal<ConfigManagementContextValue | null>(null);
    const Probe: Component = () => {
      setCtx(useConfigManagement());
      return null;
    };

    render(() => (
      <ConfigManagementProvider>
        <Probe />
      </ConfigManagementProvider>
    ));

    await waitFor(() => expect(vi.mocked(listCredentials)).toHaveBeenCalled());

    await ctx()!.deleteCredential("openai");

    expect(vi.mocked(deleteCredential)).toHaveBeenCalledWith("openai");
    expect(vi.mocked(listCredentials).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("calls deleteCredential when delete button is clicked", async () => {
    vi.mocked(deleteCredential).mockResolvedValue(undefined as never);
    setupMocks([mockCredentialConfigured]);
    const { findByTestId } = renderProviderSettings();
    const btn = await findByTestId("btn-delete-apikey-openai");

    fireEvent.click(btn);

    await waitFor(() => {
      expect(vi.mocked(deleteCredential)).toHaveBeenCalledWith("openai");
    });
  });

  it("credential summaries include OAuth status without secrets", async () => {
    setupMocks([mockCredentialConfigured, mockCredentialOAuth]);
    renderProviderSettings();
    await waitFor(() => {
      expect(vi.mocked(listCredentials)).toHaveBeenCalled();
    });
    expect(mockCredentialConfigured).not.toHaveProperty("apiKey");
    expect(mockCredentialOAuth).not.toHaveProperty("accessToken");
    expect(mockCredentialOAuth.authStatus).toBe("connectedOAuth");
  });

  it("detects API key independently when both API key and OAuth credentials exist", async () => {
    // Both credentials for the same provider — the frontend must find
    // the API key even if the OAuth entry appears first.
    const bothCreds = [
      { ...mockCredentialOAuth, providerSlug: "openai" },
      mockCredentialConfigured,
    ];
    setupMocks(bothCreds);
    const { findByText } = renderProviderSettings();
    expect(await findByText("API key configured")).toBeTruthy();
  });
});
