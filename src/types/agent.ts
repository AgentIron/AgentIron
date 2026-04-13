export type Transport = "in-process" | "stdio" | "tcp";
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface AgentConnection {
  id: string;
  tabId: string;
  name: string;
  transport: Transport;
  status: ConnectionStatus;
  endpoint?: string;
  workingDirectory?: string;
  model?: string;
  providerId?: string;
  customName?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  transport: Transport;
  endpoint?: string;
  model: string;
  maxIterations: number;
  temperature?: number;
}

export interface ToolEvent {
  tabId: string;
  type: "tool_call" | "approval_request" | "tool_result" | "status";
  callId?: string;
  toolName?: string;
  arguments?: unknown;
  status?: string;
  result?: unknown;
  message?: string;
}
