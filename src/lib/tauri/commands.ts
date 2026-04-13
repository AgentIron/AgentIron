import { invoke } from "@tauri-apps/api/core";
import type { AgentConnection } from "@/types/agent";

export async function createAgent(
  apiKey: string,
  model: string,
  tabId: string,
  workingDirectory?: string,
  providerId?: string,
  mcpServers?: import("@/types/settings").McpServerConfig[],
): Promise<AgentConnection> {
  return invoke("create_agent", { apiKey, model, tabId, workingDirectory, providerId, mcpServers });
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

