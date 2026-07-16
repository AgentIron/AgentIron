import {
  For,
  Show,
  createSignal,
  createMemo,
  type Component,
  type JSX,
} from "solid-js";
import { useConfigManagement, MutationError } from "@context/ConfigManagementContext";
import { BUILTIN_TOOLS } from "@lib/tools";
import { PROVIDER_METADATA } from "@lib/models";
import type {
  ManagedProfileRecordDto,
  AgentProfileDto,
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

export const ProfileList: Component = () => {
  const mgmt = useConfigManagement();
  const [editor, setEditor] = createSignal<EditorMode>({ kind: "none" });
  const [deleteTarget, setDeleteTarget] = createSignal<string | null>(null);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  const [deleteDependents, setDeleteDependents] = createSignal<string[]>([]);
  const [impactLoading, setImpactLoading] = createSignal(false);
  const [impactFailed, setImpactFailed] = createSignal(false);

  const readyProfiles = createMemo(() =>
    mgmt.profiles().filter((r): r is Extract<ManagedProfileRecordDto, { status: "ready" }> =>
      r.status === "ready"
    )
  );

  const needsAttention = createMemo(() =>
    mgmt.profiles().filter((r) => r.status === "needsAttention")
  );

  const startCreate = () => setEditor({ kind: "create" });
  const startEdit = (id: string) => setEditor({ kind: "edit", id });
  const closeEditor = () => setEditor({ kind: "none" });

  const confirmDelete = async (id: string) => {
    setDeleteTarget(id);
    setDeleteError(null);
    setDeleteDependents([]);
    setImpactLoading(true);
    setImpactFailed(false);
    try {
      const impact = await mgmt.profileImpact(id);
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
      await mgmt.deleteProfile(id);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(String(e));
    }
  };

  return (
    <div class="space-y-4">
      <Show when={editor().kind === "none"}>
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-text-secondary">Agent Profiles</h2>
          <button
            onClick={startCreate}
            data-testid="btn-new-profile"
            class="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs text-void hover:bg-accent-hover transition-colors"
          >
            <TbOutlinePlus size={14} />
            New Profile
          </button>
        </div>

        <Show when={mgmt.loading()}>
          <p class="text-sm text-text-tertiary" data-testid="profile-loading">Loading...</p>
        </Show>

        <Show when={!mgmt.loading() && mgmt.profiles().length === 0}>
          <p class="text-sm text-text-tertiary">No profiles found.</p>
        </Show>

        <div class="space-y-2" data-testid="profile-list">
          <For each={readyProfiles()}>
            {(record) => (
              <div
                data-testid={`profile-row-${record.entry.id}`}
                class="flex items-center justify-between rounded-md border border-border-subtle px-4 py-3"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-text-primary">
                      {record.entry.profile.name}
                    </span>
                    <span class="text-xs text-text-tertiary">{record.entry.id}</span>
                  </div>
                  <div class="mt-0.5 flex items-center gap-2 text-xs text-text-tertiary">
                    <Show when={record.entry.profile.kind === "managed"} fallback={
                      <span>Runtime default provider</span>
                    }>
                      <span>{record.entry.profile.providerSlug}/{record.entry.profile.model}</span>
                    </Show>
                    <Show when={record.entry.profile.identityPrompt}>
                      <span class="text-text-quaternary">| custom identity</span>
                    </Show>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(record.entry.id)}
                    data-testid={`btn-edit-${record.entry.id}`}
                    class="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    title="Edit"
                  >
                    <TbOutlinePencil size={14} />
                  </button>
                  <button
                    onClick={() => confirmDelete(record.entry.id)}
                    data-testid={`btn-delete-${record.entry.id}`}
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
                data-testid={`profile-row-${record.id}`}
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
                      onClick={() => startEdit(record.id)}
                      data-testid={`btn-edit-${record.id}`}
                      class="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                      title="Edit"
                    >
                      <TbOutlinePencil size={14} />
                    </button>
                  </Show>
                  <button
                    onClick={() => confirmDelete(record.id)}
                    data-testid={`btn-delete-${record.id}`}
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
        <ProfileEditor
          mode={editor()}
          onClose={closeEditor}
          onSave={async (id, profile) => {
            await mgmt.saveProfile(id, profile);
            closeEditor();
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

// ── Profile Editor ──

const ProfileEditor: Component<{
  mode: EditorMode;
  onClose: () => void;
  onSave: (id: string, profile: AgentProfileDto) => Promise<void>;
}> = (props) => {
  const mgmt = useConfigManagement();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const existing = createMemo(() => {
    if (props.mode.kind !== "edit") return null;
    for (const r of mgmt.profiles()) {
      if (r.status === "ready" && r.entry.id === props.mode.id) {
        return r.entry.profile;
      }
      if (r.status === "needsAttention" && r.id === props.mode.id && r.decoded) {
        return r.decoded;
      }
    }
    return null;
  });

  const [id, setId] = createSignal(props.mode.kind === "edit" ? props.mode.id : "");
  const [name, setName] = createSignal(existing()?.name ?? "");
  const [providerKind, setProviderKind] = createSignal<"runtimeDefault" | "managed">(
    existing()?.kind ?? "runtimeDefault"
  );
  const [providerSlug, setProviderSlug] = createSignal(existing()?.providerSlug ?? "");
  const [model, setModel] = createSignal(existing()?.model ?? "");
  const [toolFilterKind, setToolFilterKind] = createSignal(
    existing()?.tools.kind ?? "inherit"
  );
  const [toolNames, setToolNames] = createSignal(
    existing()?.tools.kind === "allow" || existing()?.tools.kind === "deny"
      ? ((existing()?.tools as { names: string[] })?.names ?? []).join(", ")
      : ""
  );
  const [skillFilterKind, setSkillFilterKind] = createSignal(
    existing()?.skills.kind ?? "inherit"
  );
  const [skillNames, setSkillNames] = createSignal(
    existing()?.skills.kind === "allow"
      ? ((existing()?.skills as { names: string[] })?.names ?? []).join(", ")
      : ""
  );
  const [approval, setApproval] = createSignal<"perTool" | "autoApprove">(
    existing()?.approval ?? "perTool"
  );
  const [identityPrompt, setIdentityPrompt] = createSignal(
    existing()?.identityPrompt ?? ""
  );

  const isEdit = () => props.mode.kind === "edit";

  const buildDto = (): AgentProfileDto => {
    const tools =
      toolFilterKind() === "inherit"
        ? { kind: "inherit" as const }
        : toolFilterKind() === "allow"
          ? { kind: "allow" as const, names: toolNames().split(",").map((s) => s.trim()).filter(Boolean) }
          : { kind: "deny" as const, names: toolNames().split(",").map((s) => s.trim()).filter(Boolean) };

    const skills =
      skillFilterKind() === "inherit"
        ? { kind: "inherit" as const }
        : skillFilterKind() === "none"
          ? { kind: "none" as const }
          : { kind: "allow" as const, names: skillNames().split(",").map((s) => s.trim()).filter(Boolean) };

    return {
      name: name(),
      kind: providerKind(),
      ...(providerKind() === "managed" ? { providerSlug: providerSlug(), model: model() } : {}),
      tools,
      skills,
      approval: approval(),
      identityPrompt: identityPrompt().trim() || undefined,
    };
  };

  const handleSave = async () => {
    if (!name().trim()) {
      setError("Name is required");
      return;
    }
    if (providerKind() === "managed" && (!providerSlug().trim() || !model().trim())) {
      setError("Provider and model are required for managed profiles");
      return;
    }
    if (!isEdit() && !id().trim()) {
      setError("Profile ID is required");
      return;
    }

    if (!isEdit()) {
      const trimmedId = id().trim();
      const exists = mgmt.profiles().some(
        (r) => (r.status === "ready" ? r.entry.id : r.id) === trimmedId
      );
      if (exists) {
        setError("A profile with this ID already exists");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await props.onSave(id().trim(), buildDto());
    } catch (e) {
      if (e instanceof MutationError) {
        const dto = e.dto;
        if (dto.field === "providerSlug") {
          setError(`Provider: ${dto.message}`);
        } else if (dto.field === "model") {
          setError(`Model: ${dto.message}`);
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
    <div class="space-y-4" data-testid="profile-editor">
      <div class="flex items-center gap-2">
        <button
          onClick={props.onClose}
          class="rounded p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          data-testid="btn-cancel-edit"
        >
          <TbOutlineArrowLeft size={16} />
        </button>
        <h2 class="text-sm font-semibold text-text-secondary">
          {isEdit() ? "Edit Profile" : "New Profile"}
        </h2>
      </div>

      <Show when={error()}>
        <div class="rounded-lg border border-error-border bg-error-muted px-4 py-2 text-sm text-error" data-testid="form-error">
          {error()}
        </div>
      </Show>

      <div class="space-y-3">
        <Show when={!isEdit()}>
          <Field label="Profile ID">
            <input
              data-testid="field-id"
              value={id()}
              onInput={(e) => setId(e.currentTarget.value)}
              placeholder="my-profile"
              class="w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
            />
          </Field>
        </Show>

        <Field label="Name">
          <input
            data-testid="field-name"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="My Profile"
            class="w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Provider">
          <div class="flex gap-4">
            <label class="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                checked={providerKind() === "runtimeDefault"}
                onChange={() => setProviderKind("runtimeDefault")}
              />
              Runtime default
            </label>
            <label class="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                checked={providerKind() === "managed"}
                onChange={() => setProviderKind("managed")}
              />
              Managed
            </label>
          </div>
        </Field>

        <Show when={providerKind() === "managed"}>
          <Field label="Provider Slug">
            <input
              data-testid="field-provider"
              value={providerSlug()}
              onInput={(e) => setProviderSlug(e.currentTarget.value)}
              placeholder="openai"
              class="w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
            />
            <div class="text-xs text-text-tertiary mt-1">
              Suggestions: {PROVIDER_METADATA.map((p) => p.id).join(", ")}
            </div>
          </Field>
          <Field label="Model">
            <input
              data-testid="field-model"
              value={model()}
              onInput={(e) => setModel(e.currentTarget.value)}
              placeholder="gpt-4o"
              class="w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
            />
          </Field>
        </Show>

        <Field label="Tool Filter">
          <select
            data-testid="field-tools"
            value={toolFilterKind()}
            onChange={(e) => setToolFilterKind(e.currentTarget.value as "inherit" | "allow" | "deny")}
            class="rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
          >
            <option value="inherit">Inherit all tools</option>
            <option value="allow">Allow specific tools</option>
            <option value="deny">Deny specific tools</option>
          </select>
          <Show when={toolFilterKind() !== "inherit"}>
            <input
              data-testid="field-tool-names"
              value={toolNames()}
              onInput={(e) => setToolNames(e.currentTarget.value)}
              placeholder="read, write, bash"
              class="mt-2 w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
            />
            <div class="text-xs text-text-tertiary mt-1">
              Known tools: {BUILTIN_TOOLS.map((t) => t.id).join(", ")}
            </div>
          </Show>
        </Field>

        <Field label="Skill Filter">
          <select
            data-testid="field-skills"
            value={skillFilterKind()}
            onChange={(e) => setSkillFilterKind(e.currentTarget.value as "inherit" | "allow" | "none")}
            class="rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
          >
            <option value="inherit">Inherit skills</option>
            <option value="allow">Allow specific skills</option>
            <option value="none">No skills</option>
          </select>
          <Show when={skillFilterKind() === "allow"}>
            <input
              data-testid="field-skill-names"
              value={skillNames()}
              onInput={(e) => setSkillNames(e.currentTarget.value)}
              placeholder="skill-a, skill-b"
              class="mt-2 w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
            />
          </Show>
        </Field>

        <Field label="Approval Policy">
          <select
            data-testid="field-approval"
            value={approval()}
            onChange={(e) => setApproval(e.currentTarget.value as "perTool" | "autoApprove")}
            class="rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
          >
            <option value="perTool">Per-tool approval</option>
            <option value="autoApprove">Auto-approve all tool calls</option>
          </select>
        </Field>

        <Field label="Identity Prompt (optional)">
          <textarea
            data-testid="field-identity"
            value={identityPrompt()}
            onInput={(e) => setIdentityPrompt(e.currentTarget.value)}
            placeholder="You are a helpful assistant..."
            rows={3}
            class="w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div class="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving()}
          data-testid="btn-save"
          class="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm text-void hover:bg-accent-hover disabled:opacity-50"
        >
          <TbOutlineDeviceFloppy size={14} />
          {saving() ? "Saving..." : "Save"}
        </button>
        <button
          onClick={props.onClose}
          data-testid="btn-cancel"
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
    <div class="fixed inset-0 flex items-center justify-center bg-black/50" data-testid="delete-dialog">
      <div class="max-w-sm rounded-lg bg-bg-secondary p-6 shadow-xl">
        <h3 class="text-lg font-semibold">Delete profile "{props.id}"?</h3>
        <Show when={props.impactLoading}>
          <p class="mt-2 text-sm text-text-tertiary">Checking dependencies...</p>
        </Show>
        <Show when={props.dependents.length > 0}>
          <p class="mt-2 text-sm text-warning">
            Referenced by prompts: {props.dependents.join(", ")}
          </p>
          <p class="text-sm text-text-tertiary">
            Resolve the references before deleting.
          </p>
        </Show>
        <Show when={props.error}>
          <p class="mt-2 text-sm text-error" data-testid="delete-error">{props.error}</p>
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
              data-testid="btn-confirm-delete"
              class="rounded-md bg-error px-4 py-2 text-sm text-void hover:bg-error-hover"
            >
              Delete
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
};

// ── Helpers ──

const Field: Component<{ label: string; children: JSX.Element }> = (props) => (
  <div>
    <label class="mb-1 block text-xs font-medium text-text-secondary">{props.label}</label>
    {props.children}
  </div>
);
