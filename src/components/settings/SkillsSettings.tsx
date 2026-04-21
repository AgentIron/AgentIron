import { createSignal, For, Show, type Component } from "solid-js";
import { TbOutlineRefresh, TbOutlineFolderPlus, TbOutlineX, TbOutlineCheck, TbOutlineAlertCircle } from "solid-icons/tb";
import { useSettings } from "@context/SettingsContext";
import { useAgent } from "@context/AgentContext";
import {
  refreshSkillCatalog,
  listAvailableSkills,
  activateSkill,
  deactivateSkill,
  listActiveSkills,
} from "@lib/tauri/commands";

interface SkillItem {
  id: string;
  displayName: string;
  description: string;
  origin: string;
  autoActivate: boolean;
  tags: string[];
  requiresTools: string[];
  requiresCapabilities: string[];
  requiresTrust: boolean;
  active: boolean;
}

interface Diagnostic {
  level: string;
  message: string;
  skillName?: string;
}

export const SkillsSettings: Component = () => {
  const { settings, updateSkillSettings, addSkillDir, removeSkillDir } = useSettings();
  const { state: agentState } = useAgent();

  const [skills, setSkills] = createSignal<SkillItem[]>([]);
  const [diagnostics, setDiagnostics] = createSignal<Diagnostic[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [newDir, setNewDir] = createSignal("");

  const activeTabId = () => agentState.activeTabId;

  const loadSkills = async () => {
    const tid = activeTabId();
    if (!tid) return;
    setLoading(true);
    try {
      const [diag, available, active] = await Promise.all([
        refreshSkillCatalog(tid),
        listAvailableSkills(tid),
        listActiveSkills(tid),
      ]);
      setDiagnostics(diag);
      setSkills(
        available.map((s) => ({
          ...s,
          active: active.includes(s.id),
        })),
      );
    } catch (err) {
      console.error("Failed to load skills:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = async (name: string, currentlyActive: boolean) => {
    const tid = activeTabId();
    if (!tid) return;
    try {
      if (currentlyActive) {
        await deactivateSkill(tid, name);
      } else {
        await activateSkill(tid, name);
      }
      await loadSkills();
    } catch (err) {
      console.error("Failed to toggle skill:", err);
    }
  };

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
            onClick={loadSkills}
            disabled={loading() || !activeTabId()}
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-elevated border border-border-subtle text-xs text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
          >
            <TbOutlineRefresh size={13} class={loading() ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <Show when={!activeTabId()}>
          <p class="text-sm text-text-tertiary">Open a chat tab to view and manage skills.</p>
        </Show>

        <Show when={diagnostics().length > 0}>
          <div class="space-y-1">
            <For each={diagnostics()}>
              {(d) => (
                <div class={`flex items-start gap-1.5 rounded-md px-3 py-1.5 text-xs ${
                  d.level === "Error" ? "bg-red-500/10 text-red-400" :
                  d.level === "Warning" ? "bg-yellow-500/10 text-yellow-400" :
                  "bg-bg-elevated text-text-tertiary"
                }`}>
                  <TbOutlineAlertCircle size={13} class="mt-0.5 flex-shrink-0" />
                  <div>
                    <span class="font-medium">{d.level}:</span>{" "}
                    {d.message}
                    {d.skillName && <span class="text-text-tertiary"> ({d.skillName})</span>}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={skills().length === 0 && activeTabId()}>
          <p class="text-sm text-text-tertiary">No skills discovered. Try refreshing the catalog.</p>
        </Show>

        <div class="space-y-1">
          <For each={skills()}>
            {(skill) => (
              <div class="flex items-start justify-between bg-bg-elevated rounded-md px-3 py-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-text-primary">{skill.displayName}</span>
                    <span class="text-xs text-text-tertiary">{skill.origin}</span>
                    {skill.requiresTrust && (
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">Trust required</span>
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
                  onClick={() => toggleSkill(skill.id, skill.active)}
                  class={`flex-shrink-0 ml-2 px-2 py-1 rounded-md text-xs transition-colors ${
                    skill.active
                      ? "bg-accent text-white hover:bg-accent-hover"
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