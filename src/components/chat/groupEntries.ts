import type { ChatEntry } from "@/types/message";

export type GroupedEntry =
  | { kind: "message"; entry: ChatEntry }
  | { kind: "tool_group"; id: string; entries: ChatEntry[] };

/**
 * Groups consecutive tool_event entries (and interleaved empty assistant messages)
 * into tool groups. Non-empty messages break groups.
 */
export function groupEntries(entries: ChatEntry[]): GroupedEntry[] {
  const result: GroupedEntry[] = [];
  let toolGroup: ChatEntry[] = [];
  let groupId = "";

  const flushGroup = () => {
    if (toolGroup.length > 0) {
      result.push({ kind: "tool_group", id: groupId, entries: [...toolGroup] });
      toolGroup = [];
      groupId = "";
    }
  };

  for (const entry of entries) {
    if (entry.type === "tool_event") {
      if (toolGroup.length === 0) {
        groupId = entry.id;
      }
      toolGroup.push(entry);
    } else if (
      entry.type === "message" &&
      entry.message?.role === "assistant" &&
      !entry.message.content
    ) {
      // Empty assistant message between tool events — absorb into group
      if (toolGroup.length > 0) {
        toolGroup.push(entry);
      } else {
        // Not part of a group, skip it (will be hidden anyway)
      }
    } else {
      // Non-empty message breaks the group
      flushGroup();
      result.push({ kind: "message", entry });
    }
  }

  flushGroup();
  return result;
}
