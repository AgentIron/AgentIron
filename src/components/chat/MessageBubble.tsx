import { createSignal, onCleanup, Show, type Component } from "solid-js";
import { TbOutlineRobot, TbOutlineUser } from "solid-icons/tb";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { timeAgo } from "@lib/timeago";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  isStreaming?: boolean;
}

export const MessageBubble: Component<MessageBubbleProps> = (props) => {
  // Auto-updating timestamp
  const [tick, setTick] = createSignal(0);
  const interval = setInterval(() => setTick((t) => t + 1), 30000);
  onCleanup(() => clearInterval(interval));
  const timestamp = () => {
    tick(); // read signal to subscribe
    return timeAgo(props.createdAt);
  };

  if (props.role === "system") {
    return (
      <div class="flex justify-center mb-3 animate-message-in">
        <span class="text-xs text-text-tertiary italic">{props.content}</span>
      </div>
    );
  }

  if (props.role === "user") {
    return (
      <div class="flex justify-end mb-4 animate-message-in">
        <div class="flex items-start gap-3 max-w-[80%]">
          <div class="bg-bg-tertiary rounded-xl px-4 py-3">
            <p class="text-sm whitespace-pre-wrap">{props.content}</p>
          </div>
          <div class="flex-shrink-0 w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center mt-0.5">
            <TbOutlineUser size={15} class="text-text-secondary" />
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div class="flex mb-6 animate-message-in">
      <div class="flex items-start gap-3 max-w-full">
        <div class="flex-shrink-0 w-7 h-7 rounded-full bg-accent-muted flex items-center justify-center mt-0.5">
          <TbOutlineRobot size={15} class="text-accent" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-medium text-text-secondary">Assistant</span>
            <Show when={!props.isStreaming}>
              <span class="text-xs text-text-tertiary">{timestamp()}</span>
            </Show>
          </div>
          <Show
            when={props.content}
            fallback={
              <Show when={props.isStreaming}>
                <StreamingDots />
              </Show>
            }
          >
            <div>
              <MarkdownRenderer content={props.content} />
              <Show when={props.isStreaming}>
                <StreamingDots />
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

const StreamingDots: Component = () => (
  <span class="inline-flex items-center gap-1 mt-1">
    <span class="streaming-dot" />
    <span class="streaming-dot" />
    <span class="streaming-dot" />
  </span>
);
