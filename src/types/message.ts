export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ChatEntry {
  id: string;
  type: "message" | "tool_event";
  message?: Message;
  toolEvent?: import("@/types/agent").ToolEvent;
}

export interface Conversation {
  id: string;
  agentConfigId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}
