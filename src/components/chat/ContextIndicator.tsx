import { createSignal, onMount, onCleanup, type Component } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { useAgent } from "@context/AgentContext";
import { useSettings } from "@context/SettingsContext";
import { formatTokenCount } from "@lib/models";

export const ContextIndicator: Component = () => {
  const { state: agentState, activeConnection } = useAgent();
  const { allModels } = useSettings();
  const [activeTokens, setActiveTokens] = createSignal(0);

  onMount(async () => {
    const unlisten = await listen<{ tabId: string; activeTokens: number }>(
      "agent-context-update",
      (e) => {
        if (e.payload.tabId === agentState.activeTabId) {
          setActiveTokens(e.payload.activeTokens);
        }
      },
    );
    onCleanup(() => unlisten());
  });

  const maxContext = () => {
    const conn = activeConnection();
    if (!conn?.model) return undefined;
    const model = allModels().find((m) => m.id === conn.model && m.providerId === conn.providerId);
    return model?.contextWindow;
  };

  const usagePercent = () => {
    const max = maxContext();
    if (!max || !activeTokens()) return 0;
    return Math.min((activeTokens() / max) * 100, 100);
  };

  const usageColor = () => {
    const pct = usagePercent();
    if (pct > 90) return "text-error";
    if (pct > 70) return "text-warning";
    return "text-text-tertiary";
  };

  const barColor = () => {
    const pct = usagePercent();
    if (pct > 90) return "bg-error";
    if (pct > 70) return "bg-warning";
    return "bg-accent";
  };

  return (
    <div class="flex items-center gap-2 px-2 py-1 text-xs" title={`${activeTokens()} tokens used${maxContext() ? ` / ${formatTokenCount(maxContext()!)} max` : ""}`}>
      <div class="flex items-center gap-1.5">
        <span class={usageColor()}>
          {formatTokenCount(activeTokens())}
        </span>
        {maxContext() && (
          <>
            <span class="text-text-tertiary">/</span>
            <span class="text-text-tertiary">{formatTokenCount(maxContext()!)}</span>
          </>
        )}
      </div>
      {maxContext() && activeTokens() > 0 && (
        <div class="w-16 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
          <div
            class={`h-full rounded-full transition-all ${barColor()}`}
            style={{ width: `${usagePercent()}%` }}
          />
        </div>
      )}
    </div>
  );
};
