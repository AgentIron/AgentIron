import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  type Component,
  type JSX,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { respondToApproval } from "@lib/tauri/commands";
import type { Message, ChatEntry } from "@/types/message";
import type { ToolEvent } from "@/types/agent";

interface PendingApproval {
  tabId: string;
  callId: string;
  toolName: string;
  arguments: unknown;
}

interface ChatState {
  entriesByTab: Record<string, ChatEntry[]>;
  streamingByTab: Record<string, boolean>;
  pendingApprovalByTab: Record<string, PendingApproval | null>;
  autoApprovedToolsByTab: Record<string, string[]>;
}

interface ChatContextValue {
  state: ChatState;
  addMessageEntry: (tabId: string, message: Message) => void;
  appendToLastAssistantContent: (tabId: string, text: string) => void;
  setLastAssistantContent: (tabId: string, content: string) => void;
  addToolEntry: (tabId: string, toolEvent: ToolEvent) => void;
  clearEntries: (tabId: string) => void;
  setStreaming: (tabId: string, streaming: boolean) => void;
  isStreaming: (tabId: string) => boolean;
  getPendingApproval: (tabId: string) => PendingApproval | null;
  respondApproval: (tabId: string, callId: string, approved: boolean) => void;
  respondApproveAll: (tabId: string, callId: string, toolName: string) => void;
  getEntries: (tabId: string) => ChatEntry[];
}

const ChatContext = createContext<ChatContextValue>();

export const ChatProvider: Component<{ children: JSX.Element }> = (props) => {
  const [state, setState] = createStore<ChatState>({
    entriesByTab: {},
    streamingByTab: {},
    pendingApprovalByTab: {},
    autoApprovedToolsByTab: {},
  });

  // Active tab ID ref — updated by consumers via the agent context
  // We need to read it inside event handlers, so we track it loosely
  let activeTabRef = "";

  const setActiveTabRef = (tabId: string) => {
    activeTabRef = tabId;
  };

  // ── Event listeners (moved from ChatArea) ──

  const unlisteners: UnlistenFn[] = [];

  onMount(async () => {
    // Stream chunk listener
    unlisteners.push(
      await listen<{ tabId: string; chunk: string }>(
        "agent-stream-chunk",
        (e) => {
          const { tabId, chunk } = e.payload;
          if (chunk) {
            appendToLastAssistant(tabId, chunk);
          }
        },
      ),
    );

    // Tool event listener
    unlisteners.push(
      await listen<ToolEvent>("agent-tool-event", (e) => {
        const event = e.payload;
        const tabId = event.tabId;

        if (event.type === "approval_request") {
          const autoApproved = state.autoApprovedToolsByTab[tabId] ?? [];
          if (event.toolName && autoApproved.includes(event.toolName)) {
            if (event.callId) {
              respondToApproval(tabId, event.callId, true);
            }
            upsertToolEntry(tabId, { ...event, type: "tool_call" });
            return;
          }
          setState("pendingApprovalByTab", tabId, {
            tabId,
            callId: event.callId!,
            toolName: event.toolName!,
            arguments: event.arguments,
          });
        }

        upsertToolEntry(tabId, event);

        // When a tool_call arrives during streaming, add a new empty
        // assistant message after it so subsequent Output chunks go
        // into this new message (interleaving text around tool calls)
        if (event.type === "tool_call") {
          setState(
            produce((s) => {
              if (!s.entriesByTab[tabId]) return;
              s.entriesByTab[tabId].push({
                id: crypto.randomUUID(),
                type: "message",
                message: {
                  id: crypto.randomUUID(),
                  conversationId: tabId,
                  role: "assistant",
                  content: "",
                  createdAt: new Date().toISOString(),
                },
              });
            }),
          );
        }
      }),
    );

    unlisteners.push(
      await listen<{ tabId: string; cancelled?: boolean }>("agent-stream-done", (e) => {
        const { tabId } = e.payload;
        setState("streamingByTab", tabId, false);
        setState("pendingApprovalByTab", tabId, null);
      }),
    );
  });

  onCleanup(() => {
    for (const unlisten of unlisteners) unlisten();
  });

  // ── Internal helpers ──

  const appendToLastAssistant = (tabId: string, text: string) => {
    setState(
      produce((s) => {
        const entries = s.entriesByTab[tabId];
        if (!entries) return;
        for (let i = entries.length - 1; i >= 0; i--) {
          if (entries[i].type === "message" && entries[i].message?.role === "assistant") {
            entries[i].message!.content += text;
            return;
          }
        }
      }),
    );
  };

  const upsertToolEntry = (tabId: string, toolEvent: ToolEvent) => {
    setState(
      produce((s) => {
        if (!s.entriesByTab[tabId]) s.entriesByTab[tabId] = [];

        // Find existing entry with the same callId and update it
        if (toolEvent.type !== "script_activity" && toolEvent.callId) {
          const existing = s.entriesByTab[tabId].find(
            (e) => e.type === "tool_event" && e.toolEvent?.callId === toolEvent.callId,
          );
          if (existing && existing.toolEvent) {
            // Merge: update status/type, add result if it's a tool_result
            existing.toolEvent.type = toolEvent.type;
            if (toolEvent.status) existing.toolEvent.status = toolEvent.status;
            if (toolEvent.result !== undefined) existing.toolEvent.result = toolEvent.result;
            if (toolEvent.message) existing.toolEvent.message = toolEvent.message;
            return;
          }
        }

        // No existing entry — create new one
        s.entriesByTab[tabId].push({
          id: crypto.randomUUID(),
          type: "tool_event",
          toolEvent,
        });
      }),
    );
  };

  // ── Context value ──

  const value: ChatContextValue = {
    state,
    addMessageEntry: (tabId, message) =>
      setState(
        produce((s) => {
          if (!s.entriesByTab[tabId]) s.entriesByTab[tabId] = [];
          s.entriesByTab[tabId].push({
            id: message.id,
            type: "message",
            message,
          });
        }),
      ),
    appendToLastAssistantContent: appendToLastAssistant,
    setLastAssistantContent: (tabId, content) =>
      setState(
        produce((s) => {
          const entries = s.entriesByTab[tabId];
          if (!entries) return;
          for (let i = entries.length - 1; i >= 0; i--) {
            if (entries[i].type === "message" && entries[i].message?.role === "assistant") {
              entries[i].message!.content = content;
              return;
            }
          }
        }),
      ),
    addToolEntry: (tabId, toolEvent) => upsertToolEntry(tabId, toolEvent),
    clearEntries: (tabId) => setState("entriesByTab", tabId, []),
    setStreaming: (tabId, streaming) =>
      setState("streamingByTab", tabId, streaming),
    isStreaming: (tabId) => state.streamingByTab[tabId] ?? false,
    getPendingApproval: (tabId) => state.pendingApprovalByTab[tabId] ?? null,
    respondApproval: (tabId, callId, approved) => {
      respondToApproval(tabId, callId, approved);
      setState("pendingApprovalByTab", tabId, null);
    },
    respondApproveAll: (tabId, callId, toolName) => {
      respondToApproval(tabId, callId, true);
      setState("pendingApprovalByTab", tabId, null);
      setState(
        produce((s) => {
          if (!s.autoApprovedToolsByTab[tabId]) s.autoApprovedToolsByTab[tabId] = [];
          if (!s.autoApprovedToolsByTab[tabId].includes(toolName)) {
            s.autoApprovedToolsByTab[tabId].push(toolName);
          }
        }),
      );
    },
    getEntries: (tabId) => state.entriesByTab[tabId] ?? [],
  };

  return (
    <ChatContext.Provider value={value}>{props.children}</ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
};
