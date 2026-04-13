// TypeScript types mirroring iron-core ACP models
// These should stay in sync with src-tauri/src/acp/types.rs

export type AcpTransport = "in-process" | "stdio" | "tcp";

export interface AcpSessionEvent {
  type: "text" | "tool_call" | "tool_result" | "error" | "done";
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
}

export interface AcpPromptOptions {
  model?: string;
  temperature?: number;
  maxIterations?: number;
}
