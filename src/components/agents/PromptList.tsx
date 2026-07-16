import {
  For,
  Show,
  createSignal,
  createMemo,
  type Component,
  type JSX,
} from "solid-js";
import { useConfigManagement, MutationError } from "@context/ConfigManagementContext";
import type {
  ManagedPromptRecordDto,
  ManagedProfileRecordDto,
  StoredPromptDto,
} from "@lib/tauri/config-commands";
import { formatDependencyEntity } from "@lib/tauri/config-commands";
import {
  TbOutlinePlus,
  TbOutlineTrash,
  TbOutlinePencil,
  TbOutlineAlertTriangle,
  TbOutlineDeviceFloppy,
  TbOutlineArrowLeft,
} from "solid-icons/tb";

type EditorMode = { kind: "none" } | { kind: "create" } | { kind: "edit"; id: string };

export const PromptList: Component = () => {
  const mgmt = useConfigManagement();
  const [editor, setEditor] = createSignal<EditorMode>({ kind: "none" });
  const [deleteTarget, setDeleteTarget] = createSignal<string | null>(null);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  const [deleteDependents, setDeleteDependents] = createSignal<string[]>([]);
  const [impactLoading, setImpactLoading] = createSignal(false);
  const [impactFailed, setImpactFailed] = createSignal(false);

  const readyPrompts = createMemo(() =>
    mgmt.prompts().filter((r): r is Extract<ManagedPromptRecordDto, { status: "ready" }> =>
      r.status === "ready"
    )
  );

  const needsAttention = createMemo(() =>
    mgmt.prompts().filter((r) => r.status === "needsAttention")
  );

  const profileNameById = (id: string | undefined): string | null => {
    if (!id) return null;
    const record = mgmt.profiles().find((r) => r.status === "ready" && r.entry.id === id);
    return record && record.status === "ready" ? record.entry.profile.name : id;
  };

  const confirmDelete = async (id: string) => {
    setDeleteTarget(id);
    setDeleteError(null);
    setDeleteDependents([]);
    setImpactLoading(true);
    setImpactFailed(false);
    try {
      const impact = await mgmt.promptImpact(id);
      setDeleteDependents(
        impact.links
          .filter((link) => link.direction === "dependent")
          .map((link) => formatDependencyEntity(link.entity)),
      );
    } catch {
      setImpactFailed(true);
      setDeleteError("Failed to check dependencies. Deletion is blocked until the check succeeds.");
    } finally {
      setImpactLoading(false);
    }
  };

  const doDelete = async () => {
    const id = deleteTarget();
    if (!id) return;
    try {
      await mgmt.deletePrompt(id);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(String(e));
    }
  };

  return (
    <div class="space-y-4">
      <Show when={editor().kind === "none"}>
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-text-secondary">Stored Prompts</h2>
          <button
            onClick={() => setEditor({ kind: "create" })}
            data-testid="btn-new-prompt"
            class="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs text-void hover:bg-accent-hover transition-colors"
          >
            <TbOutlinePlus size={14} />
            New Prompt
          </button>
        </div>

        <Show when={mgmt.loading()}>
          <p class="text-sm text-text-tertiary" data-testid="prompt-loading">Loading...</p>
        </Show>

        <Show when={!mgmt.loading() && mgmt.prompts().length === 0}>
          <p class="text-sm text-text-tertiary">No prompts found.</p>
        </Show>

        <div class="space-y-2" data-testid="prompt-list">
          <For each={readyPrompts()}>
            {(record) => (
              <div
                data-testid={`prompt-row-${record.entry.id}`}
                class="flex items-center justify-between rounded-md border border-border-subtle px-4 py-3"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-text-primary">
                      {record.entry.prompt.displayName}
                    </span>
                    <Show when={record.entry.identityState === "needsRename"}>
                      <span class="text-xs text-warning">Needs rename</span>
                    </Show>
                  </div>
                  <div class="mt-0.5 flex items-center gap-2 text-xs text-text-tertiary">
                    <Show when={record.entry.prompt.profile}>
                      <span>{"-> "}{profileNameById(record.entry.prompt.profile)}</span>
                    </Show>
                    <Show when={record.entry.prompt.skills.length > 0}>
                      <span>skills: {record.entry.prompt.skills.join(", ")}</span>
                    </Show>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    onClick={() => setEditor({ kind: "edit", id: record.entry.id })}
                    data-testid={`btn-edit-prompt-${record.entry.id}`}
                    class="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    title="Edit"
                  >
                    <TbOutlinePencil size={14} />
                  </button>
                  <button
                    onClick={() => confirmDelete(record.entry.id)}
                    data-testid={`btn-delete-prompt-${record.entry.id}`}
                    class="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-error"
                    title="Delete"
                  >
                    <TbOutlineTrash size={14} />
                  </button>
                </div>
              </div>
            )}
          </For>

          <For each={needsAttention()}>
            {(record) => (
              <div
                data-testid={`prompt-row-${record.id}`}
                class="flex items-center justify-between rounded-md border border-warning-border bg-warning-muted px-4 py-3"
              >
                <div class="flex items-center gap-2">
                  <TbOutlineAlertTriangle size={14} class="text-warning" />
                  <span class="text-sm font-medium text-text-primary">{record.id}</span>
                  <span class="text-xs text-warning">Needs attention</span>
                </div>
                <Show when={record.diagnostics.length > 0}>
                  <div class="text-xs text-text-tertiary">
                    {record.diagnostics.map((d) => d.message).join("; ")}
                  </div>
                </Show>
                <div class="flex items-center gap-1">
                  <Show when={record.decoded}>
                    <button
                      onClick={() => setEditor({ kind: "edit", id: record.id })}
                      data-testid={`btn-edit-prompt-${record.id}`}
                      class="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                      title="Edit"
                    >
                      <TbOutlinePencil size={14} />
                    </button>
                  </Show>
                  <button
                    onClick={() => confirmDelete(record.id)}
                    data-testid={`btn-delete-prompt-${record.id}`}
                    class="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-error"
                  >
                    <TbOutlineTrash size={14} />
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={editor().kind !== "none"}>
        <PromptEditor
          mode={editor()}
          onClose={() => setEditor({ kind: "none" })}
          onSave={async (id, prompt, isNew) => {
            if (isNew) {
              await mgmt.createPrompt({
                displayName: prompt.displayName,
                instructions: prompt.instructions,
                skills: prompt.skills,
                profile: prompt.profile,
              });
            } else {
              await mgmt.savePrompt(id, prompt);
            }
            setEditor({ kind: "none" });
          }}
        />
      </Show>

      <Show when={deleteTarget()}>
        <DeleteDialog
          id={deleteTarget()!}
          dependents={deleteDependents()}
          error={deleteError()}
          impactLoading={impactLoading()}
          impactFailed={impactFailed()}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null); setImpactFailed(false); }}
          onConfirm={doDelete}
        />
      </Show>
    </div>
  );
};

// ── Prompt Editor ──

const PromptEditor: Component<{
  mode: EditorMode;
  onClose: () => void;
  onSave: (id: string, prompt: StoredPromptDto, isNew: boolean) => Promise<void>;
}> = (props) => {
  const mgmt = useConfigManagement();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const existing = createMemo(() => {
    if (props.mode.kind !== "edit") return null;
    for (const r of mgmt.prompts()) {
      if (r.status === "ready" && r.entry.id === props.mode.id) {
        return r.entry.prompt;
      }
      if (r.status === "needsAttention" && r.id === props.mode.id && r.decoded) {
        return r.decoded;
      }
    }
    return null;
  });

  const [displayName, setDisplayName] = createSignal(existing()?.displayName ?? "");
  const [instructions, setInstructions] = createSignal(existing()?.instructions ?? "");
  const [skills, setSkills] = createSignal(
    existing()?.skills.join(", ") ?? ""
  );
  const [profile, setProfile] = createSignal(existing()?.profile ?? "");

  const isEdit = () => props.mode.kind === "edit";

  const readyProfileOptions = createMemo(() => {
    return mgmt
      .profiles()
      .filter(
        (r): r is Extract<ManagedProfileRecordDto, { status: "ready" }> =>
          r.status === "ready",
      )
      .map((r) => ({ id: r.entry.id, name: r.entry.profile.name }));
  });

  const buildDto = (): StoredPromptDto => ({
    displayName: displayName(),
    normalizedName: existing()?.normalizedName ?? "",
    instructions: instructions(),
    skills: skills().split(",").map((s) => s.trim()).filter(Boolean),
    profile: profile().trim() || undefined,
  });

  const handleSave = async () => {
    if (!displayName().trim()) {
      setError("Display name is required");
      return;
    }
    if (!instructions().trim()) {
      setError("Instructions are required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const id = isEdit() ? (props.mode as { kind: "edit"; id: string }).id : "";
      await props.onSave(id, buildDto(), !isEdit());
    } catch (e) {
      if (e instanceof MutationError) {
        const dto = e.dto;
        if (dto.field === "displayName") {
          setError(`Name: ${dto.message}`);
        } else {
          setError(dto.message);
        }
      } else {
        setError(String(e));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="space-y-4" data-testid="prompt-editor">
      <div class="flex items-center gap-2">
        <button
          onClick={props.onClose}
          class="rounded p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          data-testid="btn-cancel-edit-prompt"
        >
          <TbOutlineArrowLeft size={16} />
        </button>
        <h2 class="text-sm font-semibold text-text-secondary">
          {isEdit() ? "Edit Prompt" : "New Prompt"}
        </h2>
      </div>

      <Show when={error()}>
        <div class="rounded-lg border border-error-border bg-error-muted px-4 py-2 text-sm text-error" data-testid="form-error">
          {error()}
        </div>
      </Show>

      <div class="space-y-3">
        <Field label="Display Name">
          <input
            data-testid="field-display-name"
            value={displayName()}
            onInput={(e) => setDisplayName(e.currentTarget.value)}
            placeholder="Check Email"
            class="w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Instructions">
          <textarea
            data-testid="field-instructions"
            value={instructions()}
            onInput={(e) => setInstructions(e.currentTarget.value)}
            placeholder="Check the user's email and summarize unread messages."
            rows={4}
            class="w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Requested Skills (comma-separated)">
          <input
            data-testid="field-skills"
            value={skills()}
            onInput={(e) => setSkills(e.currentTarget.value)}
            placeholder="email-reader, summarizer"
            class="w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
          />
          <div class="text-xs text-text-tertiary mt-1">
            Unknown skill identifiers are preserved for cross-machine compatibility.
          </div>
        </Field>

        <Field label="Profile Assignment (optional)">
          <select
            data-testid="field-profile"
            value={profile()}
            onChange={(e) => setProfile(e.currentTarget.value)}
            class="w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
          >
            <option value="">None</option>
            <For each={readyProfileOptions()}>
              {(p) => (
                <option value={p.id}>{p.name} ({p.id})</option>
              )}
            </For>
          </select>
        </Field>
      </div>

      <div class="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving()}
          data-testid="btn-save-prompt"
          class="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm text-void hover:bg-accent-hover disabled:opacity-50"
        >
          <TbOutlineDeviceFloppy size={14} />
          {saving() ? "Saving..." : "Save"}
        </button>
        <button
          onClick={props.onClose}
          data-testid="btn-cancel-prompt"
          class="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ── Delete Dialog ──

const DeleteDialog: Component<{
  id: string;
  dependents: string[];
  error: string | null;
  impactLoading: boolean;
  impactFailed: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = (props) => {
  const canDelete = () =>
    props.dependents.length === 0 && !props.impactLoading && !props.impactFailed;

  return (
    <div class="fixed inset-0 flex items-center justify-center bg-black/50" data-testid="prompt-delete-dialog">
      <div class="max-w-sm rounded-lg bg-bg-secondary p-6 shadow-xl">
        <h3 class="text-lg font-semibold">Delete prompt "{props.id}"?</h3>
        <Show when={props.impactLoading}>
          <p class="mt-2 text-sm text-text-tertiary">Checking dependencies...</p>
        </Show>
      <Show when={props.dependents.length > 0}>
        <p class="mt-2 text-sm text-warning">
          Referenced by: {props.dependents.join(", ")}
        </p>
        <p class="text-sm text-text-tertiary">
          Resolve the references before deleting.
        </p>
      </Show>
      <Show when={props.error}>
        <p class="mt-2 text-sm text-error" data-testid="prompt-delete-error">{props.error}</p>
      </Show>
      <div class="mt-4 flex justify-end gap-2">
        <button
          onClick={props.onCancel}
          class="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
        >
          Cancel
        </button>
        <Show when={canDelete()}>
          <button
            onClick={props.onConfirm}
            data-testid="btn-confirm-delete-prompt"
            class="rounded-md bg-error px-4 py-2 text-sm text-void hover:bg-error-hover"
          >
            Delete
          </button>
        </Show>
      </div>
    </div>
  </div>
);
}

// ── Helpers ──

const Field: Component<{ label: string; children: JSX.Element }> = (props) => (
  <div>
    <label class="mb-1 block text-xs font-medium text-text-secondary">{props.label}</label>
    {props.children}
  </div>
);
