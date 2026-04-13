import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Tauri event listeners — abstraction boundary for web support

export async function onAgentEvent(
  callback: (event: { payload: unknown }) => void,
): Promise<UnlistenFn> {
  return listen("agent-event", callback);
}

export async function onAgentStreamChunk(
  callback: (event: { payload: { tabId: string; chunk: string } }) => void,
): Promise<UnlistenFn> {
  return listen("agent-stream-chunk", callback);
}
