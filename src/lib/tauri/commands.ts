import { invoke } from "@tauri-apps/api/core";
import type { AgentConnection } from "@/types/agent";

export async function createAgent(
  apiKey: string,
  model: string,
  tabId: string,
  workingDirectory?: string,
  providerId?: string,
  mcpServers?: import("@/types/settings").McpServerConfig[],
  transport?: string,
): Promise<AgentConnection> {
  return invoke("create_agent", { apiKey, model, tabId, workingDirectory, providerId, mcpServers, transport: transport ?? "in-process" });
}

export async function disconnectAgent(tabId: string): Promise<void> {
  return invoke("disconnect_agent", { tabId });
}

export async function listAgents(): Promise<AgentConnection[]> {
  return invoke("list_agents");
}

export async function sendMessage(
  tabId: string,
  content: string,
): Promise<{ id: string; role: string; content: string }> {
  return invoke("send_message", { tabId, content });
}

export async function sendMessageWithImages(
  tabId: string,
  content: string,
  images: { data: string; mimeType: string }[],
): Promise<{ id: string; role: string; content: string }> {
  return invoke("send_message_with_images", { tabId, content, images });
}

export async function compactSession(tabId: string): Promise<void> {
  return invoke("compact_session", { tabId });
}

export async function respondToApproval(
  tabId: string,
  callId: string,
  approved: boolean,
): Promise<void> {
  return invoke("respond_to_approval", { tabId, callId, approved });
}

export async function cancelActivePrompt(tabId: string): Promise<void> {
  return invoke("cancel_active_prompt", { tabId });
}

export async function registerMcpServer(
  tabId: string,
  config: import("@/types/settings").McpServerConfig,
): Promise<void> {
  return invoke("register_mcp_server", { tabId, config });
}

export async function getMcpStatus(
  tabId: string,
): Promise<import("@/types/settings").McpServerStatus[]> {
  return invoke("get_mcp_status", { tabId });
}

export async function setMcpServerEnabled(
  tabId: string,
  serverId: string,
  enabled: boolean,
): Promise<void> {
  return invoke("set_mcp_server_enabled", { tabId, serverId, enabled });
}

export async function updateModelRegistry(): Promise<import("@/types/settings").ModelInfo[]> {
  return invoke("update_model_registry");
}

export async function startSnip(): Promise<void> {
  return invoke("start_snip");
}

// ── Skill commands ──

export async function refreshSkillCatalog(
  tabId: string,
): Promise<{ level: string; message: string; skillName?: string }[]> {
  return invoke("refresh_skill_catalog", { tabId });
}

export async function listAvailableSkills(
  tabId: string,
): Promise<{ id: string; displayName: string; description: string; origin: string; autoActivate: boolean; tags: string[]; requiresTools: string[]; requiresCapabilities: string[]; requiresTrust: boolean }[]> {
  return invoke("list_available_skills", { tabId });
}

export async function activateSkill(tabId: string, name: string): Promise<void> {
  return invoke("activate_skill", { tabId, name });
}

export async function deactivateSkill(tabId: string, name: string): Promise<void> {
  return invoke("deactivate_skill", { tabId, name });
}

export async function listActiveSkills(tabId: string): Promise<string[]> {
  return invoke("list_active_skills", { tabId });
}

// ── Handoff commands ──

export async function exportHandoff(tabId: string): Promise<unknown> {
  return invoke("export_handoff", { tabId });
}

export async function importHandoff(tabId: string, bundle: unknown): Promise<void> {
  return invoke("import_handoff", { tabId, bundle });
}

export async function saveHandoffBundle(tabId: string, filePath: string): Promise<void> {
  return invoke("save_handoff_bundle", { tabId, filePath });
}

export async function loadHandoffBundle(filePath: string): Promise<unknown> {
  return invoke("load_handoff_bundle", { filePath });
}
