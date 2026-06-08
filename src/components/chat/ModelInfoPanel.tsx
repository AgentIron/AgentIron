import { Show, type Component, type JSX } from "solid-js";
import { TbOutlineX, TbOutlineInfoCircle, TbOutlineCheck, TbOutlineMinus } from "solid-icons/tb";
import { useUI } from "@context/UIContext";
import { useAgent } from "@context/AgentContext";
import { useSettings } from "@context/SettingsContext";
import { formatTokenCount } from "@lib/models";
import type { ModelInfo } from "@/types/settings";

export const ModelInfoPanel: Component = () => {
  const { closeRightPane } = useUI();
  const { activeConnection } = useAgent();
  const { settings, allModels } = useSettings();

  const model = (): ModelInfo | undefined => {
    const conn = activeConnection();
    if (!conn?.model) return undefined;
    return allModels().find((m) => m.id === conn.model && m.providerId === conn.providerId);
  };

  const providerName = () => {
    const conn = activeConnection();
    if (!conn?.providerId) return undefined;
    return settings.providers.find((p) => p.id === conn.providerId)?.name ?? conn.providerId;
  };

  const formatCost = (cost: number | undefined) =>
    cost === undefined ? undefined : `$${cost.toFixed(2)} / 1M tokens`;

  return (
    <div class="w-80 flex-shrink-0 border-l border-border-default bg-bg-secondary flex flex-col h-full">
      <div class="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div class="flex items-center gap-2">
          <TbOutlineInfoCircle size={16} class="text-text-tertiary" />
          <span class="text-sm font-medium text-text-primary">Model Info</span>
        </div>
        <button
          onClick={() => closeRightPane()}
          class="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <TbOutlineX size={16} />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <Show
          when={model() ?? (activeConnection()?.model ? { name: activeConnection()!.model } : undefined)}
          fallback={
            <div class="text-center py-8">
              <TbOutlineInfoCircle size={32} class="mx-auto text-text-tertiary mb-2" />
              <p class="text-sm text-text-tertiary">No active model</p>
            </div>
          }
        >
          <div>
            <div class="text-base font-medium text-text-primary">
              {model()?.name ?? activeConnection()?.model}
            </div>
            <Show when={providerName()}>
              <div class="text-xs text-text-tertiary mt-0.5">{providerName()}</div>
            </Show>
          </div>

          <Section title="Limits">
            <InfoRow
              label="Context window"
              value={model()?.contextWindow ? formatTokenCount(model()!.contextWindow!) : undefined}
            />
            <InfoRow
              label="Max output"
              value={model()?.outputLimit ? formatTokenCount(model()!.outputLimit!) : undefined}
            />
          </Section>

          <Section title="Pricing">
            <InfoRow label="Input" value={formatCost(model()?.costInput)} />
            <InfoRow label="Output" value={formatCost(model()?.costOutput)} />
          </Section>

          <Section title="Capabilities">
            <CapabilityRow label="Tool calling" enabled={model()?.toolCall} />
            <CapabilityRow label="Reasoning" enabled={model()?.reasoning} />
            <CapabilityRow label="Vision" enabled={model()?.vision} />
          </Section>
        </Show>
      </div>
    </div>
  );
};

const Section: Component<{ title: string; children: JSX.Element }> = (props) => (
  <div class="space-y-1.5">
    <div class="text-xs font-medium uppercase tracking-wide text-text-tertiary">{props.title}</div>
    <div class="space-y-1">{props.children}</div>
  </div>
);

const InfoRow: Component<{ label: string; value: string | undefined }> = (props) => (
  <div class="flex items-baseline justify-between gap-2 text-xs">
    <span class="text-text-secondary">{props.label}</span>
    <span class={`font-mono ${props.value ? "text-text-primary" : "text-text-tertiary"}`}>
      {props.value ?? "—"}
    </span>
  </div>
);

const CapabilityRow: Component<{ label: string; enabled: boolean | undefined }> = (props) => (
  <div class="flex items-center justify-between gap-2 text-xs">
    <span class="text-text-secondary">{props.label}</span>
    <Show
      when={props.enabled}
      fallback={<TbOutlineMinus size={14} class="text-text-tertiary" />}
    >
      <TbOutlineCheck size={14} class="text-success" />
    </Show>
  </div>
);
