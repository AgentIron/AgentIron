import { For, Show, createSignal, type Component } from "solid-js";
import {
  TbOutlineStar,
  TbFillStar,
  TbOutlineCheck,
  TbOutlinePlus,
  TbOutlineTrash,
  TbOutlineChevronDown,
  TbOutlineChevronRight,
  TbOutlineRefresh,
} from "solid-icons/tb";
import { useSettings } from "@context/SettingsContext";
import { DEFAULT_PROVIDERS, formatTokenCount, parseModelSlug, makeModelSlug } from "@lib/models";
import type { ProviderConfig, ModelInfo } from "@/types/settings";

const formatContext = (tokens: number) => formatTokenCount(tokens) + " ctx";

export const ProviderSettings: Component = () => {
  const {
    settings,
    updateProvider,
    addProvider,
    removeProvider,
    updateSetting,
    toggleStarredModel,
    addCustomModel,
    removeCustomModel,
    allModels,
    updateModelRegistry,
    registryLastUpdated,
  } = useSettings();
  const [updating, setUpdating] = createSignal(false);
  const [showAddMenu, setShowAddMenu] = createSignal(false);

  const configuredProviders = () => settings.providers;

  const availableToAdd = () =>
    DEFAULT_PROVIDERS.filter(
      (dp) => !settings.providers.some((sp) => sp.id === dp.id),
    );

  const enabledProviders = () =>
    settings.providers.filter((p) => p.enabled && p.apiKey.trim());

  const favoriteModels = () =>
    allModels().filter(
      (m) =>
        settings.starredModels.includes(m.id) &&
        enabledProviders().some((p) => p.id === m.providerId),
    );

  const isCustomModel = (modelId: string, providerId: string) =>
    settings.customModels.some((m) => m.id === modelId && m.providerId === providerId);

  return (
    <div class="space-y-8">
      {/* Configured Providers */}
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-text-primary">Providers</h2>
            <p class="text-xs text-text-tertiary mt-1">
              API keys are stored locally on this device.
            </p>
          </div>
          <div class="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu())}
              disabled={availableToAdd().length === 0}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <TbOutlinePlus size={14} />
              Add Provider
            </button>
            <Show when={showAddMenu()}>
              <div class="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border-default bg-bg-elevated shadow-xl z-10 py-1">
                <For each={availableToAdd()}>
                  {(p) => (
                    <button
                      onClick={() => {
                        addProvider(p.id);
                        setShowAddMenu(false);
                      }}
                      class="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors"
                    >
                      {p.name}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
        <For each={configuredProviders()}>
          {(provider) => (
            <ProviderCard
              provider={provider}
              onUpdate={(patch) => updateProvider(provider.id, patch)}
              onRemove={() => removeProvider(provider.id)}
            />
          )}
        </For>
        <Show when={configuredProviders().length === 0}>
          <div class="rounded-lg border border-border-subtle border-dashed bg-bg-secondary/50 p-6 text-center">
            <p class="text-sm text-text-tertiary">
              No providers configured. Click "Add Provider" to get started.
            </p>
          </div>
        </Show>
      </section>

      {/* Default Model for New Tabs */}
      <Show when={favoriteModels().length > 0}>
        <section class="space-y-3">
          <div>
            <h2 class="text-base font-semibold text-text-primary">Default Model</h2>
            <p class="text-xs text-text-tertiary mt-1">
              Used when creating new agent tabs.
            </p>
          </div>
          <div class="space-y-1">
            <For each={favoriteModels()}>
              {(model) => {
                const slug = () => makeModelSlug(model.providerId, model.id);
                const providerName = () =>
                  settings.providers.find((p) => p.id === model.providerId)?.name ?? model.providerId;
                return (
                  <button
                    onClick={() => updateSetting("defaultModel", slug())}
                    class={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      settings.defaultModel === slug()
                        ? "bg-accent-muted text-accent border border-accent/30"
                        : "bg-bg-secondary border border-border-subtle hover:bg-bg-hover text-text-primary"
                    }`}
                  >
                    <Show when={settings.defaultModel === slug()}>
                      <TbOutlineCheck size={14} class="text-accent" />
                    </Show>
                    <span>{model.name}</span>
                    <span class="text-xs text-text-tertiary ml-auto">{providerName()}</span>
                  </button>
                );
              }}
            </For>
          </div>
          <Show when={!favoriteModels().some((m) => makeModelSlug(m.providerId, m.id) === settings.defaultModel)}>
            <p class="text-xs text-warning">
              Current default "{settings.defaultModel}" is not in your favorites. Select one above.
            </p>
          </Show>
        </section>
      </Show>

      {/* Models by Provider (expandable) */}
      <Show when={enabledProviders().length > 0}>
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-semibold text-text-primary">Models</h2>
              <p class="text-xs text-text-tertiary mt-1">
                Select a default model and star your favorites.
                <Show when={registryLastUpdated()}>
                  {" · Updated "}{new Date(registryLastUpdated()!).toLocaleDateString()}
                </Show>
              </p>
            </div>
            <button
              onClick={async () => {
                setUpdating(true);
                try {
                  await updateModelRegistry();
                } catch (e) {
                  console.error("Failed to update model registry:", e);
                  alert(`Failed to update: ${e}`);
                } finally {
                  setUpdating(false);
                }
              }}
              disabled={updating()}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-bg-elevated text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-50"
            >
              <TbOutlineRefresh size={13} class={updating() ? "animate-spin" : ""} />
              {updating() ? "Updating..." : "Update Models"}
            </button>
          </div>
          <For each={enabledProviders()}>
            {(provider) => {
              const models = () =>
                allModels().filter((m) => m.providerId === provider.id);
              return (
                <ProviderModelGroup
                  providerId={provider.id}
                  providerName={provider.name}
                  models={models()}
                  defaultModelSlug={settings.defaultModel}
                  starredModels={settings.starredModels}
                  onSelectDefault={(id) => updateSetting("defaultModel", makeModelSlug(provider.id, id))}
                  onToggleStar={(id) => toggleStarredModel(id)}
                  onAddCustomModel={(id, name) =>
                    addCustomModel({ id, name, providerId: provider.id })
                  }
                  onRemoveCustomModel={(id) => removeCustomModel(id, provider.id)}
                  isCustomModel={(id) => isCustomModel(id, provider.id)}
                />
              );
            }}
          </For>
        </section>
      </Show>

      {/* Favorite Models (quick reference) */}
      <Show when={favoriteModels().length > 0}>
        <section class="space-y-4">
          <div>
            <h2 class="text-base font-semibold text-text-primary">Favorites</h2>
            <p class="text-xs text-text-tertiary mt-1">
              Starred models for quick switching.
            </p>
          </div>
          <div class="space-y-1">
            <For each={favoriteModels()}>
              {(model) => {
                const slug = () => makeModelSlug(model.providerId, model.id);
                const providerName = () =>
                  settings.providers.find((p) => p.id === model.providerId)?.name ?? model.providerId;
                return (
                  <div class="flex items-center gap-3">
                    <button
                      onClick={() => updateSetting("defaultModel", slug())}
                      class={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        settings.defaultModel === slug()
                          ? "bg-accent-muted text-accent border border-accent/30"
                          : "bg-bg-secondary border border-border-subtle hover:bg-bg-hover text-text-primary"
                      }`}
                    >
                      <Show when={settings.defaultModel === slug()}>
                        <TbOutlineCheck size={14} class="text-accent" />
                      </Show>
                      <span>{model.name}</span>
                      <span class="text-xs text-text-tertiary ml-auto">{providerName()}</span>
                    </button>
                    <button
                      onClick={() => toggleStarredModel(model.id)}
                      class="p-1.5 rounded transition-colors hover:bg-bg-hover"
                    >
                      <TbFillStar size={16} class="text-amber-400" />
                    </button>
                  </div>
                );
              }}
            </For>
          </div>
        </section>
      </Show>
    </div>
  );
};

// ── Provider Card ──

const ProviderCard: Component<{
  provider: ProviderConfig;
  onUpdate: (patch: Partial<ProviderConfig>) => void;
  onRemove: () => void;
}> = (props) => {
  const [showKey, setShowKey] = createSignal(false);

  return (
    <div class="rounded-lg border border-border-default bg-bg-secondary p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-text-primary">{props.provider.name}</span>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <span class="text-xs text-text-tertiary">
              {props.provider.enabled ? "Enabled" : "Disabled"}
            </span>
            <button
              onClick={() => props.onUpdate({ enabled: !props.provider.enabled })}
              class={`relative w-9 h-5 rounded-full transition-colors ${
                props.provider.enabled ? "bg-accent" : "bg-bg-elevated"
              }`}
            >
              <span
                class={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  props.provider.enabled ? "translate-x-4" : ""
                }`}
              />
            </button>
          </label>
          <button
            onClick={() => props.onRemove()}
            class="p-1 rounded text-text-tertiary hover:text-error hover:bg-error/10 transition-colors"
            title="Remove provider"
          >
            <TbOutlineTrash size={14} />
          </button>
        </div>
      </div>
      <div class="relative">
        <input
          type={showKey() ? "text" : "password"}
          placeholder="API key..."
          value={props.provider.apiKey}
          onInput={(e) => props.onUpdate({ apiKey: e.currentTarget.value })}
          class="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 pr-16 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none font-mono"
        />
        <button
          onClick={() => setShowKey(!showKey())}
          class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-tertiary hover:text-text-primary transition-colors"
        >
          {showKey() ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
};

// ── Expandable Model Group ──

const ProviderModelGroup: Component<{
  providerId: string;
  providerName: string;
  models: ModelInfo[];
  defaultModelSlug: string;
  starredModels: string[];
  onSelectDefault: (id: string) => void;
  onToggleStar: (id: string) => void;
  onAddCustomModel: (id: string, name: string) => void;
  onRemoveCustomModel: (id: string) => void;
  isCustomModel: (id: string) => boolean;
}> = (props) => {
  const isDefaultInGroup = () => {
    const { providerId, modelId } = parseModelSlug(props.defaultModelSlug);
    return providerId === props.providerId && props.models.some((m) => m.id === modelId);
  };
  const [expanded, setExpanded] = createSignal(isDefaultInGroup());
  const [newModelId, setNewModelId] = createSignal("");

  const handleAddModel = () => {
    const id = newModelId().trim();
    if (!id) return;
    props.onAddCustomModel(id, id);
    setNewModelId("");
  };

  return (
    <div class="rounded-lg border border-border-subtle overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded())}
        class="w-full flex items-center gap-2 px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover transition-colors text-sm"
      >
        <span class="text-text-tertiary">
          {expanded() ? <TbOutlineChevronDown size={14} /> : <TbOutlineChevronRight size={14} />}
        </span>
        <span class="font-medium text-text-primary">{props.providerName}</span>
        <span class="text-xs text-text-tertiary ml-auto">{props.models.length} models</span>
      </button>
      <Show when={expanded()}>
        <div class="border-t border-border-subtle p-2 space-y-1">
          <For each={props.models}>
            {(model) => (
              <div class="flex items-center gap-2">
                {(() => {
                  const modelSlug = makeModelSlug(props.providerId, model.id);
                  const isDefault = () => props.defaultModelSlug === modelSlug;
                  return (
                <button
                  onClick={() => props.onSelectDefault(model.id)}
                  class={`flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    isDefault()
                      ? "bg-accent-muted text-accent"
                      : "hover:bg-bg-hover text-text-primary"
                  }`}
                >
                  <Show when={isDefault()}>
                    <TbOutlineCheck size={13} class="text-accent" />
                  </Show>
                  <div class="flex-1 min-w-0">
                    <span>{model.name}</span>
                    <div class="flex items-center gap-1 mt-0.5">
                      <Show when={model.contextWindow}>
                        <span class="text-xs text-text-tertiary">{formatContext(model.contextWindow!)}</span>
                      </Show>
                      <Show when={model.toolCall}>
                        <span class="text-xs px-1 rounded bg-blue-500/15 text-blue-400" title="Tool calling">🔧</span>
                      </Show>
                      <Show when={model.reasoning}>
                        <span class="text-xs px-1 rounded bg-purple-500/15 text-purple-400" title="Reasoning">🧠</span>
                      </Show>
                      <Show when={model.vision}>
                        <span class="text-xs px-1 rounded bg-emerald-500/15 text-emerald-400" title="Vision">👁</span>
                      </Show>
                    </div>
                  </div>
                </button>
                  );
                })()}
                <button
                  onClick={() => props.onToggleStar(model.id)}
                  class="p-1 rounded transition-colors hover:bg-bg-hover"
                >
                  {props.starredModels.includes(model.id) ? (
                    <TbFillStar size={15} class="text-amber-400" />
                  ) : (
                    <TbOutlineStar size={15} class="text-text-tertiary" />
                  )}
                </button>
                <Show when={props.isCustomModel(model.id)}>
                  <button
                    onClick={() => props.onRemoveCustomModel(model.id)}
                    class="p-1 rounded text-text-tertiary hover:text-error hover:bg-error/10 transition-colors"
                    title="Remove custom model"
                  >
                    <TbOutlineTrash size={13} />
                  </button>
                </Show>
              </div>
            )}
          </For>
          {/* Add custom model */}
          <div class="flex items-center gap-2 pt-1 border-t border-border-subtle mt-1">
            <input
              type="text"
              placeholder="Add model ID..."
              value={newModelId()}
              onInput={(e) => setNewModelId(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddModel()}
              class="flex-1 rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none font-mono"
            />
            <button
              onClick={handleAddModel}
              disabled={!newModelId().trim()}
              class="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-accent-muted transition-colors disabled:opacity-30"
              title="Add model"
            >
              <TbOutlinePlus size={14} />
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};
