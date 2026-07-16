import {
  createContext,
  useContext,
  createSignal,
  onMount,
  type Component,
  type JSX,
} from "solid-js";
import {
  listProfiles,
  saveProfile,
  deleteProfile,
  profileImpact,
  listPrompts,
  createPrompt,
  savePrompt,
  renamePrompt,
  deletePrompt,
  promptImpact,
  listCredentials,
  setApiKey,
  deleteCredential,
  restoreDefaultProfiles,
  getSharedConfigError,
  type ManagedProfileRecordDto,
  type ManagedPromptRecordDto,
  type CredentialSummaryDto,
  type DependencyImpactReportDto,
  type AgentProfileDto,
  type StoredPromptDto,
  type CreatePromptInput,
  type SeedReportDto,
  type MutationErrorDto,
  parseMutationError,
} from "@lib/tauri/config-commands";

export type { MutationErrorDto };

export class MutationError extends Error {
  dto: MutationErrorDto;
  constructor(dto: MutationErrorDto) {
    super(dto.message);
    this.dto = dto;
  }
}

export interface ConfigManagementContextValue {
  profiles: () => ManagedProfileRecordDto[];
  prompts: () => ManagedPromptRecordDto[];
  credentials: () => CredentialSummaryDto[];
  loading: () => boolean;
  error: () => string | null;
  profileError: () => string | null;
  promptError: () => string | null;
  credentialError: () => string | null;
  configInitError: () => string | null;
  zeroProfiles: () => boolean;
  refresh: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  refreshPrompts: () => Promise<void>;
  refreshCredentials: () => Promise<void>;

  saveProfile: (id: string, profile: AgentProfileDto) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  profileImpact: (profileId: string) => Promise<DependencyImpactReportDto>;

  createPrompt: (input: CreatePromptInput) => Promise<[string, StoredPromptDto]>;
  savePrompt: (id: string, prompt: StoredPromptDto) => Promise<void>;
  renamePrompt: (id: string, newDisplayName: string) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  promptImpact: (promptId: string) => Promise<DependencyImpactReportDto>;

  setApiKey: (providerSlug: string, apiKey: string) => Promise<void>;
  deleteCredential: (providerSlug: string) => Promise<void>;

  restoreDefaults: () => Promise<SeedReportDto>;
}

const ConfigManagementContext = createContext<ConfigManagementContextValue>();

export const ConfigManagementProvider: Component<{ children: JSX.Element }> = (props) => {
  const [profiles, setProfiles] = createSignal<ManagedProfileRecordDto[]>([]);
  const [prompts, setPrompts] = createSignal<ManagedPromptRecordDto[]>([]);
  const [credentials, setCredentials] = createSignal<CredentialSummaryDto[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [profileError, setProfileError] = createSignal<string | null>(null);
  const [promptError, setPromptError] = createSignal<string | null>(null);
  const [credentialError, setCredentialError] = createSignal<string | null>(null);
  const [configInitError, setConfigInitError] = createSignal<string | null>(null);

  const error = () => profileError() ?? promptError() ?? credentialError() ?? configInitError();

  const zeroProfiles = () => {
    if (loading()) return false;
    if (configInitError()) return false;
    if (profileError()) return false;
    const records = profiles();
    return (
      records.length === 0 ||
      !records.some((r) => r.status === "ready")
    );
  };

  const refreshProfiles = async () => {
    try {
      const result = await listProfiles();
      setProfiles(result);
      setProfileError(null);
    } catch (e) {
      const msg = typeof e === "string" ? e : String(e);
      setProfileError(msg);
      throw e;
    }
  };

  const refreshPrompts = async () => {
    try {
      const result = await listPrompts();
      setPrompts(result);
      setPromptError(null);
    } catch (e) {
      const msg = typeof e === "string" ? e : String(e);
      setPromptError(msg);
      throw e;
    }
  };

  const refreshCredentials = async () => {
    try {
      const result = await listCredentials();
      setCredentials(result);
      setCredentialError(null);
    } catch (e) {
      const msg = typeof e === "string" ? e : String(e);
      setCredentialError(msg);
      throw e;
    }
  };

  const refresh = async () => {
    setLoading(true);
    setProfileError(null);
    setPromptError(null);
    setCredentialError(null);

    // Check for shared config initialization error first.
    try {
      const initError = await getSharedConfigError();
      if (initError) {
        setConfigInitError(initError);
        setLoading(false);
        return;
      }
      setConfigInitError(null);
    } catch (e) {
      const message = typeof e === "string" ? e : String(e);
      setConfigInitError(`Unable to verify shared configuration: ${message}`);
      setLoading(false);
      return;
    }

    // Load each resource independently so a failure in one does not
    // suppress others.
    await Promise.allSettled([
      refreshProfiles(),
      refreshPrompts(),
      refreshCredentials(),
    ]);

    setLoading(false);
  };

  onMount(() => {
    refresh();
  });

  const wrapMutation = async (mutation: () => Promise<void>, refreshFn: () => Promise<void>) => {
    try {
      await mutation();
    } catch (e) {
      throw new MutationError(parseMutationError(e));
    }
    // Refresh after successful mutation. If refresh fails, the per-resource
    // error signal is set but the mutation itself succeeded.
    try {
      await refreshFn();
    } catch {
      // Error already captured in the per-resource signal.
    }
  };

  const value: ConfigManagementContextValue = {
    profiles,
    prompts,
    credentials,
    loading,
    error,
    profileError,
    promptError,
    credentialError,
    configInitError,
    zeroProfiles,
    refresh,
    refreshProfiles,
    refreshPrompts,
    refreshCredentials,

    saveProfile: (id, profile) =>
      wrapMutation(() => saveProfile(id, profile), refreshProfiles),
    deleteProfile: (id) =>
      wrapMutation(() => deleteProfile(id), refreshProfiles),
    profileImpact: async (profileId) => {
      return profileImpact(profileId);
    },

    createPrompt: async (input) => {
      try {
        const result = await createPrompt(input);
        try {
          await refreshPrompts();
        } catch {
          // Error already captured.
        }
        return result;
      } catch (e) {
        throw new MutationError(parseMutationError(e));
      }
    },
    savePrompt: (id, prompt) =>
      wrapMutation(() => savePrompt(id, prompt), refreshPrompts),
    renamePrompt: (id, newDisplayName) =>
      wrapMutation(() => renamePrompt(id, newDisplayName), refreshPrompts),
    deletePrompt: (id) =>
      wrapMutation(() => deletePrompt(id), refreshPrompts),
    promptImpact: async (promptId) => {
      return promptImpact(promptId);
    },

    setApiKey: (providerSlug, apiKey) =>
      wrapMutation(async () => { await setApiKey(providerSlug, apiKey); }, refreshCredentials),
    deleteCredential: (providerSlug) =>
      wrapMutation(() => deleteCredential(providerSlug), refreshCredentials),

    restoreDefaults: async () => {
      const report = await restoreDefaultProfiles();
      try {
        await refreshProfiles();
      } catch {
        // Error already captured.
      }
      return report;
    },
  };

  return (
    <ConfigManagementContext.Provider value={value}>
      {props.children}
    </ConfigManagementContext.Provider>
  );
};

export const useConfigManagement = () => {
  const ctx = useContext(ConfigManagementContext);
  if (!ctx)
    throw new Error("useConfigManagement must be used within ConfigManagementProvider");
  return ctx;
};
