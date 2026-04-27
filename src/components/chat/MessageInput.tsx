import { createSignal, For, Show, onMount, onCleanup, type Component } from "solid-js";
import { Transition } from "solid-transition-group";
import { TbOutlineSend, TbOutlinePaperclip, TbOutlinePhoto, TbOutlineScreenshot, TbOutlineX } from "solid-icons/tb";
import { listen } from "@tauri-apps/api/event";
import { useChat } from "@context/ChatContext";
import { useAgent } from "@context/AgentContext";
import { sendMessage, sendMessageWithImages, compactSession, startSnip, cancelActivePrompt, saveHandoffBundle, loadHandoffBundle, importHandoff } from "@lib/tauri/commands";
import { open, save } from "@tauri-apps/plugin-dialog";

interface AttachedImage {
  preview: string;  // object URL for display
  base64: string;   // raw base64 without prefix
  mimeType: string;
}

export const MessageInput: Component = () => {
  const [text, setText] = createSignal("");
  const [images, setImages] = createSignal<AttachedImage[]>([]);
  const [attachMenuOpen, setAttachMenuOpen] = createSignal(false);
  const {
    state: chatState,
    addMessageEntry,
    appendToLastAssistantContent,
    setLastAssistantContent,
    setStreaming,
    isStreaming,
  } = useChat();
  const { state: agentState } = useAgent();
  let textareaRef: HTMLTextAreaElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;

  const tabId = () => agentState.activeTabId;
  const sending = () => isStreaming(tabId() ?? "");

  // Listen for snip-complete events from the overlay window
  onMount(async () => {
    const unlisten = await listen<{ data: string; mimeType: string }>(
      "snip-complete",
      (event) => {
        const { data, mimeType } = event.payload;
        setImages((prev) => [
          ...prev,
          {
            preview: `data:${mimeType};base64,${data}`,
            base64: data,
            mimeType,
          },
        ]);
      },
    );
    onCleanup(() => unlisten());
  });

  const handleSnip = async () => {
    try {
      await startSnip();
    } catch (err) {
      console.error("Failed to start snip:", err);
    }
  };

  const resizeTextarea = () => {
    if (!textareaRef) return;
    textareaRef.style.height = "auto";
    textareaRef.style.height = Math.min(textareaRef.scrollHeight, 200) + "px";
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    const newImages: AttachedImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const base64 = await fileToBase64(file);
      newImages.push({
        preview: URL.createObjectURL(file),
        base64,
        mimeType: file.type,
      });
    }
    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const img = prev[index];
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearImages = () => {
    for (const img of images()) URL.revokeObjectURL(img.preview);
    setImages([]);
  };

  const handleSlashCommand = async (command: string): Promise<boolean> => {
    const tid = tabId();
    if (!tid) return false;
    const normalized = command.toLowerCase().trim();
    if (normalized === "/compact") {
      addMessageEntry(tid, {
        id: crypto.randomUUID(), conversationId: tid,
        role: "system", content: "Compacting context...",
        createdAt: new Date().toISOString(),
      });
      try {
        await compactSession(tid);
        addMessageEntry(tid, {
          id: crypto.randomUUID(), conversationId: tid,
          role: "system", content: "Context compacted successfully.",
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        addMessageEntry(tid, {
          id: crypto.randomUUID(), conversationId: tid,
          role: "system", content: `Compact failed: ${err}`,
          createdAt: new Date().toISOString(),
        });
      }
      return true;
    }
    if (normalized === "/export-handoff") {
      addMessageEntry(tid, {
        id: crypto.randomUUID(), conversationId: tid,
        role: "system", content: "Exporting handoff bundle...",
        createdAt: new Date().toISOString(),
      });
      try {
        const filePath = await save({
          filters: [{ name: "Handoff Bundle", extensions: ["json"] }],
          defaultPath: `handoff-${tid}.json`,
        });
        if (filePath) {
          await saveHandoffBundle(tid, filePath);
          addMessageEntry(tid, {
            id: crypto.randomUUID(), conversationId: tid,
            role: "system", content: `Handoff exported to ${filePath}`,
            createdAt: new Date().toISOString(),
          });
        } else {
          addMessageEntry(tid, {
            id: crypto.randomUUID(), conversationId: tid,
            role: "system", content: "Export cancelled.",
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        addMessageEntry(tid, {
          id: crypto.randomUUID(), conversationId: tid,
          role: "system", content: `Export failed: ${err}`,
          createdAt: new Date().toISOString(),
        });
      }
      return true;
    }
    if (normalized === "/import-handoff") {
      addMessageEntry(tid, {
        id: crypto.randomUUID(), conversationId: tid,
        role: "system", content: "Select a handoff bundle to import...",
        createdAt: new Date().toISOString(),
      });
      try {
        const filePath = await open({
          filters: [{ name: "Handoff Bundle", extensions: ["json"] }],
          multiple: false,
        });
        if (filePath && typeof filePath === "string") {
          const bundle = await loadHandoffBundle(filePath);
          await importHandoff(tid, bundle);
          addMessageEntry(tid, {
            id: crypto.randomUUID(), conversationId: tid,
            role: "system", content: `Handoff imported from ${filePath}. Session restored.`,
            createdAt: new Date().toISOString(),
          });
        } else {
          addMessageEntry(tid, {
            id: crypto.randomUUID(), conversationId: tid,
            role: "system", content: "Import cancelled.",
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        addMessageEntry(tid, {
          id: crypto.randomUUID(), conversationId: tid,
          role: "system", content: `Import failed: ${err}`,
          createdAt: new Date().toISOString(),
        });
      }
      return true;
    }
    return false;
  };

  const handleSend = async () => {
    const content = text().trim();
    const attachedImages = images();
    const tid = tabId();
    if ((!content && attachedImages.length === 0) || !tid || sending()) return;

    setText("");
    clearImages();
    if (textareaRef) textareaRef.style.height = "auto";

    if (content.startsWith("/") && attachedImages.length === 0) {
      const handled = await handleSlashCommand(content);
      if (handled) return;
    }

    setStreaming(tid, true);

    // Add user message (with image indicator if applicable)
    const userContent = attachedImages.length > 0
      ? `${content}${content ? "\n" : ""}[${attachedImages.length} image${attachedImages.length > 1 ? "s" : ""} attached]`
      : content;

    addMessageEntry(tid, {
      id: crypto.randomUUID(), conversationId: tid,
      role: "user", content: userContent,
      createdAt: new Date().toISOString(),
    });

    addMessageEntry(tid, {
      id: crypto.randomUUID(), conversationId: tid,
      role: "assistant", content: "",
      createdAt: new Date().toISOString(),
    });

    try {
      let result;
      if (attachedImages.length > 0) {
        // Use blocking multimodal API
        result = await sendMessageWithImages(
          tid,
          content,
          attachedImages.map((img) => ({ data: img.base64, mimeType: img.mimeType })),
        );
      } else {
        // Use streaming text API
        result = await sendMessage(tid, content);
      }
      // Only use the invoke result as a fallback if streaming
      // didn't produce any output (e.g. provider doesn't stream)
      if (result.content) {
        const entries = chatState.entriesByTab[tid] ?? [];
        const lastAssistant = [...entries].reverse().find(
          (e) => e.type === "message" && e.message?.role === "assistant"
        );
        if (lastAssistant?.message && !lastAssistant.message.content) {
          setLastAssistantContent(tid, result.content);
        }
      }
    } catch (err) {
      appendToLastAssistantContent(tid, `Error: ${err}`);
    } finally {
      setStreaming(tid, false);
    }
  };

  const handleCancel = async () => {
    const tid = tabId();
    if (!tid || !sending()) return;

    try {
      await cancelActivePrompt(tid);
      setStreaming(tid, false);
    } catch (err) {
      console.error("Failed to cancel prompt:", err);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !sending()) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      const fakeFileList = { length: imageFiles.length, item: (i: number) => imageFiles[i] } as unknown as FileList;
      Object.assign(fakeFileList, imageFiles);
      handleFileSelect(fakeFileList);
    }
  };

  return (
    <div class="border border-border-default rounded-xl bg-bg-secondary">
      {/* Image previews */}
      <Show when={images().length > 0}>
        <div class="flex gap-2 px-3 pt-2 pb-1 flex-wrap">
          <For each={images()}>
            {(img, index) => (
              <div class="relative group">
                <img
                  src={img.preview}
                  alt="Attached"
                  class="w-14 h-14 rounded-lg object-cover border border-border-subtle"
                />
                <button
                  onClick={() => removeImage(index())}
                  class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <TbOutlineX size={10} class="text-text-secondary" />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Input row */}
      <div class="flex items-end gap-2 px-3 py-2">
        {/* Attach button with popup menu */}
        <div class="relative flex-shrink-0">
          <button
            onClick={() => setAttachMenuOpen(!attachMenuOpen())}
            disabled={sending()}
            class="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
            title="Attach"
          >
            <TbOutlinePaperclip size={16} />
          </button>
          <Show when={attachMenuOpen()}>
            <div class="fixed inset-0 z-10" onClick={() => setAttachMenuOpen(false)} />
          </Show>
          <Transition name="scale-fade">
          <Show when={attachMenuOpen()}>
            <div class="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-border-default bg-bg-elevated shadow-xl z-20 py-1">
              <button
                onClick={() => {
                  setAttachMenuOpen(false);
                  fileInputRef?.click();
                }}
                class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors"
              >
                <TbOutlinePhoto size={15} class="text-text-tertiary" />
                Upload Image
              </button>
              <button
                onClick={() => {
                  setAttachMenuOpen(false);
                  handleSnip();
                }}
                class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors"
              >
                <TbOutlineScreenshot size={15} class="text-text-tertiary" />
                Screenshot Snip
              </button>
            </div>
          </Show>
          </Transition>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          onChange={(e) => handleFileSelect(e.currentTarget.files)}
        />
        <textarea
          ref={textareaRef}
          rows="1"
          placeholder="Type a message or /compact, /export-handoff..."
          value={text()}
          onInput={(e) => {
            setText(e.currentTarget.value);
            resizeTextarea();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={sending()}
          class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none disabled:opacity-50 resize-none leading-relaxed py-1"
          style={{"max-height":"200px"}}
        />
        <Show
          when={sending()}
          fallback={
            <button
              onClick={handleSend}
              disabled={!text().trim() && images().length === 0}
              class={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                text().trim() || images().length > 0
                  ? "bg-accent text-white hover:bg-accent-hover"
                  : "bg-bg-elevated text-text-tertiary"
              }`}
            >
              <TbOutlineSend size={16} />
            </button>
          }
        >
          <button
            onClick={handleCancel}
            class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-bg-elevated text-text-primary hover:bg-bg-hover transition-colors"
            title="Stop"
          >
            <TbOutlineX size={16} />
          </button>
        </Show>
      </div>
    </div>
  );
};

/** Read a File as base64 (without the data URI prefix) */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:image/png;base64," prefix
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
