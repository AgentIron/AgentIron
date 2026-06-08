import { createSignal, onMount, onCleanup, type Component } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { useAgent } from "@context/AgentContext";
import { useSettings } from "@context/SettingsContext";
import { formatTokenCount } from "@lib/models";

export const ContextIndicator: Component = () => {
  const { state: agentState, activeConnection } = useAgent();
  const { allModels } = useSettings();
  const [activeTokens, setActiveTokens] = createSignal(0);
  // Compact threshold (in tokens) when iron-core supplies it. Absent today —
  // the marker stays hidden until the backend includes it in the payload.
  const [compactThreshold, setCompactThreshold] = createSignal<number | undefined>();

  onMount(async () => {
    const unlisten = await listen<{ tabId: string; activeTokens: number; compactThreshold?: number }>(
      "agent-context-update",
      (e) => {
        if (e.payload.tabId === agentState.activeTabId) {
          setActiveTokens(e.payload.activeTokens);
          setCompactThreshold(e.payload.compactThreshold);
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
    return "bg-success";
  };

  // Position of the compact-threshold marker as a percentage of the bar width.
  const thresholdPercent = () => {
    const max = maxContext();
    const threshold = compactThreshold();
    if (!max || !threshold) return undefined;
    return Math.min((threshold / max) * 100, 100);
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
        <div class="relative w-16 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
          <div
            class={`h-full rounded-full transition-all ${barColor()}`}
            style={{ width: `${usagePercent()}%` }}
          />
          {thresholdPercent() !== undefined && (
            <div
              class="absolute top-0 bottom-0 w-px bg-text-primary/70"
              style={{ left: `${thresholdPercent()}%` }}
              title={`Compaction threshold: ${formatTokenCount(compactThreshold()!)}`}
            />
          )}
        </div>
      )}
    </div>
  );
};
