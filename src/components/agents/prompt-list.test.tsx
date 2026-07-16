import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, waitFor } from "@solidjs/testing-library";

vi.mock("@lib/tauri/config-commands", () => ({
  listProfiles: vi.fn(),
  saveProfile: vi.fn(),
  deleteProfile: vi.fn(),
  profileImpact: vi.fn(),
  listPrompts: vi.fn(),
  createPrompt: vi.fn(),
  savePrompt: vi.fn(),
  renamePrompt: vi.fn(),
  deletePrompt: vi.fn(),
  promptImpact: vi.fn(),
  listCredentials: vi.fn(),
  setApiKey: vi.fn(),
  deleteCredential: vi.fn(),
  restoreDefaultProfiles: vi.fn(),
  getSharedConfigError: vi.fn().mockResolvedValue(null),
  parseMutationError: vi.fn((e: unknown) => ({ kind: "unknown", message: typeof e === "string" ? e : String(e) })),
  formatDependencyEntity: vi.fn((entity: { kind: string; id?: string; slug?: string }) =>
    `${entity.kind}: ${entity.id ?? entity.slug}`
  ),
}));

import { listProfiles, listPrompts, listCredentials, createPrompt, deletePrompt, promptImpact } from "@lib/tauri/config-commands";
import { ConfigManagementProvider } from "@context/ConfigManagementContext";
import { PromptList } from "@components/agents/PromptList";

const mockReadyPrompt = {
  status: "ready" as const,
  entry: {
    id: "prompt-abc",
    prompt: {
      displayName: "Check Email",
      normalizedName: "check-email",
      instructions: "Check and summarize email.",
      skills: ["email-reader"],
      profile: "explore",
    },
    identityState: "ready",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
};

const mockReadyProfile = {
  status: "ready" as const,
  entry: {
    id: "explore",
    profile: {
      name: "Explore",
      kind: "runtimeDefault" as const,
      tools: { kind: "inherit" as const },
      skills: { kind: "inherit" as const },
      approval: "perTool" as const,
    },
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
};

function setupMocks(prompts: unknown[] = [mockReadyPrompt]) {
  vi.mocked(listProfiles).mockResolvedValue([mockReadyProfile] as never);
  vi.mocked(listPrompts).mockResolvedValue(prompts as never);
  vi.mocked(listCredentials).mockResolvedValue([] as never);
}

function renderPromptList() {
  return render(() => (
    <ConfigManagementProvider>
      <PromptList />
    </ConfigManagementProvider>
  ));
}

describe("PromptList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("displays ready prompts with profile assignment", async () => {
    const { getByText } = renderPromptList();
    await waitFor(() => {
      expect(getByText("Check Email")).toBeTruthy();
      expect(getByText("-> Explore")).toBeTruthy();
    });
  });

  it("displays needs-attention prompts with diagnostics", async () => {
    const needsAttention = {
      status: "needsAttention" as const,
      id: "bad-prompt",
      diagnostics: [{ category: "invalidPayload", message: "Decode failed" }],
    };
    setupMocks([mockReadyPrompt, needsAttention]);
    const { getByText } = renderPromptList();
    await waitFor(() => {
      expect(getByText("bad-prompt")).toBeTruthy();
      expect(getByText("Needs attention")).toBeTruthy();
    });
  });

  it("opens new prompt editor on button click", async () => {
    const { getByTestId, findByTestId, getByText } = renderPromptList();
    await waitFor(() => expect(getByText("Check Email")).toBeTruthy());

    fireEvent.click(getByTestId("btn-new-prompt"));
    expect(await findByTestId("prompt-editor")).toBeTruthy();
    expect(getByTestId("field-display-name")).toBeTruthy();
  });

  it("opens edit prompt editor with existing values", async () => {
    const { getByTestId, findByTestId } = renderPromptList();
    await waitFor(() => expect(getByTestId("prompt-row-prompt-abc")).toBeTruthy());

    fireEvent.click(getByTestId("btn-edit-prompt-prompt-abc"));
    const editor = await findByTestId("prompt-editor");
    expect(editor).toBeTruthy();
    expect((getByTestId("field-display-name") as HTMLInputElement).value).toBe("Check Email");
    expect((getByTestId("field-instructions") as HTMLTextAreaElement).value).toContain("Check and summarize");
  });

  it("cancels editor without saving", async () => {
    const { getByTestId, findByTestId } = renderPromptList();
    await waitFor(() => expect(getByTestId("prompt-row-prompt-abc")).toBeTruthy());

    fireEvent.click(getByTestId("btn-new-prompt"));
    await findByTestId("prompt-editor");

    fireEvent.click(getByTestId("btn-cancel-prompt"));
    await waitFor(() => {
      expect(getByTestId("btn-new-prompt")).toBeTruthy();
    });
  });

  it("creates new prompt through create command", async () => {
    vi.mocked(createPrompt).mockResolvedValue(["prompt-new", mockReadyPrompt.entry.prompt] as never);
    const { getByTestId, findByTestId } = renderPromptList();
    await waitFor(() => expect(getByTestId("prompt-row-prompt-abc")).toBeTruthy());

    fireEvent.click(getByTestId("btn-new-prompt"));
    await findByTestId("prompt-editor");

    fireEvent.input(getByTestId("field-display-name"), { target: { value: "My Task" } });
    fireEvent.input(getByTestId("field-instructions"), { target: { value: "Do the thing" } });
    fireEvent.click(getByTestId("btn-save-prompt"));

    await waitFor(() => {
      expect(vi.mocked(createPrompt)).toHaveBeenCalledWith(expect.objectContaining({
        displayName: "My Task",
        instructions: "Do the thing",
      }));
    });
  });

  it("preserves unknown skill identifiers", async () => {
    const promptWithUnknown = {
      status: "ready" as const,
      entry: {
        id: "prompt-xyz",
        prompt: {
          displayName: "Custom Task",
          normalizedName: "custom-task",
          instructions: "Do custom thing",
          skills: ["unknown-skill", "known"],
        },
        identityState: "ready",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    };
    setupMocks([promptWithUnknown]);

    const { getByTestId, findByTestId } = renderPromptList();
    await waitFor(() => expect(getByTestId("prompt-row-prompt-xyz")).toBeTruthy());

    fireEvent.click(getByTestId("btn-edit-prompt-prompt-xyz"));
    const editor = await findByTestId("prompt-editor");
    expect(editor).toBeTruthy();
    expect((getByTestId("field-skills") as HTMLInputElement).value).toContain("unknown-skill");
  });

  it("blocks deletion when there are dependents", async () => {
    vi.mocked(promptImpact).mockResolvedValue({
      target: { kind: "prompt", id: "prompt-abc" },
      links: [{
        entity: { kind: "automationTask", id: "task-1" },
        direction: "dependent",
        proximity: "direct",
        path: [
          { kind: "prompt", id: "prompt-abc" },
          { kind: "automationTask", id: "task-1" },
        ],
      }],
      diagnostics: [],
    } as never);

    const { getByTestId, findByTestId, getByText } = renderPromptList();
    await waitFor(() => expect(getByTestId("prompt-row-prompt-abc")).toBeTruthy());

    fireEvent.click(getByTestId("btn-delete-prompt-prompt-abc"));
    await findByTestId("prompt-delete-dialog");

    await waitFor(() => {
      expect(getByText(/task-1/)).toBeTruthy();
    });
    expect(() => getByTestId("btn-confirm-delete-prompt")).toThrow();
  });

  it("deletes when no dependents", async () => {
    vi.mocked(promptImpact).mockResolvedValue({
      target: { kind: "prompt", id: "prompt-abc" },
      links: [],
      diagnostics: [],
    } as never);
    vi.mocked(deletePrompt).mockResolvedValue(undefined as never);

    const { getByTestId, findByTestId } = renderPromptList();
    await waitFor(() => expect(getByTestId("prompt-row-prompt-abc")).toBeTruthy());

    fireEvent.click(getByTestId("btn-delete-prompt-prompt-abc"));
    await findByTestId("prompt-delete-dialog");

    const confirmBtn = await findByTestId("btn-confirm-delete-prompt");
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(vi.mocked(deletePrompt)).toHaveBeenCalledWith("prompt-abc");
    });
  });
});
