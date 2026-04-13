// ACP client interface — calls into Rust backend
// which manages iron-core agent instances

import { connectAgent, disconnectAgent, listAgents, sendMessage } from "@lib/tauri/commands";
import type { AgentConnection } from "@/types/agent";

export class AcpClient {
  async connect(transport: string, endpoint?: string): Promise<AgentConnection> {
    return connectAgent(transport, endpoint);
  }

  async disconnect(agentId: string): Promise<void> {
    return disconnectAgent(agentId);
  }

  async list(): Promise<AgentConnection[]> {
    return listAgents();
  }

  async prompt(agentId: string, content: string) {
    return sendMessage(agentId, content);
  }
}

export const acpClient = new AcpClient();
