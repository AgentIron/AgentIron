import { invoke } from "@tauri-apps/api/core";

// ── Config management commands ──

export interface AgentProfileDto {
  name: string;
  kind: "runtimeDefault" | "managed";
  providerSlug?: string;
  model?: string;
  tools: { kind: "inherit" } | { kind: "allow"; names: string[] } | { kind: "deny"; names: string[] };
  skills: { kind: "none" } | { kind: "allow"; names: string[] } | { kind: "inherit" };
  approval: "perTool" | "autoApprove";
  identityPrompt?: string;
}

export interface ManagedProfileEntryDto {
  id: string;
  profile: AgentProfileDto;
  createdAt: string;
  updatedAt: string;
}

export interface RecordDiagnosticDto {
  category: string;
  message: string;
}

export type ManagedProfileRecordDto =
  | { status: "ready"; entry: ManagedProfileEntryDto }
  | { status: "needsAttention"; id: string; decoded?: AgentProfileDto; diagnostics: RecordDiagnosticDto[] };

export interface StoredPromptDto {
  displayName: string;
  normalizedName: string;
  instructions: string;
  skills: string[];
  profile?: string;
}

export interface ManagedPromptEntryDto {
  id: string;
  prompt: StoredPromptDto;
  identityState: string;
  createdAt: string;
  updatedAt: string;
}

export type ManagedPromptRecordDto =
  | { status: "ready"; entry: ManagedPromptEntryDto }
  | { status: "needsAttention"; id: string; decoded?: StoredPromptDto; diagnostics: RecordDiagnosticDto[] };

export type CredentialMode = "apikey" | "oauthbearer" | "unsupported";
export type CredentialAuthStatus =
  | "configuredApiKey"
  | "connectedOAuth"
  | "refreshing"
  | "expired"
  | "revoked"
  | "notConfigured"
  | "unsupported"
  | `refreshFailed:${string}`;

export interface CredentialSummaryDto {
  providerSlug: string;
  credentialMode: CredentialMode;
  authStatus: CredentialAuthStatus;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type DependencyEntityDto =
  | { kind: "providerCredential"; slug: string }
  | { kind: "profile"; id: string }
  | { kind: "prompt"; id: string }
  | { kind: "automationTask"; id: string }
  | { kind: "scheduledTask"; id: string };

export interface DependencyLinkDto {
  entity: DependencyEntityDto;
  direction: "depends" | "dependent";
  proximity: "direct" | "transitive";
  path: DependencyEntityDto[];
}

export interface DependencyImpactReportDto {
  target: DependencyEntityDto;
  links: DependencyLinkDto[];
  diagnostics: string[];
}

export function formatDependencyEntity(entity: DependencyEntityDto): string {
  switch (entity.kind) {
    case "providerCredential":
      return `Provider credential: ${entity.slug}`;
    case "profile":
      return `Profile: ${entity.id}`;
    case "prompt":
      return `Prompt: ${entity.id}`;
    case "automationTask":
      return `Automation task: ${entity.id}`;
    case "scheduledTask":
      return `Scheduled task: ${entity.id}`;
  }
}

export interface SeedReportDto {
  policy: string;
  markerWasPresent: boolean;
  markerWritten: boolean;
  created: string[];
  skippedExisting: string[];
  diagnostics: string[];
}

export interface CreatePromptInput {
  displayName: string;
  instructions: string;
  skills: string[];
  profile?: string;
}

export interface MutationErrorDto {
  kind: string;
  message: string;
  field?: string;
  referrers?: string[];
}

/// Normalize a Tauri rejection value into a MutationErrorDto.
/// Handles both typed DTO rejections and legacy string errors.
export function parseMutationError(e: unknown): MutationErrorDto {
  if (typeof e === "string") {
    return { kind: "unknown", message: e };
  }
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") {
      return {
        kind: typeof obj.kind === "string" ? obj.kind : "unknown",
        message: obj.message,
        field: typeof obj.field === "string" ? obj.field : undefined,
        referrers: Array.isArray(obj.referrers) ? (obj.referrers as string[]) : undefined,
      };
    }
  }
  return { kind: "unknown", message: String(e) };
}

// ── Profile commands ──

export async function listProfiles(): Promise<ManagedProfileRecordDto[]> {
  return invoke("list_profiles");
}

export async function getProfile(id: string): Promise<ManagedProfileRecordDto | null> {
  return invoke("get_profile", { id });
}

export async function saveProfile(id: string, profile: AgentProfileDto): Promise<void> {
  return invoke("save_profile", { id, profile });
}

export async function deleteProfile(id: string): Promise<void> {
  return invoke("delete_profile", { id });
}

export async function profileImpact(profileId: string): Promise<DependencyImpactReportDto> {
  return invoke("profile_impact", { profileId });
}

// ── Prompt commands ──

export async function listPrompts(): Promise<ManagedPromptRecordDto[]> {
  return invoke("list_prompts");
}

export async function getPrompt(id: string): Promise<ManagedPromptRecordDto | null> {
  return invoke("get_prompt", { id });
}

export async function createPrompt(input: CreatePromptInput): Promise<[string, StoredPromptDto]> {
  return invoke("create_prompt", { input });
}

export async function savePrompt(id: string, prompt: StoredPromptDto): Promise<void> {
  return invoke("save_prompt", { id, prompt });
}

export async function renamePrompt(id: string, newDisplayName: string): Promise<void> {
  return invoke("rename_prompt", { id, newDisplayName });
}

export async function deletePrompt(id: string): Promise<void> {
  return invoke("delete_prompt", { id });
}

export async function promptImpact(promptId: string): Promise<DependencyImpactReportDto> {
  return invoke("prompt_impact", { promptId });
}

// ── Credential commands ──

export async function listCredentials(): Promise<CredentialSummaryDto[]> {
  return invoke("list_credentials");
}

export async function setApiKey(providerSlug: string, apiKey: string): Promise<CredentialSummaryDto> {
  return invoke("set_api_key", { providerSlug, apiKey });
}

export async function deleteCredential(providerSlug: string): Promise<void> {
  return invoke("delete_credential", { providerSlug });
}

// ── Seed / recovery commands ──

export async function seedDefaultProfiles(): Promise<SeedReportDto> {
  return invoke("seed_default_profiles");
}

export async function restoreDefaultProfiles(): Promise<SeedReportDto> {
  return invoke("restore_default_profiles");
}

export async function getSharedConfigError(): Promise<string | null> {
  return invoke("get_shared_config_error");
}
