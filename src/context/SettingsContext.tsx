import {
  createContext,
  useContext,
  createSignal,
  onMount,
  type Component,
  type JSX,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { query, execute } from "@lib/tauri/db";
import { KNOWN_MODELS, DEFAULT_PROVIDERS, parseModelSlug, makeModelSlug } from "@lib/models";
import { updateModelRegistry as fetchModelRegistry } from "@lib/tauri/commands";
import type { AppSettings, ProviderConfig, McpServerConfig, ModelInfo } from "@/types/settings";

const DEFAULTS: AppSettings = {
  theme: "dark",
  autostart: false,
  quickLaunchShortcut: "Control+Space",
  providers: [{ id: "openai", name: "OpenAI", apiKey: "", enabled: true }],
  defaultModel: "openai/gpt-4o",
  starredModels: ["gpt-4o", "gpt-4o-mini"],
  customModels: [],
  mcpServers: [],
  userProfile: { name: "", email: "" },
};

interface SettingsContextValue {
  settings: AppSettings;
  loaded: () => boolean;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateProvider: (id: string, patch: Partial<ProviderConfig>) => void;
  addProvider: (id: string) => void;
  removeProvider: (id: string) => void;
  toggleStarredModel: (modelId: string) => void;
  addCustomModel: (model: import("@/types/settings").ModelInfo) => void;
  removeCustomModel: (modelId: string, providerId: string) => void;
  allModels: () => import("@/types/settings").ModelInfo[];
  addMcpServer: (server: McpServerConfig) => void;
  updateMcpServer: (id: string, patch: Partial<McpServerConfig>) => void;
  removeMcpServer: (id: string) => void;
  updateModelRegistry: () => Promise<void>;
  registryLastUpdated: () => string | null;
  activeApiKey: () => string;
  hasConfiguredProvider: () => boolean;
}

const SettingsContext = createContext<SettingsContextValue>();

// ── DB persistence helpers ──

const DB_KEY_MAP: Record<string, string> = {
  theme: "theme",
  autostart: "autostart",
  quickLaunchShortcut: "quick_launch_shortcut",
  providers: "providers",
  defaultModel: "default_model",
  starredModels: "starred_models",
  customModels: "custom_models",
  mcpServers: "mcp_servers",
  modelRegistry: "model_registry",
  userProfile: "user_profile",
};

const JSON_KEYS = new Set(["providers", "starredModels", "customModels", "mcpServers", "userProfile", "modelRegistry"]);

async function persistSetting(key: keyof AppSettings, value: unknown) {
  const dbKey = DB_KEY_MAP[key] || key;
  const dbValue = JSON_KEYS.has(key) ? JSON.stringify(value) : String(value);
  try {
    await execute(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
      [dbKey, dbValue, dbValue],
    );
  } catch (e) {
    console.error(`[Settings] Failed to persist ${key}:`, e);
  }
}

async function loadAllSettings(): Promise<Partial<AppSettings>> {
  try {
    const rows = await query<{ key: string; value: string }>(
      "SELECT key, value FROM settings",
    );

    const result: Partial<AppSettings> = {};
    const reverseMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(DB_KEY_MAP)) reverseMap[v] = k;

    for (const row of rows) {
      const settingsKey = reverseMap[row.key] || row.key;
      switch (settingsKey) {
        case "theme":
          result.theme = row.value as "light" | "dark";
          break;
        case "autostart":
          result.autostart = row.value === "true";
          break;
        case "quickLaunchShortcut":
          result.quickLaunchShortcut = row.value;
          break;
        case "defaultModel":
          result.defaultModel = row.value;
          break;
        case "providers":
          try { result.providers = JSON.parse(row.value); } catch { /* use default */ }
          break;
        case "starredModels":
          try { result.starredModels = JSON.parse(row.value); } catch { /* use default */ }
          break;
        case "customModels":
          try { result.customModels = JSON.parse(row.value); } catch { /* use default */ }
          break;
        case "mcpServers":
          try { result.mcpServers = JSON.parse(row.value); } catch { /* use default */ }
          break;
        case "userProfile":
          try { result.userProfile = JSON.parse(row.value); } catch { /* use default */ }
          break;
        case "modelRegistry":
          // Handled separately, not part of AppSettings
          break;
      }
    }
    return result;
  } catch (e) {
    console.error("[Settings] Failed to load:", e);
    return {};
  }
}

// ── Provider ──

export const SettingsProvider: Component<{ children: JSX.Element }> = (props) => {
  const [settings, setSettings] = createStore<AppSettings>({ ...DEFAULTS });
  const [loaded, setLoaded] = createSignal(false);
  const [registryModels, setRegistryModels] = createSignal<ModelInfo[]>([]);
  const [registryUpdated, setRegistryUpdated] = createSignal<string | null>(null);

  onMount(async () => {
    const saved = await loadAllSettings();
    // Merge saved values over defaults
    setSettings(produce((s) => {
      if (saved.theme !== undefined) s.theme = saved.theme;
      if (saved.autostart !== undefined) s.autostart = saved.autostart;
      if (saved.quickLaunchShortcut !== undefined) s.quickLaunchShortcut = saved.quickLaunchShortcut;
      if (saved.defaultModel !== undefined) s.defaultModel = saved.defaultModel;
      if (saved.providers !== undefined) {
        // Respect the user's saved state — don't re-add providers they deleted
        s.providers = saved.providers;
      }
      if (saved.starredModels !== undefined) s.starredModels = saved.starredModels;
      if (saved.customModels !== undefined) s.customModels = saved.customModels;
      if (saved.mcpServers !== undefined) s.mcpServers = saved.mcpServers;
      if (saved.userProfile !== undefined) s.userProfile = saved.userProfile;
    }));
    // Load cached model registry
    try {
      const rows = await query<{ key: string; value: string }>(
        "SELECT key, value FROM settings WHERE key IN ('model_registry', 'model_registry_updated')",
      );
      for (const row of rows) {
        if (row.key === "model_registry") {
          try { setRegistryModels(JSON.parse(row.value)); } catch { /* ignore */ }
        }
        if (row.key === "model_registry_updated") {
          setRegistryUpdated(row.value);
        }
      }
    } catch { /* ignore */ }

    setLoaded(true);
  });

  const value: SettingsContextValue = {
    settings,
    loaded,
    updateSetting: (key, val) => {
      setSettings(key, val as any);
      persistSetting(key, val);
    },
    updateProvider: (id, patch) => {
      setSettings(
        produce((s) => {
          const provider = s.providers.find((p) => p.id === id);
          if (provider) {
            Object.assign(provider, patch);
          }
        }),
      );
      persistSetting("providers", settings.providers);
    },
    addProvider: (id) => {
      const template = DEFAULT_PROVIDERS.find((p) => p.id === id);
      if (!template) return;
      if (settings.providers.some((p) => p.id === id)) return;
      setSettings(
        produce((s) => {
          s.providers.push({ ...template, enabled: true });
        }),
      );
      persistSetting("providers", settings.providers);
    },
    removeProvider: (id) => {
      setSettings(
        produce((s) => {
          const idx = s.providers.findIndex((p) => p.id === id);
          if (idx >= 0) s.providers.splice(idx, 1);
        }),
      );
      persistSetting("providers", settings.providers);
    },
    toggleStarredModel: (modelId) => {
      setSettings(
        produce((s) => {
          const idx = s.starredModels.indexOf(modelId);
          if (idx >= 0) {
            s.starredModels.splice(idx, 1);
          } else {
            s.starredModels.push(modelId);
          }
        }),
      );
      persistSetting("starredModels", settings.starredModels);
    },
    addCustomModel: (model) => {
      // Don't add if it already exists (built-in or custom)
      const exists = KNOWN_MODELS.some((m) => m.id === model.id && m.providerId === model.providerId)
        || settings.customModels.some((m) => m.id === model.id && m.providerId === model.providerId);
      if (exists) return;
      setSettings(
        produce((s) => {
          s.customModels.push(model);
        }),
      );
      persistSetting("customModels", settings.customModels);
    },
    removeCustomModel: (modelId, providerId) => {
      setSettings(
        produce((s) => {
          const idx = s.customModels.findIndex((m) => m.id === modelId && m.providerId === providerId);
          if (idx >= 0) s.customModels.splice(idx, 1);
        }),
      );
      persistSetting("customModels", settings.customModels);
    },
    allModels: () => {
      const base = registryModels().length > 0 ? registryModels() : KNOWN_MODELS;
      return [...base, ...settings.customModels];
    },
    updateModelRegistry: async () => {
      try {
        const models = await fetchModelRegistry();
        setRegistryModels(models);
        const now = new Date().toISOString();
        setRegistryUpdated(now);
        // Persist to SQLite
        await persistSetting("modelRegistry" as any, models);
        await execute(
          "INSERT INTO settings (key, value, updated_at) VALUES ('model_registry_updated', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')",
          [now, now],
        );
      } catch (e) {
        throw e;
      }
    },
    registryLastUpdated: () => registryUpdated(),
    addMcpServer: (server) => {
      if (settings.mcpServers.some((s) => s.id === server.id)) return;
      setSettings(produce((s) => { s.mcpServers.push(server); }));
      persistSetting("mcpServers", settings.mcpServers);
    },
    updateMcpServer: (id, patch) => {
      setSettings(produce((s) => {
        const srv = s.mcpServers.find((m) => m.id === id);
        if (srv) Object.assign(srv, patch);
      }));
      persistSetting("mcpServers", settings.mcpServers);
    },
    removeMcpServer: (id) => {
      setSettings(produce((s) => {
        const idx = s.mcpServers.findIndex((m) => m.id === id);
        if (idx >= 0) s.mcpServers.splice(idx, 1);
      }));
      persistSetting("mcpServers", settings.mcpServers);
    },
    activeApiKey: () => {
      const all = [...registryModels(), ...KNOWN_MODELS, ...settings.customModels];
      const { providerId } = parseModelSlug(settings.defaultModel, all);
      const provider = settings.providers.find((p) => p.id === providerId && p.enabled);
      return provider?.apiKey ?? "";
    },
    hasConfiguredProvider: () =>
      settings.providers.some((p) => p.enabled && p.apiKey.trim().length > 0),
  };

  return (
    <SettingsContext.Provider value={value}>
      {props.children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};
