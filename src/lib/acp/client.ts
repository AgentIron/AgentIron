// ACP client interface — calls into Rust backend
// which manages iron-core agent instances

import { disconnectAgent, listAgents, sendMessage } from "@lib/tauri/commands";
import type { AgentConnection } from "@/types/agent";

export class AcpClient {
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
