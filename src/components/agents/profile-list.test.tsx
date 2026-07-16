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

import { listProfiles, saveProfile, deleteProfile, profileImpact, listPrompts, listCredentials } from "@lib/tauri/config-commands";
import { ConfigManagementProvider } from "@context/ConfigManagementContext";
import { ProfileList } from "@components/agents/ProfileList";

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

const mockNeedsAttention = {
  status: "needsAttention" as const,
  id: "bad-profile",
  diagnostics: [{ category: "invalidPayload", message: "Corrupt data" }],
};

function setupProfileMocks(profiles: unknown[] = [mockReadyProfile]) {
  vi.mocked(listProfiles).mockResolvedValue(profiles as never);
  vi.mocked(listPrompts).mockResolvedValue([] as never);
  vi.mocked(listCredentials).mockResolvedValue([] as never);
}

function renderProfileList() {
  return render(() => (
    <ConfigManagementProvider>
      <ProfileList />
    </ConfigManagementProvider>
  ));
}

describe("ProfileList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupProfileMocks();
  });

  it("displays ready profiles", async () => {
    const { getByText, findByTestId } = renderProfileList();
    await waitFor(() => {
      expect(getByText("Explore")).toBeTruthy();
    });
    expect(findByTestId("profile-row-explore")).toBeTruthy();
  });

  it("displays needs-attention profiles with diagnostics", async () => {
    setupProfileMocks([mockReadyProfile, mockNeedsAttention]);
    const { getByText } = renderProfileList();
    await waitFor(() => {
      expect(getByText("bad-profile")).toBeTruthy();
      expect(getByText("Needs attention")).toBeTruthy();
    });
  });

  it("opens new profile editor on button click", async () => {
    const { getByTestId, findByTestId } = renderProfileList();
    await waitFor(() => expect(getByTestId("profile-row-explore")).toBeTruthy());

    fireEvent.click(getByTestId("btn-new-profile"));
    expect(await findByTestId("profile-editor")).toBeTruthy();
    expect(getByTestId("field-id")).toBeTruthy();
  });

  it("opens edit profile editor with existing values", async () => {
    const { getByTestId, findByTestId } = renderProfileList();
    await waitFor(() => expect(getByTestId("profile-row-explore")).toBeTruthy());

    fireEvent.click(getByTestId("btn-edit-explore"));
    const editor = await findByTestId("profile-editor");
    expect(editor).toBeTruthy();
    expect((getByTestId("field-name") as HTMLInputElement).value).toBe("Explore");
  });

  it("cancels editor without saving", async () => {
    const { getByTestId, findByTestId } = renderProfileList();
    await waitFor(() => expect(getByTestId("profile-row-explore")).toBeTruthy());

    fireEvent.click(getByTestId("btn-new-profile"));
    await findByTestId("profile-editor");

    fireEvent.click(getByTestId("btn-cancel"));
    await waitFor(() => {
      expect(getByTestId("btn-new-profile")).toBeTruthy();
    });
  });

  it("saves new profile through command", async () => {
    vi.mocked(saveProfile).mockResolvedValue(undefined as never);
    const { getByTestId, findByTestId } = renderProfileList();
    await waitFor(() => expect(getByTestId("profile-row-explore")).toBeTruthy());

    fireEvent.click(getByTestId("btn-new-profile"));
    await findByTestId("profile-editor");

    fireEvent.input(getByTestId("field-id"), { target: { value: "test-profile" } });
    fireEvent.input(getByTestId("field-name"), { target: { value: "Test" } });
    fireEvent.click(getByTestId("btn-save"));

    await waitFor(() => {
      expect(vi.mocked(saveProfile)).toHaveBeenCalledWith("test-profile", expect.objectContaining({
        name: "Test",
      }));
    });
  });

  it("shows delete dialog with dependent prompts", async () => {
    vi.mocked(profileImpact).mockResolvedValue({
      target: { kind: "profile", id: "explore" },
      links: [{
        entity: { kind: "prompt", id: "my-prompt" },
        direction: "dependent",
        proximity: "direct",
        path: [
          { kind: "profile", id: "explore" },
          { kind: "prompt", id: "my-prompt" },
        ],
      }],
      diagnostics: [],
    } as never);
    vi.mocked(deleteProfile).mockResolvedValue(undefined as never);

    const { getByTestId, getByText, findByTestId } = renderProfileList();
    await waitFor(() => expect(getByTestId("profile-row-explore")).toBeTruthy());

    fireEvent.click(getByTestId("btn-delete-explore"));
    const dialog = await findByTestId("delete-dialog");
    expect(dialog).toBeTruthy();
    await waitFor(() => {
      expect(getByText(/my-prompt/)).toBeTruthy();
    });
    // Delete button should be hidden when there are dependents
    expect(() => getByTestId("btn-confirm-delete")).toThrow();
  });

  it("allows deletion when no dependents", async () => {
    vi.mocked(profileImpact).mockResolvedValue({
      target: { kind: "profile", id: "explore" },
      links: [],
      diagnostics: [],
    } as never);
    vi.mocked(deleteProfile).mockResolvedValue(undefined as never);

    const { getByTestId, findByTestId } = renderProfileList();
    await waitFor(() => expect(getByTestId("profile-row-explore")).toBeTruthy());

    fireEvent.click(getByTestId("btn-delete-explore"));
    await findByTestId("delete-dialog");

    const confirmBtn = await findByTestId("btn-confirm-delete");
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(vi.mocked(deleteProfile)).toHaveBeenCalledWith("explore");
    });
  });

  it("shows error when deleting last valid profile", async () => {
    vi.mocked(profileImpact).mockResolvedValue({
      target: { kind: "profile", id: "explore" },
      links: [],
      diagnostics: [],
    } as never);
    vi.mocked(deleteProfile).mockRejectedValue(
      "Cannot delete the last valid agent profile." as never
    );

    const { getByTestId, findByTestId } = renderProfileList();
    await waitFor(() => expect(getByTestId("profile-row-explore")).toBeTruthy());

    fireEvent.click(getByTestId("btn-delete-explore"));
    await findByTestId("delete-dialog");

    const confirmBtn = await findByTestId("btn-confirm-delete");
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(getByTestId("delete-error").textContent).toContain("last valid");
    });
  });

  it("preserves unknown tool identifiers with suggestions", async () => {
    const profileWithUnknown = {
      status: "ready" as const,
      entry: {
        id: "custom",
        profile: {
          name: "Custom",
          kind: "runtimeDefault" as const,
          tools: { kind: "allow" as const, names: ["unknown-tool", "read"] },
          skills: { kind: "inherit" as const },
          approval: "perTool" as const,
        },
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    };
    setupProfileMocks([profileWithUnknown]);

    const { getByTestId, findByTestId } = renderProfileList();
    await waitFor(() => expect(getByTestId("profile-row-custom")).toBeTruthy());

    fireEvent.click(getByTestId("btn-edit-custom"));
    const editor = await findByTestId("profile-editor");
    expect(editor).toBeTruthy();
    // Tool names should include the unknown tool
    expect((getByTestId("field-tool-names") as HTMLInputElement).value).toContain("unknown-tool");
  });

  it("rejects creating a profile with an existing ID", async () => {
    vi.mocked(saveProfile).mockResolvedValue(undefined as never);
    const { getByTestId, findByTestId } = renderProfileList();
    await waitFor(() => expect(getByTestId("profile-row-explore")).toBeTruthy());

    fireEvent.click(getByTestId("btn-new-profile"));
    await findByTestId("profile-editor");

    // Use an ID that already exists
    fireEvent.input(getByTestId("field-id"), { target: { value: "explore" } });
    fireEvent.input(getByTestId("field-name"), { target: { value: "Duplicate" } });
    fireEvent.click(getByTestId("btn-save"));

    await waitFor(() => {
      expect(getByTestId("form-error").textContent).toContain("already exists");
    });
    expect(vi.mocked(saveProfile)).not.toHaveBeenCalled();
  });

  it("allows editing needs-attention profiles with decoded payload", async () => {
    const needsAttentionWithDecoded = {
      status: "needsAttention" as const,
      id: "weird-profile",
      decoded: {
        name: "Weird",
        kind: "runtimeDefault" as const,
        tools: { kind: "inherit" as const },
        skills: { kind: "inherit" as const },
        approval: "perTool" as const,
      },
      diagnostics: [{ category: "unavailableSkill", message: "Skill 'xyz' not found" }],
    };
    setupProfileMocks([mockReadyProfile, needsAttentionWithDecoded]);

    const { getByTestId, findByTestId } = renderProfileList();
    await waitFor(() => expect(getByTestId("profile-row-weird-profile")).toBeTruthy());

    // Edit button should be visible for needs-attention with decoded
    fireEvent.click(getByTestId("btn-edit-weird-profile"));
    const editor = await findByTestId("profile-editor");
    expect(editor).toBeTruthy();
    expect((getByTestId("field-name") as HTMLInputElement).value).toBe("Weird");
  });

  it("hides edit button for needs-attention profiles without decoded payload", async () => {
    setupProfileMocks([mockReadyProfile, mockNeedsAttention]);
    const { getByTestId } = renderProfileList();
    await waitFor(() => expect(getByTestId("profile-row-bad-profile")).toBeTruthy());

    // No edit button should exist for needs-attention without decoded
    expect(() => getByTestId("btn-edit-bad-profile")).toThrow();
  });
});
