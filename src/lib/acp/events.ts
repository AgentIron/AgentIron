// Agent event stream handling
// Subscribes to Tauri events emitted by the Rust backend
// when iron-core streams responses

import { onAgentStreamChunk } from "@lib/tauri/events";
import type { AcpSessionEvent } from "./types";

export async function subscribeToAgentStream(
  tabId: string,
  onEvent: (event: AcpSessionEvent) => void,
) {
  return onAgentStreamChunk((e) => {
    if (e.payload.tabId === tabId) {
      try {
        const parsed = JSON.parse(e.payload.chunk) as AcpSessionEvent;
        onEvent(parsed);
      } catch {
        onEvent({ type: "text", content: e.payload.chunk });
      }
    }
  });
}
