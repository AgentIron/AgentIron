import { For, Show, createSignal, type Component } from "solid-js";
import { Transition } from "solid-transition-group";
import { TbOutlineChevronDown, TbOutlineCheck } from "solid-icons/tb";
import { useAgent } from "@context/AgentContext";
import { useSettings } from "@context/SettingsContext";
import { parseModelSlug } from "@lib/models";

export const ModelSwitcher: Component = () => {
  const { activeConnection, changeModel } = useAgent();
  const { settings, allModels } = useSettings();
  const [open, setOpen] = createSignal(false);
  const [switching, setSwitching] = createSignal(false);

  const currentModel = () => activeConnection()?.model ?? parseModelSlug(settings.defaultModel).modelId;

  const currentModelName = () => {
    const id = currentModel();
    return allModels().find((m) => m.id === id)?.name ?? id;
  };

  // Only show starred models from enabled providers with API keys
  const starredModels = () =>
    allModels().filter(
      (m) =>
        settings.starredModels.includes(m.id) &&
        settings.providers.some(
          (p) => p.id === m.providerId && p.enabled && p.apiKey.trim(),
        ),
    );

  const handleSelect = async (modelId: string, providerId: string) => {
    const conn = activeConnection();
    if (!conn || switching()) return;

    setOpen(false);
    if (modelId === currentModel()) return;

    // Find the API key for this provider
    const provider = settings.providers.find((p) => p.id === providerId);
    if (!provider?.apiKey) return;

    setSwitching(true);
    try {
      await changeModel(conn.id, provider.apiKey, modelId, providerId);
    } catch (err) {
      console.error("Failed to switch model:", err);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div class="relative">
      <button
        onClick={() => setOpen(!open())}
        disabled={switching()}
        class="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
      >
        <span class="truncate max-w-[150px]">
          {switching() ? "Switching..." : currentModelName()}
        </span>
        <TbOutlineChevronDown size={12} class="flex-shrink-0" />
      </button>

      <Show when={open()}>
        <div class="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      </Show>
      <Transition name="scale-fade">
        <Show when={open()}>
          <div class="absolute left-0 top-full mt-1 w-64 rounded-lg border border-border-default bg-bg-elevated shadow-xl z-20 py-1 max-h-72 overflow-y-auto">
          <Show
            when={starredModels().length > 0}
            fallback={
              <div class="px-3 py-3 text-xs text-text-tertiary text-center">
                No favorite models. Star models in Settings → Providers.
              </div>
            }
          >
            <For each={starredModels()}>
              {(model) => {
                const providerName = () =>
                  settings.providers.find((p) => p.id === model.providerId)?.name ?? model.providerId;
                return (
                  <button
                    onClick={() => handleSelect(model.id, model.providerId)}
                    class={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      model.id === currentModel()
                        ? "bg-accent-muted text-accent"
                        : "text-text-primary hover:bg-bg-hover"
                    }`}
                  >
                    <Show when={model.id === currentModel()}>
                      <TbOutlineCheck size={13} class="text-accent flex-shrink-0" />
                    </Show>
                    <div class="flex-1 text-left min-w-0">
                      <div class="truncate">{model.name}</div>
                    </div>
                    <span class="text-xs text-text-tertiary flex-shrink-0">{providerName()}</span>
                  </button>
                );
              }}
            </For>
          </Show>
          </div>
        </Show>
      </Transition>
    </div>
  );
};
