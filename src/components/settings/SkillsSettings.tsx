import { createSignal, For, Show, onMount, type Component } from "solid-js";
import { TbOutlineRefresh, TbOutlineFolderPlus, TbOutlineX, TbOutlineCheck } from "solid-icons/tb";
import { useSettings } from "@context/SettingsContext";
import { useAgent } from "@context/AgentContext";
import { useSkillCatalog } from "@context/SkillCatalogContext";

export const SkillsSettings: Component = () => {
  const { settings, updateSkillSettings, addSkillDir, removeSkillDir } = useSettings();
  const { state: agentState } = useAgent();
  const { getCatalog, loadSkills, toggleSkill } = useSkillCatalog();

  const [newDir, setNewDir] = createSignal("");

  const activeTabId = () => agentState.activeTabId;
  const catalog = () => getCatalog(activeTabId() ?? "");

  onMount(() => {
    const tid = activeTabId();
    if (tid) {
      loadSkills(tid);
    }
  });

  const handleAddDir = () => {
    const dir = newDir().trim();
    if (!dir) return;
    addSkillDir(dir);
    setNewDir("");
  };

  return (
    <div class="space-y-6">
      <h2 class="text-sm font-semibold text-text-secondary">Skills</h2>
      <p class="text-sm text-text-tertiary">
        Skills extend your agent with specialized capabilities discovered from workspace directories.
      </p>

      {/* Project skill trust */}
      <div class="space-y-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.skills.trustProjectSkills}
            onChange={(e) => updateSkillSettings({ trustProjectSkills: e.currentTarget.checked })}
            class="rounded border-border-subtle"
          />
          <span class="text-sm text-text-primary">Trust project-level skills</span>
        </label>
        <p class="text-xs text-text-tertiary">
          When enabled, AgentIron will discover and load skills from the current workspace roots.
          Only enable this for workspaces you trust.
        </p>
      </div>

      {/* Additional skill directories */}
      <div class="space-y-2">
        <h3 class="text-xs font-medium text-text-secondary uppercase tracking-wide">Additional Skill Directories</h3>
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="/path/to/skills"
            value={newDir()}
            onInput={(e) => setNewDir(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddDir()}
            class="flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleAddDir}
            disabled={!newDir().trim()}
            class="px-3 py-1.5 rounded-md bg-bg-elevated border border-border-subtle text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
          >
            <TbOutlineFolderPlus size={16} />
          </button>
        </div>
        <Show when={settings.skills.additionalSkillDirs.length > 0}>
          <div class="space-y-1">
            <For each={settings.skills.additionalSkillDirs}>
              {(dir) => (
                <div class="flex items-center justify-between bg-bg-elevated rounded-md px-3 py-1.5">
                  <span class="text-sm text-text-secondary truncate">{dir}</span>
                  <button
                    onClick={() => removeSkillDir(dir)}
                    class="text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    <TbOutlineX size={14} />
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Skill catalog */}
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-medium text-text-secondary uppercase tracking-wide">Skill Catalog</h3>
          <button
            onClick={() => {
              const tid = activeTabId();
              if (tid) loadSkills(tid);
            }}
            disabled={catalog().loading || !activeTabId()}
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-elevated border border-border-subtle text-xs text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
          >
            <TbOutlineRefresh size={13} class={catalog().loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <Show when={!activeTabId()}>
          <p class="text-sm text-text-tertiary">Open a chat tab to view and manage skills.</p>
        </Show>

        <Show when={catalog().lastRefreshSummary}>
          <div
            class={`text-xs rounded-md px-3 py-1.5 ${
              (catalog().lastRefreshSummary?.errors ?? 0) > 0
                ? "bg-error/10 text-error"
                : (catalog().lastRefreshSummary?.warnings ?? 0) > 0
                  ? "bg-warning/10 text-warning"
                  : "bg-success/10 text-success"
            }`}
          >
            <span class="font-medium">Refresh completed{" "}</span>
            {(catalog().lastRefreshSummary!.errors > 0 || catalog().lastRefreshSummary!.warnings > 0)
              ? `with ${catalog().lastRefreshSummary!.errors > 0 ? `${catalog().lastRefreshSummary!.errors} error${catalog().lastRefreshSummary!.errors === 1 ? "" : "s"}` : ""}${catalog().lastRefreshSummary!.errors > 0 && catalog().lastRefreshSummary!.warnings > 0 ? " and " : ""}${catalog().lastRefreshSummary!.warnings > 0 ? `${catalog().lastRefreshSummary!.warnings} warning${catalog().lastRefreshSummary!.warnings === 1 ? "" : "s"}` : ""}`
              : "successfully"}
          </div>
        </Show>

        <Show when={catalog().loading && catalog().skills.length === 0}>
          <p class="text-sm text-text-tertiary">Loading skills…</p>
        </Show>

        <Show when={catalog().skills.length === 0 && !catalog().loading && catalog().loaded && activeTabId()}>
          <p class="text-sm text-text-tertiary">No skills discovered. Try refreshing the catalog.</p>
        </Show>

        <div class="space-y-1">
          <For each={catalog().skills}>
            {(skill) => (
              <div class="flex items-start justify-between bg-bg-elevated rounded-md px-3 py-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-text-primary">{skill.displayName}</span>
                    <span class="text-xs text-text-tertiary">{skill.origin}</span>
                    {skill.requiresTrust && (
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning">Trust required</span>
                    )}
                  </div>
                  <p class="text-xs text-text-tertiary mt-0.5">{skill.description}</p>
                  <Show when={skill.tags.length > 0}>
                    <div class="flex gap-1 mt-1 flex-wrap">
                      <For each={skill.tags}>
                        {(tag) => (
                          <span class="text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary text-text-tertiary">{tag}</span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
                <button
                  onClick={() => {
                    const tid = activeTabId();
                    if (tid) toggleSkill(tid, skill.id, skill.active);
                  }}
                  class={`flex-shrink-0 ml-2 px-2 py-1 rounded-md text-xs transition-colors ${
                    skill.active
                      ? "bg-accent text-void hover:bg-accent-hover"
                      : "bg-bg-secondary text-text-secondary hover:bg-bg-hover"
                  }`}
                >
                  {skill.active ? (
                    <span class="flex items-center gap-1"><TbOutlineCheck size={12} /> Active</span>
                  ) : (
                    "Activate"
                  )}
                </button>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};
