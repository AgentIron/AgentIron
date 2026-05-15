import { For, Index, Show, createEffect, createSignal, onCleanup, type Component } from "solid-js";
import { Transition } from "solid-transition-group";
import { TbOutlineServer } from "solid-icons/tb";
import { useChat } from "@context/ChatContext";
import { useAgent } from "@context/AgentContext";
import { useUI } from "@context/UIContext";
import { useSettings } from "@context/SettingsContext";
import { useMcp } from "@context/McpContext";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { ApprovalBar } from "./ApprovalBar";
import { DirectoryIndicator } from "./DirectoryIndicator";
import { ModelSwitcher } from "./ModelSwitcher";
import { ContextIndicator } from "./ContextIndicator";
import { ToolActivityLine } from "./ToolActivityLine";
import { ToolActivitySummary } from "./ToolActivitySummary";
import { groupEntries } from "./groupEntries";
import { McpPanel } from "@components/mcp/McpPanel";
import type { ChatEntry } from "@/types/message";

const BOTTOM_SCROLL_THRESHOLD = 48;

export const ChatArea: Component = () => {
  const { state: chatState, isStreaming } = useChat();
  const { state: agentState } = useAgent();
  const { mcpPaneOpen, setMcpPaneOpen } = useUI();
  const { settings } = useSettings();
  const { serverStatuses } = useMcp();
  let messagesContainerRef: HTMLDivElement | undefined;
  let scrollFrame: number | undefined;
  const [isPinnedToBottom, setIsPinnedToBottom] = createSignal(true);

  const activeTabId = () => agentState.activeTabId ?? "";
  const entries = () => chatState.entriesByTab[activeTabId()] ?? [];
  const grouped = () => groupEntries(entries());
  const streaming = () => isStreaming(activeTabId());

  const isNearBottom = () => {
    if (!messagesContainerRef) return true;
    const distanceFromBottom =
      messagesContainerRef.scrollHeight - messagesContainerRef.scrollTop - messagesContainerRef.clientHeight;
    return distanceFromBottom <= BOTTOM_SCROLL_THRESHOLD;
  };

  const handleMessagesScroll = () => {
    setIsPinnedToBottom(isNearBottom());
  };

  const scrollToBottom = () => {
    if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const container = messagesContainerRef;
      if (!container) {
        scrollFrame = undefined;
        return;
      }
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "auto",
      });
      scrollFrame = undefined;
    });
  };

  onCleanup(() => {
    if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
  });

  createEffect(() => {
    const tabId = activeTabId();
    if (!tabId) return;
    const currentEntries = chatState.entriesByTab[tabId] ?? [];
    const lastAssistantLength = getLastAssistantContentLength(currentEntries);
    const toolActivityKey = getToolActivityKey(currentEntries);
    const scrollTrigger = `${currentEntries.length}:${lastAssistantLength}:${toolActivityKey}:${isStreaming(tabId)}`;

    void scrollTrigger;

    if (currentEntries.length && isPinnedToBottom()) {
      scrollToBottom();
    }
  });

  // Fade content on tab switch
  createEffect(() => {
    activeTabId(); // track
    setIsPinnedToBottom(true);
    if (messagesContainerRef) {
      messagesContainerRef.classList.remove("animate-content-fade");
      requestAnimationFrame(() => {
        messagesContainerRef?.classList.add("animate-content-fade");
        scrollToBottom();
      });
    }
  });

  const hasMcpServers = () => settings.mcpServers.length > 0;
  const connectedCount = () => serverStatuses().filter((s) => s.health === "Connected").length;
  const hasError = () => serverStatuses().some((s) => s.health === "Error");
  const mcpButtonColor = () => {
    if (mcpPaneOpen()) return "text-accent bg-accent-muted";
    if (hasError()) return "text-error hover:bg-bg-hover";
    if (connectedCount() > 0) return "text-success hover:bg-bg-hover";
    return "text-text-secondary hover:text-text-primary hover:bg-bg-hover";
  };

  return (
    <div class="flex flex-1 min-h-0">
      {/* Main chat column */}
      <div class="flex-1 flex flex-col min-w-0">
        <div class="flex items-center px-4 py-1.5 border-b border-border-subtle bg-bg-secondary/50">
          <DirectoryIndicator />
          <div class="flex items-center gap-1 ml-auto">
            <ContextIndicator />
            <div class="w-px h-4 bg-border-subtle" />
            <ModelSwitcher />
            <Show when={hasMcpServers()}>
              <div class="w-px h-4 bg-border-subtle" />
              <button
                onClick={() => setMcpPaneOpen(!mcpPaneOpen())}
                class={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${mcpButtonColor()}`}
                title="MCP Servers"
              >
                <TbOutlineServer size={13} />
                <span>
                  {connectedCount() > 0
                    ? `${connectedCount()}/${settings.mcpServers.length}`
                    : settings.mcpServers.length}
                </span>
              </button>
            </Show>
          </div>
        </div>
        <div
          ref={messagesContainerRef}
          class="flex-1 overflow-auto px-6 py-4"
          onScroll={handleMessagesScroll}
        >
          <Index each={grouped()}>
            {(group) => {
              const messageEntry = () => {
                const currentGroup = group();
                return currentGroup.kind === "message" ? currentGroup.entry : undefined;
              };
              const toolGroupEntries = () => {
                const currentGroup = group();
                return currentGroup.kind === "tool_group" ? currentGroup.entries : undefined;
              };

              return (
                <Show
                  when={messageEntry()}
                  keyed
                  fallback={
                    <Show when={toolGroupEntries()} keyed>
                      {(toolEntries) => (
                        <Show
                          when={!streaming()}
                          fallback={
                            <div class="mb-2">
                              <For each={toolEntries.filter((e) => e.type === "tool_event")}>
                                {(entry) => <ToolActivityLine event={entry.toolEvent!} />}
                              </For>
                            </div>
                          }
                        >
                          <ToolActivitySummary entries={toolEntries} />
                        </Show>
                      )}
                    </Show>
                  }
                >
                  {(entry) => {
                    if (!entry.message) return null;

                    const isLastAssistant = () =>
                      entry.message!.role === "assistant" &&
                      isLastAssistantInList(entries(), entry.id);

                    const isStreamingMsg = () => isLastAssistant() && streaming();

                    // Skip empty assistant messages that aren't streaming
                    if (entry.message.role === "assistant" && !entry.message.content && !isStreamingMsg()) {
                      return null;
                    }

                    return (
                      <MessageBubble
                        role={entry.message.role}
                        content={entry.message.content}
                        createdAt={entry.message.createdAt}
                        isStreaming={isStreamingMsg()}
                      />
                    );
                  }}
                </Show>
              );
            }}
          </Index>
        </div>
        <ApprovalBar />
        <div class="px-6 pb-4 pt-2">
          <MessageInput />
        </div>
      </div>

      {/* MCP right pane */}
      <Transition name="slide-right">
        <Show when={mcpPaneOpen()}>
          <McpPanel />
        </Show>
      </Transition>
    </div>
  );
};

/** Check if entry with given id is the last assistant message in the list */
function isLastAssistantInList(entries: ChatEntry[], entryId: string): boolean {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type === "message" && entries[i].message?.role === "assistant") {
      return entries[i].id === entryId;
    }
  }
  return false;
}

function getLastAssistantContentLength(entries: ChatEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type === "message" && entries[i].message?.role === "assistant") {
      return entries[i].message?.content.length ?? 0;
    }
  }
  return 0;
}

function getToolActivityKey(entries: ChatEntry[]): string {
  return entries
    .filter((entry) => entry.type === "tool_event")
    .map((entry) => `${entry.id}:${entry.toolEvent?.type ?? ""}:${entry.toolEvent?.status ?? ""}`)
    .join("|");
}
