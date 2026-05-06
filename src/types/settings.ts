export interface ProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  contextWindow?: number;
  outputLimit?: number;
  toolCall?: boolean;
  reasoning?: boolean;
  vision?: boolean;
  costInput?: number;   // per million tokens USD
  costOutput?: number;
}

export interface UserProfile {
  name: string;
  email: string;
}

export interface McpServerConfig {
  id: string;
  label: string;
  transport: "stdio" | "http" | "http_sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  workingDir?: string;
  enabledByDefault: boolean;
  description?: string;
}

// MCP runtime state (queried from iron-core, not persisted)
export type McpServerHealth = "Configured" | "Connecting" | "Connected" | "Error" | "Disabled";

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: unknown;
}

export type McpErrorCategory =
  | "transportSetup"
  | "initialize"
  | "responseParse"
  | "auth"
  | "toolDiscovery"
  | "serverError"
  | "unknown";

export type McpErrorStage = "connection" | "initialize" | "toolDiscovery";

export interface McpServerStatus {
  id: string;
  label: string;
  health: McpServerHealth;
  transport: string;
  endpoint: string;
  discoveredTools: McpToolInfo[];
  lastError: string | null;
  errorCategory: McpErrorCategory | null;
  errorStage: McpErrorStage | null;
  guidance: string | null;
  enabled: boolean;
}

export interface SkillSettings {
  trustProjectSkills: boolean;
  additionalSkillDirs: string[];
}

export interface AppSettings {
  theme: "light" | "dark";
  autostart: boolean;
  quickLaunchShortcut: string;
  providers: ProviderConfig[];
  defaultModel: string; // format: "providerId/modelId" e.g. "openai/gpt-4o"
  starredModels: string[];
  customModels: ModelInfo[];
  mcpServers: McpServerConfig[];
  userProfile: UserProfile;
  skills: SkillSettings;
}
