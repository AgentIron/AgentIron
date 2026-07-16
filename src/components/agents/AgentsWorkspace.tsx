import { Show, createSignal, type Component } from "solid-js";
import { useUI } from "@context/UIContext";
import { useConfigManagement } from "@context/ConfigManagementContext";
import { ProfileList } from "@components/agents/ProfileList";
import { PromptList } from "@components/agents/PromptList";
import {
  TbOutlineRefresh,
  TbOutlineAlertTriangle,
  TbOutlineUserCircle,
  TbOutlineFileText,
} from "solid-icons/tb";

export const AgentsWorkspace: Component = () => {
  const { agentsSection, setAgentsSection } = useUI();
  const mgmt = useConfigManagement();

  return (
    <div class="flex h-full">
      <div class="w-48 flex-shrink-0 border-r border-border-subtle p-3 space-y-1">
        <div class="px-3 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wide">
          Agents
        </div>
        <button
          onClick={() => setAgentsSection("profiles")}
          class={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
            agentsSection() === "profiles"
              ? "bg-bg-hover text-text-primary"
              : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          }`}
        >
          <TbOutlineUserCircle size={15} />
          <span>Profiles</span>
        </button>
        <button
          onClick={() => setAgentsSection("prompts")}
          class={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
            agentsSection() === "prompts"
              ? "bg-bg-hover text-text-primary"
              : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          }`}
        >
          <TbOutlineFileText size={15} />
          <span>Prompts</span>
        </button>
        <div class="pt-3">
          <button
            onClick={() => mgmt.refresh()}
            disabled={mgmt.loading()}
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <TbOutlineRefresh size={15} class={mgmt.loading() ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-2xl mx-auto">
          <Show when={mgmt.configInitError()}>
            <SharedConfigError message={mgmt.configInitError()!} />
          </Show>
          <Show when={!mgmt.configInitError() && mgmt.error()}>
            <div class="mb-4 rounded-lg border border-error-border bg-error-muted px-4 py-3 text-sm text-error">
              {mgmt.error()}
            </div>
          </Show>
          <Show when={!mgmt.configInitError() && mgmt.zeroProfiles() && !mgmt.loading()}>
            <ZeroProfileRecovery />
          </Show>
          <Show
            when={!mgmt.configInitError() && !mgmt.zeroProfiles() && !mgmt.loading()}
            fallback={null}
          >
            <Show
              when={agentsSection() === "profiles"}
              fallback={<PromptList />}
            >
              <ProfileList />
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
};

const SharedConfigError: Component<{ message: string }> = (props) => {
  return (
    <div class="rounded-lg border border-error-border bg-error-muted px-6 py-8 space-y-3">
      <div class="flex items-center gap-2">
        <TbOutlineAlertTriangle size={24} class="text-error" />
        <h2 class="text-lg font-semibold text-error">Configuration unavailable</h2>
      </div>
      <p class="text-sm text-text-secondary">{props.message}</p>
      <p class="text-xs text-text-tertiary">
        Shared configuration (profiles, prompts, providers, and credentials) is blocked
        until this is resolved. Restart AgentIron after fixing the issue.
      </p>
    </div>
  );
};

const ZeroProfileRecovery: Component = () => {
  const mgmt = useConfigManagement();
  const [restoring, setRestoring] = createSignal(false);
  const [restoreError, setRestoreError] = createSignal<string | null>(null);

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreError(null);
    try {
      await mgmt.restoreDefaults();
    } catch (e) {
      setRestoreError(typeof e === "string" ? e : String(e));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div class="rounded-lg border border-warning-border bg-warning-muted px-6 py-8 text-center space-y-4">
      <div class="flex justify-center">
        <TbOutlineAlertTriangle size={32} class="text-warning" />
      </div>
      <div>
        <h2 class="text-lg font-semibold">No valid agent profiles</h2>
        <p class="text-sm text-text-tertiary mt-1">
          At least one valid profile is required. Restore the default profiles to continue.
        </p>
      </div>
      <Show when={restoreError()}>
        <p class="text-sm text-error" data-testid="restore-error">{restoreError()}</p>
      </Show>
      <button
        onClick={handleRestore}
        disabled={restoring()}
        class="rounded-lg bg-accent px-4 py-2.5 text-sm text-void transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {restoring() ? "Restoring..." : "Restore Default Profiles"}
      </button>
    </div>
  );
};
