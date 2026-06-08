import { For, Index, Show, Switch, Match, createEffect, createMemo, createSignal, onCleanup, untrack, type Component } from "solid-js";
import { Transition } from "solid-transition-group";
import { useChat } from "@context/ChatContext";
import { useAgent } from "@context/AgentContext";
import { useUI } from "@context/UIContext";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { ApprovalBar } from "./ApprovalBar";
import { StatusBar } from "./StatusBar";
import { ToolActivityLine } from "./ToolActivityLine";
import { ToolActivitySummary } from "./ToolActivitySummary";
import { ToolHistoryPanel } from "./ToolHistoryPanel";
import { ModelInfoPanel } from "./ModelInfoPanel";
import { groupEntries } from "./groupEntries";
import { McpPanel } from "@components/mcp/McpPanel";
import type { ChatEntry } from "@/types/message";

const BOTTOM_SCROLL_THRESHOLD = 48;

export const ChatArea: Component = () => {
  const { state: chatState, isStreaming } = useChat();
  const { state: agentState } = useAgent();
  const { rightPane } = useUI();
  let messagesContainerRef: HTMLDivElement | undefined;
  let scrollFrame: number | undefined;
  const [isPinnedToBottom, setIsPinnedToBottom] = createSignal(true);

  const activeTabId = () => agentState.activeTabId ?? "";
  const entries = () => chatState.entriesByTab[activeTabId()] ?? [];
  const streaming = () => isStreaming(activeTabId());

  // Split entries into sealed history and active response turn
  const responseTurnStart = () => streaming() ? getResponseTurnStartIndex(entries()) : entries().length;
  const sealedEntries = () => entries().slice(0, responseTurnStart());
  const activeEntries = () => {
    const start = responseTurnStart();
    return start < entries().length ? entries().slice(start) : [];
  };

  // Structural memo: only recomputes when sealed structure changes, not content
  const sealedFingerprint = createMemo(() =>
    sealedHistoryFingerprint(sealedEntries()),
  );
  // Touch the fingerprint so the memo tracks it, but render from stable entries
  const sealedGrouped = createMemo(() => {
    void sealedFingerprint();
    return untrack(() => groupEntries(sealedEntries()));
  });
  const activeGrouped = () => groupEntries(activeEntries());

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

  return (
    <div class="relative flex flex-1 min-h-0 overflow-hidden">
      {/* Main chat column — reserves space on the right while a panel is open */}
      <div
        class="flex-1 flex flex-col min-w-0 transition-[padding] duration-200"
        classList={{ "pr-80": rightPane() !== null }}
      >
        <div
          ref={messagesContainerRef}
          class="flex-1 overflow-auto px-6 py-4"
          onScroll={handleMessagesScroll}
        >
          {/* Sealed History */}
          <For each={sealedGrouped()}>
            {(group) => {
              const messageEntry = () => {
                const currentGroup = group;
                return currentGroup.kind === "message" ? currentGroup.entry : undefined;
              };
              const toolGroupEntries = () => {
                const currentGroup = group;
                return currentGroup.kind === "tool_group" ? currentGroup.entries : undefined;
              };

              return (
                <Show
                  when={messageEntry()}
                  keyed
                  fallback={
                    <Show when={toolGroupEntries()} keyed>
                      {(toolEntries) => <ToolActivitySummary entries={toolEntries} />}
                    </Show>
                  }
                >
                  {(entry) => {
                    if (!entry.message) return null;
                    if (entry.message.role === "assistant" && !entry.message.content) {
                      return null;
                    }
                    return (
                      <MessageBubble
                        role={entry.message.role}
                        content={entry.message.content}
                        createdAt={entry.message.createdAt}
                        animate={false}
                      />
                    );
                  }}
                </Show>
              );
            }}
          </For>

          {/* Active Zone */}
          <Index each={activeGrouped()}>
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
          <StatusBar />
        </div>
      </div>

      {/* Right side panel — overlay drawer that opens over the reserved space,
          so switching panels never shifts the chat column. */}
      <div class="absolute top-0 right-0 bottom-0 w-80 pointer-events-none">
        <Transition name="slide-right">
          <Show when={rightPane()} keyed>
            {(pane) => (
              <div class="absolute inset-0 pointer-events-auto">
                <Switch>
                  <Match when={pane === "mcp"}>
                    <McpPanel />
                  </Match>
                  <Match when={pane === "tools"}>
                    <ToolHistoryPanel />
                  </Match>
                  <Match when={pane === "model"}>
                    <ModelInfoPanel />
                  </Match>
                </Switch>
              </div>
            )}
          </Show>
        </Transition>
      </div>
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

/** Find the start index of the current response turn (latest user prompt + following assistant/tools) */
function getResponseTurnStartIndex(entries: ChatEntry[]): number {
  let lastUserIndex = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type === "message" && entries[i].message?.role === "user") {
      lastUserIndex = i;
      break;
    }
  }
  return lastUserIndex >= 0 ? lastUserIndex : entries.length;
}

/** Structural fingerprint that ignores message content mutations */
function sealedHistoryFingerprint(entries: ChatEntry[]): string {
  return entries
    .map((e) => {
      if (e.type === "message") return `${e.id}:msg:${e.message?.role ?? ""}`;
      return `${e.id}:tool:${e.toolEvent?.type ?? ""}:${e.toolEvent?.status ?? ""}`;
    })
    .join("|");
}
